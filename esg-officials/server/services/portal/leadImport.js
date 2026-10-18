/**
 * Customer-list / enquiry import for Leads & Enquiries (CSV, XLSX, XLS).
 *
 * Built for POS customer exports such as Petpooja's "Customer List"
 * (name, email, phone, gender, birthday, anniversary, address, last_visited_at,
 * rfm_segment, total_spent, avg_spend, total_visits, points_balance,
 * redemptions, customer_tags, average_tbo_in_days) and also accepts simpler
 * enquiry sheets (Name, Phone, Email, Source, Date, Value, Status).
 *
 * Mapping into ClientLead (no schema change):
 *   name            <- name (blank: "Customer <phone>")
 *   phone / email   <- phone / email (placeholder @example.* emails are dropped)
 *   enquiryDate     <- last_visited_at / date (IST)
 *   estimatedValue  <- total_spent / value  (what the customer has been charged)
 *   status          <- a pipeline stage if the file has one; otherwise
 *                      "Converted" for customers who visited/spent, else "New"
 *   campaign        <- "RFM: <segment>" when an RFM segment is present
 *   note            <- visits, average spend, points, redemptions, birthday,
 *                      anniversary, address, tags (only on newly created leads)
 *
 * Re-importing the same list updates the existing customer (matched on phone,
 * then email) instead of creating duplicates.
 */
const XLSX = require("xlsx");

const STATUSES = ["New", "Contacted", "Qualified", "Converted", "Lost"];
const norm = (s) => String(s || "").replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIASES = {
  name: ["name", "customername", "customer", "fullname", "guestname", "clientname", "client", "leadname", "contactname", "user", "username"],
  firstname: ["firstname", "first", "fname"],
  lastname: ["lastname", "last", "lname"],
  email: ["email", "emailid", "emailaddress", "mail", "customeremail", "clientemail", "leademail", "primaryemail"],
  phone: [
    "phone", "mobile", "phonenumber", "mobilenumber", "mobileno", "phoneno", "contact", "contactnumber",
    "contactno", "whatsapp", "cell", "cellphone", "cellno", "telephone", "tel", "primaryphone", "customermobile", "customerphone"
  ],
  date: [
    "lastvisitedat", "lastvisit", "lastvisited", "lastvisitdate", "lastvisiteddate", "lastorderdate",
    "lastorder", "lasttransactiondate", "lasttxndate", "enquirydate", "date", "createdat", "visitdate", "orderdate"
  ],
  value: [
    "totalspent", "estimatedvalue", "value", "amount", "totalamount", "dealvalue", "charge", "totalcharge",
    "totalspend", "totalspends", "spend", "spends", "totalsales", "sales", "totalrevenue", "revenue", "lifetimevalue", "ltv", "totalvalue"
  ],
  segment: ["rfmsegment", "segment", "rfm", "rfmscore", "customersegment", "clientsegment"],
  status: ["status", "stage", "leadstatus"],
  source: ["source", "leadsource", "channel"],
  campaign: ["campaign", "campaignname"],
  visits: ["totalvisits", "visits", "visitcount", "noofvisits", "numberofvisits", "visit", "orders", "totalorders", "ordercount", "nooforders", "bookings", "totalbookings"],
  avg: ["avgspend", "averagespend", "avgbill", "averagebill", "averageordervalue", "aov", "avgordervalue"],
  points: ["pointsbalance", "points", "loyaltypoints"],
  redemptions: ["redemptions"],
  birthday: ["birthday", "dob", "dateofbirth"],
  anniversary: ["anniversary"],
  address: ["address"],
  tags: ["customertags", "tags"],
  gender: ["gender"],
};

function readSheetRows(buffer, filename = "") {
  // CSV: keep every cell as typed text (no date/number guessing); Excel: real dates
  const isCsv = /\.csv$/i.test(filename) || /\.txt$/i.test(filename);
  const wb = XLSX.read(buffer, { type: "buffer", raw: isCsv, cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true, blankrows: false });
  // header row = first row (within 25) that has a name/phone/email column
  let h = 0;
  for (let i = 0; i < Math.min(25, matrix.length); i++) {
    const keys = (matrix[i] || []).map(norm);
    if (keys.some((k) => ALIASES.phone.includes(k) || ALIASES.name.includes(k) || ALIASES.email.includes(k) || ALIASES.firstname.includes(k))) {
      h = i;
      break;
    }
  }
  const headers = (matrix[h] || []).map((x) => String(x ?? "").replace(/^\uFEFF/, "").trim());
  const rows = matrix.slice(h + 1).map((cells, i) => ({ rowNumber: h + i + 2, cells }));
  return { headers, rows, filename };
}

function columnMap(headers) {
  const keys = headers.map(norm);
  const map = {};
  Object.entries(ALIASES).forEach(([field, names]) => {
    const idx = keys.findIndex((k) => names.includes(k));
    if (idx > -1) map[field] = idx;
  });
  return map;
}

