const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const wa = require("../../services/whatsappService");

const configure = () => {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  process.env.WHATSAPP_REMINDER_TEMPLATE = "upload_reminder";
  process.env.WHATSAPP_TEMPLATE_LANGUAGE = "en";
  process.env.WHATSAPP_TEMPLATE_PARAM_FORMAT = "named";
};
const unconfigure = () => {
  ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_REMINDER_TEMPLATE", "WHATSAPP_APP_SECRET"].forEach((k) => delete process.env[k]);
};

const params = [
  { name: "business_name", value: "Hotel Green Horizon" },
  { name: "scheduled_date", value: "26 October 2026" },
  { name: "scheduled_time", value: "10:00 AM IST" },
  { name: "task_link", value: "https://app.example.com/manager/dashboard?tab=uploads&activity=1" },
];

const fakeFetch = (status, body, calls = []) => async (url, opts) => {
  calls.push({ url, opts });
  return { ok: status >= 200 && status < 300, status, json: async () => body };
};

test("phone normalisation", () => {
  assert.equal(wa.normalizePhone("98765 43210"), "+919876543210");
  assert.equal(wa.normalizePhone("+91-98765-43210"), "+919876543210");
  assert.equal(wa.normalizePhone("0091 9876543210"), "+919876543210");
  assert.equal(wa.normalizePhone("12"), null);
  assert.equal(wa.maskPhone("+919876543210"), "+91******3210");
});

test("not configured -> clear status, nothing sent", async () => {
  unconfigure();
  const st = wa.getStatus();
  assert.equal(st.configured, false);
  assert.ok(st.missing.includes("WHATSAPP_ACCESS_TOKEN"));
  const calls = [];
  const r = await wa.sendTemplate({ to: "+919876543210", templateName: "x", params, fetchImpl: fakeFetch(200, {}, calls) });
  assert.equal(r.ok, false);
  assert.equal(r.notConfigured, true);
  assert.equal(calls.length, 0);
});

test("Scenario 3a: accepted message returns the provider message id (accepted, not 'delivered')", async () => {
  configure();
  const calls = [];
  const r = await wa.sendTemplate({
    to: "+919876543210",
    templateName: "upload_reminder",
    params,
    fetchImpl: fakeFetch(200, { messages: [{ id: "wamid.TEST123" }] }, calls),
  });
  assert.equal(r.ok, true);
  assert.equal(r.accepted, true);
  assert.equal(r.messageId, "wamid.TEST123");
  const sent = JSON.parse(calls[0].opts.body);
  assert.equal(calls[0].url, "https://graph.facebook.com/v21.0/123456/messages");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer test-token");
  assert.equal(sent.to, "919876543210");
  assert.equal(sent.template.name, "upload_reminder");
  assert.equal(sent.template.components[0].parameters[0].parameter_name, "business_name");
  assert.equal(sent.template.components[0].parameters[1].text, "26 October 2026");
});

test("Scenario 3b: provider failure is reported as a failure with the real reason", async () => {
  configure();
  const r = await wa.sendTemplate({
    to: "+919876543210",
    templateName: "upload_reminder",
    params,
    fetchImpl: fakeFetch(400, { error: { message: "Template name does not exist in the translation", code: 132001 } }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.retryable, false);
  assert.match(r.error, /132001/);
});

test("rate limits / 5xx / network errors are retryable", async () => {
  configure();
  const r1 = await wa.sendTemplate({ to: "+919876543210", templateName: "t", params, fetchImpl: fakeFetch(429, { error: { message: "rate", code: 130429 } }) });
  assert.equal(r1.retryable, true);
  const r2 = await wa.sendTemplate({ to: "+919876543210", templateName: "t", params, fetchImpl: fakeFetch(503, {}) });
  assert.equal(r2.retryable, true);
  const r3 = await wa.sendTemplate({ to: "+919876543210", templateName: "t", params, fetchImpl: async () => { throw new Error("ECONNRESET"); } });
  assert.equal(r3.ok, false);
  assert.equal(r3.retryable, true);
});

test("200 without a message id is NOT treated as success", async () => {
  configure();
  const r = await wa.sendTemplate({ to: "+919876543210", templateName: "t", params, fetchImpl: fakeFetch(200, {}) });
  assert.equal(r.ok, false);
});

test("positional template parameters", () => {
  const p = wa.buildTemplatePayload({ to: "+919876543210", templateName: "t", language: "en", params, paramFormat: "positional" });
  assert.equal(p.template.components[0].parameters[0].parameter_name, undefined);
});

test("parameters are sanitised (no newlines)", () => {
  assert.equal(wa.sanitizeParam("a\nb\t c"), "a b c");
  assert.equal(wa.sanitizeParam(""), "-");
});

test("webhook signature verification and status extraction", () => {
  process.env.WHATSAPP_APP_SECRET = "appsecret";
  const body = JSON.stringify({
    entry: [{ changes: [{ value: { statuses: [
      { id: "wamid.TEST123", status: "delivered", timestamp: "1793000000", recipient_id: "919876543210" },
      { id: "wamid.FAIL", status: "failed", timestamp: "1793000001", errors: [{ code: 131026, title: "Message undeliverable" }] },
    ] } }] }],
  });
  const raw = Buffer.from(body);
  const sig = `sha256=${crypto.createHmac("sha256", "appsecret").update(raw).digest("hex")}`;
  assert.equal(wa.verifyWebhookSignature(raw, sig), true);
  assert.equal(wa.verifyWebhookSignature(raw, "sha256=deadbeef"), false);
  const st = wa.extractStatuses(JSON.parse(body));
  assert.equal(st.length, 2);
  assert.equal(st[0].status, "delivered");
  assert.match(st[1].errors[0], /131026/);
  unconfigure();
});
