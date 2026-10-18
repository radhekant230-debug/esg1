const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

// Stub the Resend SDK so nothing leaves the machine; capture the request instead.
const calls = [];
let reply = { data: { id: "email_123" }, error: null };
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "resend") {
    return { Resend: class { constructor(key) { this.key = key; this.emails = { send: async (p) => (calls.push({ key, ...p }), reply) }; } } };
  }
  return realLoad.call(this, req, ...rest);
};
const email = require("../../utils/email");
Module._load = realLoad;

const quiet = (fn) => async () => {
  const orig = { log: console.log, warn: console.warn, error: console.error };
  const logs = [];
  console.log = console.warn = console.error = (...a) => logs.push(a.join(" "));
  try {
    await fn(logs);
  } finally {
    Object.assign(console, orig);
  }
};

test.beforeEach(() => {
  calls.length = 0;
  reply = { data: { id: "email_123" }, error: null };
  process.env.RESEND_API_KEY = "  re_testkey123\r ";
  process.env.EMAIL_FROM = '"ESG Officials <noreply@esgofficials.com>"';
  delete process.env.EMAIL_FROM_DOMAIN;
  delete process.env.NODE_ENV;
  process.env.EMAIL_TEST_RECIPIENT = "owner@example.com";
});

test("sends with a cleaned key and the verified-domain sender to the test recipient", quiet(async (logs) => {
  const data = await email.sendOTPEmail("Owner@Example.com", "482913", "login");
  assert.equal(data.id, "email_123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, "re_testkey123", "whitespace/\\r stripped from the key");
  assert.equal(calls[0].from, "ESG Officials <noreply@esgofficials.com>", "quotes stripped from EMAIL_FROM");
  assert.deepEqual(calls[0].to, ["owner@example.com"]);
  assert.ok(calls[0].html.includes("482913") && calls[0].text.includes("482913"), "code is in the email body");
  assert.ok(!logs.join("\n").includes("482913"), "code never logged");
  assert.ok(!logs.join("\n").includes("re_testkey123"), "key never logged");
  assert.ok(!logs.join("\n").includes("owner@"), "recipient masked in logs");
}));

test("test mode refuses any other recipient before calling Resend", quiet(async () => {
  await assert.rejects(email.sendOTPEmail("someone@else.com", "111111", "login"), (e) => e.code === "TEST_RECIPIENT_ONLY");
  await assert.rejects(email.sendClientCredentialsEmail("client@x.com", "C", "CLI-1", "pw"), (e) => e.code === "TEST_RECIPIENT_ONLY");
  await email.sendProjectUpdateEmail("client@x.com", "C", "P", "U"); // best-effort: no throw
  assert.equal(calls.length, 0);
}));

test("without EMAIL_TEST_RECIPIENT any address is allowed (production behaviour)", quiet(async () => {
  delete process.env.EMAIL_TEST_RECIPIENT;
  await email.sendOTPEmail("someone@else.com", "111111", "login");
  assert.deepEqual(calls[0].to, ["someone@else.com"]);
}));

test("missing EMAIL_FROM falls back to noreply@esgofficials.com", quiet(async () => {
  delete process.env.EMAIL_FROM;
  await email.sendOTPEmail("owner@example.com", "111111", "login");
  assert.equal(calls[0].from, "ESG Officials <noreply@esgofficials.com>");
}));

test("resend.dev sender is refused in production; other domains must match EMAIL_FROM_DOMAIN", quiet(async () => {
  process.env.EMAIL_FROM = "ESG Officials <onboarding@resend.dev>";
  process.env.NODE_ENV = "production";
  await assert.rejects(email.sendOTPEmail("owner@example.com", "111111", "password_reset"), (e) => e.code === "EMAIL_CONFIG" && /resend\.dev/.test(e.message));
  process.env.EMAIL_FROM = "ESG Officials <noreply@other-domain.com>";
  await assert.rejects(email.sendOTPEmail("owner@example.com", "111111", "login"), (e) => e.code === "EMAIL_CONFIG" && /esgofficials\.com/.test(e.message));
  assert.equal(calls.length, 0);
  process.env.EMAIL_FROM = "ESG Officials <noreply@mail.esgofficials.com>";
  await email.sendOTPEmail("owner@example.com", "111111", "login");
  assert.equal(calls.length, 1, "subdomain of the verified domain allowed");
}));

test("Resend 403 testing-domain error becomes an actionable message", quiet(async (logs) => {
  reply = { data: null, error: { name: "validation_error", statusCode: 403, message: "You can only send testing emails to your own email address. To send emails to other recipients, please verify a domain" } };
  await assert.rejects(email.sendOTPEmail("owner@example.com", "222222", "login"), (e) => /verified for this API key/.test(e.message) && e.resend.statusCode === 403);
  assert.ok(!logs.join("\n").includes("222222"));
  assert.ok(!logs.join("\n").includes("re_testkey123"));
}));

test("a Resend error is surfaced with its name and status, without the code", quiet(async (logs) => {
  reply = { data: null, error: { name: "validation_error", statusCode: 403, message: "You can only send testing emails to your own email address" } };
  await assert.rejects(email.sendOTPEmail("owner@example.com", "654321", "login"), (e) => e.resend.statusCode === 403);
  assert.ok(logs.join("\n").includes("validation_error"));
  assert.ok(!logs.join("\n").includes("654321"));
}));

test("a public-mailbox sender (gmail.com) is refused before contacting Resend", quiet(async () => {
  process.env.EMAIL_FROM = "someone@gmail.com";
  await assert.rejects(email.sendOTPEmail("owner@example.com", "111111", "login"), (e) => e.code === "EMAIL_CONFIG" && /cannot be verified/.test(e.message));
  assert.equal(calls.length, 0);
  assert.ok(email.checkEmailConfig().some((p) => /gmail\.com/.test(p)));
}));

test("checkEmailConfig reports problems without revealing the key", quiet(async () => {
  process.env.RESEND_API_KEY = "re_secretvalue999";
  process.env.EMAIL_FROM = "ESG Officials <no-reply@esgofficials.com>";
  assert.deepEqual(email.checkEmailConfig(), []);
  process.env.RESEND_API_KEY = "";
  const problems = email.checkEmailConfig();
  assert.ok(problems.some((p) => /RESEND_API_KEY is not set/.test(p)));
  assert.ok(!problems.join(" ").includes("re_secretvalue999"));
}));

test("the email states the configured expiry", quiet(async () => {
  process.env.OTP_EXPIRY_MINUTES = "10";
  await email.sendOTPEmail("owner@example.com", "123456", "password_reset");
  assert.match(calls[0].subject, /Reset your ESG Officials password/);
  assert.ok(calls[0].text.includes("expires in 10 minutes"));
  delete process.env.OTP_EXPIRY_MINUTES;
}));

test("missing key is reported clearly", quiet(async () => {
  process.env.RESEND_API_KEY = "";
  await assert.rejects(email.sendOTPEmail("owner@example.com", "111111", "login"), /RESEND_API_KEY is not set/);
}));
