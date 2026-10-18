const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const L = require("../../services/portal/leadImport");

const SOURCES = ["Meta Ads", "Google Ads", "Website Enquiry", "Instagram DM", "Walk-in", "Referral", "Other"];
const CSV = [
  "name,email,phone,gender,birthday,anniversary,address,last_visited_at,rfm_segment,total_spent,avg_spend,total_visits,points_balance,redemptions,customer_tags,average_tbo_in_days",
  "Cash sale,2248936867@example.com,9876543210,male,2000-01-01 00:00:00,2022-07-05 00:00:00,,2026-02-21 22:56:59,lost,1772,886,2,0,0,,0",
  "naman,naman.nitya1@gmail.com,7798685855,male,2024-03-16 00:00:00,,,2025-06-07 19:16:47,lost,32569,1086,30,0,6,,11",
  ",,8340277080,,,,,2025-04-27 22:21:44,one-time-visitor,523,523,1,0,0,,0",
  "dup,,+91 98765 43210,,,,,2025-01-01 10:00:00,new,10,10,1,0,0,,0",
  "nobody,,,,,,,2025-01-01 10:00:00,new,10,10,1,0,0,,0",
  "zero,,9000000001,,,,,2025-01-01 10:00:00,imported,0,0,0,0,0,,0",
].join("\n");

const run = (buf, name = "Cafe_Mysa_Customer-List.csv") => L.mapRows(L.readSheetRows(Buffer.from(buf), name), { sources: SOURCES });

test("POS customer list (CSV): columns detected and mapped to enquiries", () => {
  const r = run(CSV);
  assert.deepEqual(r.columns.sort(), ["address", "anniversary", "avg", "birthday", "date", "email", "gender", "name", "phone", "points", "redemptions", "segment", "tags", "value", "visits"].sort());
  assert.equal(r.leads.length, 4);
  const [cash, naman, noName, zero] = r.leads;
  assert.deepEqual(
    { name: cash.doc.name, phone: cash.doc.phone, email: cash.doc.email, value: cash.doc.estimatedValue, status: cash.doc.status, campaign: cash.doc.campaign, source: cash.doc.source },
    { name: "Cash sale", phone: "9876543210", email: "", value: 1772, status: "Converted", campaign: "RFM: lost", source: "Walk-in" },
    "placeholder @example.com email dropped; visits -> Converted"
  );
  assert.equal(cash.doc.enquiryDate.toISOString(), "2026-02-21T17:26:59.000Z", "last visit read as IST");
  assert.match(cash.note, /2 visits · avg spend ₹886 · total spent ₹1,772 · RFM segment: lost · birthday 2000-01-01 · anniversary 2022-07-05/);
  assert.equal(naman.doc.email, "naman.nitya1@gmail.com");
  assert.equal(naman.doc.estimatedValue, 32569);
  assert.equal(noName.doc.name, "Customer 8340277080", "blank name falls back to the phone number");
  assert.equal(zero.doc.status, "New", "no visits and no spend -> New");
});

test("skips rows without phone/email and repeated customers (same phone, any format)", () => {
  const r = run(CSV);
  assert.deepEqual(r.skipped.map((s) => s.reason), ["Same customer appears earlier in the file", "No phone number or email"]);
  assert.deepEqual(r.skipped.map((s) => s.rowNumber), [5, 6]);
});

test("Excel file with the same columns gives the same result", () => {
  const ws = XLSX.utils.aoa_to_sheet(CSV.split("\n").map((l) => l.split(",")));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const x = L.mapRows(L.readSheetRows(buf, "list.xlsx"), { sources: SOURCES });
  const c = run(CSV);
  assert.deepEqual(x.leads.map((l) => [l.doc.name, l.doc.phone, l.doc.estimatedValue, l.doc.status]), c.leads.map((l) => [l.doc.name, l.doc.phone, l.doc.estimatedValue, l.doc.status]));
});

test("simple enquiry sheets: stage, source and value columns are respected", () => {
  const r = run("Name,Mobile,Source,Status,Value,Date\nRavi,9811122233,Referral,Qualified,\"₹2,500\",15/10/2026\n");
  assert.deepEqual(
    [r.leads[0].doc.source, r.leads[0].doc.status, r.leads[0].doc.estimatedValue, r.leads[0].doc.enquiryDate.toISOString()],
    ["Referral", "Qualified", 2500, "2026-10-14T18:30:00.000Z"]
  );
});

test("files without name/phone/email columns are rejected clearly", () => {
  assert.throws(() => run("foo,bar\n1,2\n"), /No Name, Phone or Email column/);
});

test("supports column aliases like Contact No., Total Spend, RFM, Last Visit Date with timestamp, and BOM", () => {
  const bomCsv = "\uFEFFContact Name,Contact No.,Customer Email,Total Spend,No of Visits,RFM,Last Visit Date\nAnita Rao,9812345678,anita@test.com,4500,3,Loyal,25/11/2025 14:30:00\n";
  const r = run(bomCsv);
  assert.equal(r.leads.length, 1);
  const lead = r.leads[0];
  assert.equal(lead.doc.name, "Anita Rao");
  assert.equal(lead.doc.phone, "9812345678");
  assert.equal(lead.doc.email, "anita@test.com");
  assert.equal(lead.doc.estimatedValue, 4500);
  assert.equal(lead.doc.status, "Converted");
  assert.equal(lead.doc.campaign, "RFM: Loyal");
  assert.equal(lead.doc.enquiryDate.toISOString(), "2025-11-25T09:00:00.000Z");
});

test("supports separate First Name and Last Name columns", () => {
  const r = run("First Name,Last Name,Phone\nJohn,Doe,9898989898\n");
  assert.equal(r.leads.length, 1);
  assert.equal(r.leads[0].doc.name, "John Doe");
  assert.equal(r.leads[0].doc.phone, "9898989898");
});

