/**
 * WhatsApp Business Platform (Cloud API) integration.
 *
 * - Credentials are read ONLY from backend environment variables.
 * - Business-initiated messages use pre-approved templates.
 * - A 200 response means Meta ACCEPTED the message; actual delivery is reported
 *   later through the webhook (sent / delivered / read / failed). Callers must
 *   never treat "accepted" as "delivered".
 */
const crypto = require("crypto");

const RETRYABLE_ERROR_CODES = new Set([
  1, 2, // API unknown / service temporarily unavailable
  4, 80007, 130429, // rate limits
  131000, // something went wrong
  131016, // service unavailable
  131048, // spam rate limit
  131056, // pair rate limit
  133004, // server temporarily unavailable
]);

function getConfig() {
  const env = process.env;
  return {
    accessToken: (env.WHATSAPP_ACCESS_TOKEN || "").trim(),
    phoneNumberId: (env.WHATSAPP_PHONE_NUMBER_ID || "").trim(),
    apiVersion: (env.WHATSAPP_API_VERSION || "v21.0").trim(),
    baseUrl: (env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com").replace(/\/+$/, ""),
    language: (env.WHATSAPP_TEMPLATE_LANGUAGE || "en").trim(),
    paramFormat: (env.WHATSAPP_TEMPLATE_PARAM_FORMAT || "named").trim().toLowerCase(),
    reminderTemplate: (env.WHATSAPP_REMINDER_TEMPLATE || "").trim(),
    escalationTemplate: (env.WHATSAPP_ESCALATION_TEMPLATE || "").trim(),
    otpTemplate: (env.WHATSAPP_OTP_TEMPLATE || "").trim(),
    otpTemplateHasButton: String(env.WHATSAPP_OTP_TEMPLATE_HAS_BUTTON || "true").toLowerCase() === "true",
    appSecret: (env.WHATSAPP_APP_SECRET || "").trim(),
    webhookVerifyToken: (env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim(),
    timeoutMs: Number(env.WHATSAPP_TIMEOUT_MS) || 15000,
  };
}

/** Configuration status for dashboards / setup warnings. Never returns secrets. */
function getStatus() {
  const c = getConfig();
  const missing = [];
  if (!c.accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!c.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!c.reminderTemplate) missing.push("WHATSAPP_REMINDER_TEMPLATE");
  const warnings = [];
  if (!c.escalationTemplate) warnings.push("WHATSAPP_ESCALATION_TEMPLATE is not set — escalations are sent in-app only.");
  if (!c.otpTemplate) warnings.push("WHATSAPP_OTP_TEMPLATE is not set — phone numbers must be verified by an administrator.");
  if (!c.appSecret || !c.webhookVerifyToken) {
    warnings.push("Webhook not configured (WHATSAPP_APP_SECRET / WHATSAPP_WEBHOOK_VERIFY_TOKEN) — delivery confirmations will not be received; messages will stay at 'accepted'.");
  }
  return {
    configured: missing.length === 0,
    canSendReminders: Boolean(c.accessToken && c.phoneNumberId && c.reminderTemplate),
    canSendEscalations: Boolean(c.accessToken && c.phoneNumberId && c.escalationTemplate),
    canSendOtp: Boolean(c.accessToken && c.phoneNumberId && c.otpTemplate),
    webhookConfigured: Boolean(c.appSecret && c.webhookVerifyToken),
    missing,
    warnings,
    apiVersion: c.apiVersion,
    language: c.language,
    templates: {
      reminder: c.reminderTemplate || null,
      escalation: c.escalationTemplate || null,
      otp: c.otpTemplate || null,
    },
  };
}

/** Normalises an Indian / international number to E.164 (+919876543210). */
function normalizePhone(raw, defaultCountryCode = "91") {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[\s()-]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!s.startsWith("+")) {
    const digits = s.replace(/^0+/, "");
    if (/^\d{10}$/.test(digits)) s = `+${defaultCountryCode}${digits}`;
    else s = `+${digits}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
}

function maskPhone(e164) {
  if (!e164) return "";
  return e164.length > 6 ? `${e164.slice(0, 3)}******${e164.slice(-4)}` : "****";
}

/** WhatsApp template parameters may not contain newlines, tabs or >4 spaces. */
function sanitizeParam(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000) || "-";
}

/**
 * Builds the Cloud API payload for a template message.
 * params: [{ name: "business_name", value: "Hotel X" }, ...] (order matters for positional)
 */
function buildTemplatePayload({ to, templateName, language, params = [], paramFormat = "named", buttonParam = null }) {
  const bodyParams = params.map((p) => {
    const item = { type: "text", text: sanitizeParam(p.value) };
    if (paramFormat === "named") item.parameter_name = p.name;
    return item;
  });
  const components = [];
  if (bodyParams.length) components.push({ type: "body", parameters: bodyParams });
  if (buttonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: sanitizeParam(buttonParam) }],
    });
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: String(to).replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      ...(components.length ? { components } : {}),
    },
  };
}

/**
 * Sends a template message. Resolves (never rejects) with:
 * { ok, accepted, messageId, httpStatus, error, errorCode, retryable, notConfigured }
 */
async function sendTemplate({ to, templateName, params = [], buttonParam = null, fetchImpl } = {}) {
  const c = getConfig();
  const doFetch = fetchImpl || global.fetch;

  if (!c.accessToken || !c.phoneNumberId) {
    return { ok: false, notConfigured: true, retryable: false, error: "WhatsApp Cloud API credentials are not configured." };
  }
  if (!templateName) {
    return { ok: false, notConfigured: true, retryable: false, error: "WhatsApp template name is not configured." };
  }
  const phone = normalizePhone(to);
  if (!phone) {
    return { ok: false, retryable: false, error: "Recipient phone number is invalid." };
  }
  if (typeof doFetch !== "function") {
    return { ok: false, retryable: false, error: "fetch is not available in this Node.js runtime (Node 18+ required)." };
  }

  const payload = buildTemplatePayload({
    to: phone,
    templateName,
    language: c.language,
    params,
    paramFormat: c.paramFormat,
    buttonParam,
  });
  const url = `${c.baseUrl}/${c.apiVersion}/${c.phoneNumberId}/messages`;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), c.timeoutMs) : null;

  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });

    let body = null;
    try {
      body = await res.json();
    } catch (_) {
      body = null;
    }

    const messageId = body && Array.isArray(body.messages) && body.messages[0] ? body.messages[0].id : "";
    if (res.ok && messageId) {
      return { ok: true, accepted: true, messageId, httpStatus: res.status, retryable: false };
    }

    const apiErr = (body && body.error) || {};
    const errorCode = apiErr.code || null;
    const retryable = res.status === 429 || res.status >= 500 || RETRYABLE_ERROR_CODES.has(Number(errorCode));
    const detail = apiErr.error_data && apiErr.error_data.details ? ` — ${apiErr.error_data.details}` : "";
    return {
      ok: false,
      httpStatus: res.status,
      errorCode,
      retryable,
      error: `${apiErr.message || `HTTP ${res.status}`}${errorCode ? ` (code ${errorCode})` : ""}${detail}`,
    };
  } catch (err) {
    const aborted = err && err.name === "AbortError";
    return {
      ok: false,
      retryable: true,
      error: aborted ? `WhatsApp API request timed out after ${c.timeoutMs}ms` : `Network error: ${err.message}`,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Verifies the X-Hub-Signature-256 header of a webhook call. */
function verifyWebhookSignature(rawBody, signatureHeader) {
  const { appSecret } = getConfig();
  if (!appSecret || !rawBody || !signatureHeader) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Extracts message status updates from a webhook payload. */
function extractStatuses(body) {
  const out = [];
  const entries = (body && body.entry) || [];
  entries.forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      const statuses = (change.value && change.value.statuses) || [];
      statuses.forEach((s) => {
        out.push({
          messageId: s.id,
          status: s.status, // sent | delivered | read | failed
          timestamp: s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date(),
          recipient: s.recipient_id,
          errors: (s.errors || []).map((e) => `${e.title || e.message || "error"}${e.code ? ` (code ${e.code})` : ""}`),
        });
      });
    });
  });
  return out;
}

module.exports = {
  getConfig,
  getStatus,
  normalizePhone,
  maskPhone,
  sanitizeParam,
  buildTemplatePayload,
  sendTemplate,
  verifyWebhookSignature,
  extractStatuses,
};
