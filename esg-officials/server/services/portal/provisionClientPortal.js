/**
 * Activates a Client Portal for an EXISTING sales business, reusing the app's
 * own relationships:
 *
 *   User (role "client", auto clientId)  <-- SalesBusiness.clientAccount
 *   ClientProfile.client = User._id
 *
 * The Client Portal reads sales through SalesBusiness.clientAccount
 * (services/portal/clientSalesFeed.js), so linking the business is what makes
 * its existing and future imported sales appear for the client, and what
 * removes "(no client portal)" from the manager's business dropdown.
 *
 * Idempotent: re-running finds the same business, user and profile and only
 * fills what is missing. Never creates a second business, never deletes.
 * The account is switched to active only after every check has passed.
 */
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
const idStr = (v) => (v == null ? "" : String(v._id || v));
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class ProvisionError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "ProvisionError";
    this.details = details;
  }
}

/** Placeholder mailbox for a username-only account (".invalid" is reserved and never delivers). */
function placeholderEmail(login, businessCode) {
  const slug = String(login).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug}.${String(businessCode || "client").toLowerCase()}@client-portal.invalid`;
}

function createProvisioner({ User, SalesBusiness, ClientProfile, hashPassword, comparePassword, buildLoginQuery, audit = async () => {} }) {
  /** Finds the one business; stops on zero or several matches. */
  async function findBusiness({ businessName, city }) {
    // exact on the normalized name (ignores case, spacing, punctuation and accents)
    const inCity = await SalesBusiness.find(city ? { city: new RegExp(`^\\s*${escapeRe(city.trim())}\\s*$`, "i") } : {});
    const found = inCity.filter((b) => norm(b.name) === norm(businessName));
    if (found.length !== 1) {
      throw new ProvisionError(
        found.length ? `${found.length} businesses match "${businessName}"${city ? `, ${city}` : ""}. Nothing was changed.` : `No business "${businessName}"${city ? ` in ${city}` : ""} was found. Nothing was changed.`,
        { matches: found.map((b) => ({ _id: idStr(b), name: b.name, code: b.code, city: b.city })) }
      );
    }
    return found[0];
  }

  async function plan({ businessName, city, login }) {
    if (!businessName || !login) throw new ProvisionError("Business name and login ID are required.");
    const loginLower = String(login).trim().toLowerCase();
    const business = await findBusiness({ businessName, city });

    // 1. user already linked to the business
    let user = null;
    let how = null;
    if (business.clientAccount) {
      user = await User.findById(business.clientAccount);
      if (!user) throw new ProvisionError(`${business.name} is linked to a user (${idStr(business.clientAccount)}) that no longer exists. Nothing was changed.`);
      if (user.role !== "client") throw new ProvisionError(`${business.name} is linked to a "${user.role}" account, not a client. Nothing was changed.`);
      how = "already linked to the business";
    }

    // 2. who currently owns the login identifier?
    const loginOwners = await User.find(buildLoginQuery(loginLower));
    const foreign = loginOwners.filter((u) => !user || idStr(u) !== idStr(user));
    if (foreign.length) {
      const f = foreign[0];
      const linkedElsewhere = await SalesBusiness.find({ clientAccount: f._id });
      const fitsBusiness = !user && f.role === "client" && linkedElsewhere.every((b) => idStr(b) === idStr(business));
      if (foreign.length > 1 || !fitsBusiness) {
        throw new ProvisionError(`The login ID "${login}" is already used by another account. Nothing was changed.`, {
          accounts: foreign.map((u) => ({ _id: idStr(u), role: u.role, clientId: u.clientId || null, companyName: u.companyName || "" })),
        });
      }
      user = f;
      how = "existing account with this login ID";
    }

    // 3. an unlinked client account for the same company name (repair instead of duplicating)
    if (!user) {
      const sameName = (await User.find({ role: "client" })).filter((u) => norm(u.companyName) === norm(business.name));
      const free = [];
      for (const u of sameName) {
        // eslint-disable-next-line no-await-in-loop
        const linked = await SalesBusiness.find({ clientAccount: u._id });
        if (!linked.length) free.push(u);
      }
      if (free.length > 1) {
        throw new ProvisionError(`Several unlinked client accounts are named "${business.name}". Nothing was changed.`, {
          accounts: free.map((u) => ({ _id: idStr(u), clientId: u.clientId, email: u.email })),
        });
      }
      if (free.length === 1) {
        user = free[0];
        how = "existing unlinked client account with the same company name";
      }
    }

    const profile = user ? await ClientProfile.findOne({ client: user._id }) : null;
    return { business, user, how: how || "new account", profile, loginLower };
  }

  /**
   * Applies the plan. Password: set when the account is new, or when
   * resetPassword is true (so a password the client changed is never overwritten).
   */
  async function apply(p, { tempPassword, resetPassword = false, actor = null, businessType = "restaurant" }) {
    const { business, loginLower } = p;
    const changes = [];
    let user = p.user;

    if (!user) {
      if (!tempPassword) throw new ProvisionError("A temporary password is required to create the account.");
      user = new User({
        name: business.name,
        email: placeholderEmail(loginLower, business.code),
        username: loginLower,
        password: await hashPassword(tempPassword),
        role: "client",
        companyName: business.name,
        phone: business.phone || "",
        assignedManager: business.assignedManager || null,
        isVerified: true, // admin-provisioned, same as Admin → Create client
        isActive: false, // switched on only after verification below
      });
      await user.save(); // pre-save hook assigns the next CLI-YYYY-NNNN
      changes.push("user created");
    } else {
      if (user.role !== "client") throw new ProvisionError("Target account is not a client.");
      if (!user.username) {
        user.username = loginLower;
        changes.push("username set");
      } else if (user.username !== loginLower) {
        throw new ProvisionError(`This account already has the login ID "${user.username}". Nothing was changed.`);
      }
      if (!user.companyName) {
        user.companyName = business.name;
        changes.push("companyName set");
      }
      if (!user.assignedManager && business.assignedManager) {
        user.assignedManager = business.assignedManager;
        changes.push("assignedManager copied from business");
      }
      if (!user.isVerified) {
        user.isVerified = true;
        changes.push("marked verified");
      }
      if (resetPassword) {
        if (!tempPassword) throw new ProvisionError("--reset-password needs a temporary password.");
        user.password = await hashPassword(tempPassword);
        changes.push("password reset");
      }
      if (changes.length) await user.save();
    }

    let profile = p.profile || (await ClientProfile.findOne({ client: user._id }));
    if (!profile) {
      profile = new ClientProfile({
        client: user._id,
        businessName: business.name,
        businessType,
        contactPersonName: "",
        phone: business.phone || "",
        address: [business.address, business.city, business.state].filter(Boolean).join(", "),
      });
      await profile.save();
      changes.push("client profile created");
    }

    if (!business.clientAccount) {
      business.clientAccount = user._id;
      await business.save();
      changes.push("business linked to user");
    } else if (idStr(business.clientAccount) !== idStr(user)) {
      throw new ProvisionError("The business was linked to another account in the meantime. Nothing further was changed.");
    }

    // ---- verification before activation ----
    const checks = {};
    const fresh = await User.findById(user._id);
    const owners = await User.find(buildLoginQuery(loginLower));
    checks.loginResolvesToThisUser = owners.length === 1 && idStr(owners[0]) === idStr(fresh);
    checks.passwordIsHashed = /^\$2[aby]\$\d{2}\$.{53}$/.test(String(fresh.password || ""));
    checks.temporaryPasswordWorks = tempPassword && (changes.includes("user created") || changes.includes("password reset")) ? await comparePassword(tempPassword, fresh.password) : null;
    const linked = await SalesBusiness.find({ clientAccount: fresh._id });
    checks.portalSeesOnlyThisBusiness = linked.length === 1 && idStr(linked[0]) === idStr(business);
    checks.profileExists = Boolean(await ClientProfile.findOne({ client: fresh._id }));
    checks.isClientRole = fresh.role === "client" && Boolean(fresh.clientId);
    const ok = Object.values(checks).every((v) => v !== false);
    if (!ok) throw new ProvisionError("Verification failed; the account was left inactive.", { checks, changes });

    if (!fresh.isActive) {
      fresh.isActive = true;
      await fresh.save();
      changes.push("account activated");
    }

    if (changes.length) {
      await audit({
        entityType: "SalesBusiness",
        entityId: business._id,
        action: "CLIENT_PORTAL_PROVISIONED",
        actor,
        after: { user: idStr(fresh), clientId: fresh.clientId, username: fresh.username, changes },
        metadata: { business: business.code },
      });
    }
    return { user: fresh, business, profile, changes, checks };
  }

  return { plan, apply, findBusiness };
}

module.exports = { createProvisioner, ProvisionError, placeholderEmail, norm };
