const test = require("node:test");
const assert = require("node:assert/strict");
const ist = require("../../utils/istDate");

test("26 Oct 2026 10:00 IST is stored as 04:30 UTC and displays as 26 October 2026", () => {
  const d = ist.parseISTDateTime("2026-10-26", "10:00");
  assert.equal(d.toISOString(), "2026-10-26T04:30:00.000Z");
  assert.equal(ist.formatISTDate(d), "26 October 2026");
  assert.equal(ist.formatISTTime(d), "10:00 AM");
  assert.equal(ist.istDayKey(d), "2026-10-26");
});

test("IST day boundaries differ from UTC (00:30 IST is still the previous UTC day)", () => {
  const d = ist.parseISTDateTime("2026-10-26", "00:30");
  assert.equal(d.toISOString(), "2026-10-25T19:00:00.000Z");
  assert.equal(ist.istDayKey(d), "2026-10-26");
  assert.equal(ist.startOfISTDay(d).toISOString(), "2026-10-25T18:30:00.000Z");
});

test("invalid dates are rejected", () => {
  assert.equal(ist.parseISTDateTime("2026-02-31", "10:00"), null);
  assert.equal(ist.parseISTDateTime("26/10/2026"), null);
  assert.equal(ist.parseISTDateTime("2026-10-26", "25:00"), null);
});

test("explicit ISO timestamps with offsets are respected", () => {
  assert.equal(ist.parseISTDateTime("2026-10-26T04:30:00.000Z").toISOString(), "2026-10-26T04:30:00.000Z");
  assert.equal(ist.parseISTDateTime("2026-10-26T10:00").toISOString(), "2026-10-26T04:30:00.000Z");
});

test("calendar quarters in IST", () => {
  const q4 = ist.quarterRange(2026, 4);
  assert.equal(q4.start.toISOString(), "2026-09-30T18:30:00.000Z");
  assert.equal(q4.end.toISOString(), "2026-12-31T18:29:59.999Z");
  assert.deepEqual(q4.months.map((m) => m.name), ["October", "November", "December"]);
  assert.deepEqual(ist.quarterOf(ist.parseISTDateTime("2026-10-26", "10:00")), { quarter: 4, year: 2026 });
});

test("Indian financial-year quarters (start month April)", () => {
  const q4 = ist.quarterRange(2026, 4, 4); // FY 2026-27 Q4 = Jan-Mar 2027
  assert.deepEqual(q4.months.map((m) => `${m.name} ${m.year}`), ["January 2027", "February 2027", "March 2027"]);
  assert.deepEqual(ist.quarterOf(ist.parseISTDateTime("2027-02-10"), 4), { quarter: 4, year: 2026 });
  assert.deepEqual(ist.quarterOf(ist.parseISTDateTime("2026-10-26"), 4), { quarter: 3, year: 2026 });
});