const num = (v) => {
  // drop currency symbols (₹/Rs, any encoding), thousands separators and spaces
  const s = String(v ?? "").replace(/rs\.?/gi, "").replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const normPhone = (v) => {
  let rawStr = "";
  if (typeof v === "number" && Number.isFinite(v)) {
    rawStr = v.toLocaleString("fullwide", { useGrouping: false });
  } else {
    rawStr = String(v || "");
  }
  let d = rawStr.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length >= 7 ? d : "";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (v) => {
  const e = String(v || "").trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return "";
  if (/@example\.(com|org|net)$/.test(e)) return ""; // POS placeholder addresses
  return e;
};

/** "2026-02-21 22:56:59" (IST, as POS exports) or any parseable date. */
function parseDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" && Number.isFinite(v) && v > 20000 && v < 80000) {
    // Excel serial date number
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(v || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || "00"}:${m[5] || "00"}:${m[6] || "00"}+05:30`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dm = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/); // dd/mm/yyyy [hh:mm:ss]
  if (dm) {
    const hour = (dm[4] || "00").padStart(2, "0");
    const min = (dm[5] || "00").padStart(2, "0");
    const sec = (dm[6] || "00").padStart(2, "0");
    const d = new Date(`${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}T${hour}:${min}:${sec}+05:30`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// calendar date as written (IST), never shifted by time zones
const dateOnly = (v) => {
  const m = String(v instanceof Date ? "" : v || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = parseDate(v);
  return d ? new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) : "";
};

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Turns sheet rows into lead documents. Pure (no database).
 * Returns { leads: [{ rowNumber, key, doc, note }], skipped: [{ rowNumber, reason }], columns }
 */
function mapRows({ headers, rows }, { sources, defaultSource = "Walk-in", now = new Date() }) {
  const col = columnMap(headers);
  if (col.phone === undefined && col.email === undefined && col.name === undefined && col.firstname === undefined) {
    const e = new Error("No Name, Phone or Email column was found in the first rows of the file.");
    e.status = 400;
    throw e;
  }
  const raw = (cells, f) => (col[f] === undefined ? "" : cells[col[f]]);
  const get = (cells, f) => {
    const v = raw(cells, f);
    return v instanceof Date ? v.toISOString() : String(v ?? "").trim();
  };
  const seen = new Set();
  const leads = [];
  const skipped = [];

  rows.forEach(({ rowNumber, cells }) => {
    if (!cells.some((c) => String(c).trim())) return;
    const phone = normPhone(raw(cells, "phone") || get(cells, "phone"));
    const email = normEmail(get(cells, "email"));
    let name = col.name !== undefined ? get(cells, "name") : "";
    if (!name && col.firstname !== undefined) {
      name = `${get(cells, "firstname")} ${get(cells, "lastname")}`.trim();
    }
    name = name.replace(/\s+/g, " ").slice(0, 120);
    if (!phone && !email) return skipped.push({ rowNumber, reason: "No phone number or email" });
    if (!name) name = `Customer ${phone || email}`;

    const key = phone ? `p:${phone}` : `e:${email}`;
    if (seen.has(key)) return skipped.push({ rowNumber, reason: "Same customer appears earlier in the file" });
    seen.add(key);

    const value = num(get(cells, "value"));
    if (value !== null && value < 0) return skipped.push({ rowNumber, reason: "Negative value/amount" });
    const visits = num(get(cells, "visits"));
    const segment = get(cells, "segment");
    const statusRaw = get(cells, "status");
    const status =
      STATUSES.find((s) => s.toLowerCase() === statusRaw.toLowerCase()) ||
      ((visits !== null && visits > 0) || (value !== null && value > 0) ? "Converted" : "New");
    const srcRaw = get(cells, "source");
    const source = sources.find((s) => s.toLowerCase() === srcRaw.toLowerCase()) || defaultSource;
    const date = parseDate(raw(cells, "date")) || now;
    const campaign = (get(cells, "campaign") || (segment ? `RFM: ${segment}` : "")).slice(0, 120);

    const facts = [];
    if (visits !== null) facts.push(`${visits} visit${visits === 1 ? "" : "s"}`);
    const avg = num(get(cells, "avg"));
    if (avg !== null) facts.push(`avg spend ${inr(avg)}`);
    if (value !== null) facts.push(`total spent ${inr(value)}`);
    const points = num(get(cells, "points"));
    if (points !== null && points !== 0) facts.push(`points ${points}`);
    const red = num(get(cells, "redemptions"));
    if (red) facts.push(`${red} redemption${red === 1 ? "" : "s"}`);
    if (segment) facts.push(`RFM segment: ${segment}`);
    const bday = dateOnly(raw(cells, "birthday"));
    if (bday) facts.push(`birthday ${bday}`);
    const anniv = dateOnly(raw(cells, "anniversary"));
    if (anniv) facts.push(`anniversary ${anniv}`);
    const gender = get(cells, "gender");
    if (gender) facts.push(`gender ${gender}`);
    const addr = get(cells, "address");
    if (addr) facts.push(`address: ${addr.slice(0, 200)}`);
    const tags = get(cells, "tags");
    if (tags) facts.push(`tags: ${tags.slice(0, 100)}`);

    leads.push({
      rowNumber,
      key,
      phone,
      email,
      doc: {
        name,
        phone,
        email,
        source,
        campaign,
        enquiryDate: date,
        estimatedValue: value === null ? 0 : Math.round(value * 100) / 100,
        status,
      },
      note: facts.length ? `Imported from customer list: ${facts.join(" · ")}` : "",
    });
  });

  return { leads, skipped, columns: Object.keys(col) };
}

module.exports = { readSheetRows, mapRows, columnMap, parseDate, normPhone, normEmail, STATUSES };
