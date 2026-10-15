/**
 * Builds a SYNTHETIC restaurant "day wise" report with the same layout as a
 * Petpooja "All Restaurant Report - Day Wise" export (metadata lines, header
 * row below them, restaurant name only on the first daily row, Total / Min. /
 * Max. / Avg. / Sub Total rows). All names and numbers are invented.
 *
 * The real exported report should be saved next to this file as
 * restaurant-daywise-real.xlsx (or .csv) — the tests then run against it too.
 *
 *   node tests/fixtures/makeRestaurantDayWise.js   # writes .xlsx and .csv
 */
const path = require("path");
const xlsx = require("xlsx");

const HEADERS = [
  "Restaurants", "Date", "Invoice Nos.", "Total no. of bills", "My Amount (₹)", "Total Discount (₹)", "Net Sales (₹)(M.A - T.D)",
  "Delivery Charge", "Container Charge", "Service Charge", "Total Tax (₹)", "Waived off", "Round Off", "Total Sales (₹)",
  "Not Paid", "Cash", "Card", "Due Payment", "Other", "Wallet", "UPI", "Online", "Pax",
];

/** Deterministic pseudo-random numbers so the fixture never changes. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function buildRows({ restaurant = "SAMPLE BISTRO", year = 2026, month = 9, days = 30, firstInvoice = 10781, seed = 7, mutate = null } = {}) {
  const r = rng(seed);
  const p2 = (n) => String(n).padStart(2, "0");
  const start = `${year}-${p2(month)}-01`;
  const end = `${year}-${p2(month)}-${p2(days)}`;
  const rows = [
    ["All Restaurant Report - Day Wise"],
    [`Report Period : ${start} to ${end}`],
    [],
    HEADERS,
  ];
  let inv = firstInvoice;
  const daily = [];
  for (let d = 1; d <= days; d++) {
    const bills = 40 + Math.floor(r() * 60);
    const myAmount = Math.round((18000 + r() * 22000) * 100) / 100;
    const discount = Math.round(myAmount * (0.02 + r() * 0.05) * 100) / 100;
    const net = Math.round((myAmount - discount) * 100) / 100;
    const delivery = d % 3 === 0 ? 150 : 0;
    const container = Math.round(bills * 5 * 100) / 100;
    const service = 0;
    const tax = Math.round(net * 0.05 * 100) / 100;
    const gross = net + delivery + container + service + tax;
    const total = Math.round(gross);
    const roundOff = Math.round((total - gross) * 100) / 100;
    const upi = Math.round(total * 0.55);
    const card = Math.round(total * 0.25);
    const online = d % 2 === 0 ? 1200 : 0;
    const cash = total - upi - card - online;
    const lastInv = inv + bills - 1;
    const row = [
      d === 1 ? restaurant : "", `${year}-${p2(month)}-${p2(d)}`, `${inv}-${lastInv}`, bills, myAmount, discount, net,
      delivery, container, service, tax, 0, roundOff, total, 0, cash, card, 0, 0, 0, upi, online, Math.round(bills * 2.3),
    ];
    inv = lastInv + 1;
    daily.push(row);
  }
  if (mutate) mutate(daily);
  rows.push(...daily);
  const col = (i) => daily.map((x) => x[i]);
  const sum = (i) => Math.round(col(i).reduce((a, b) => a + b, 0) * 100) / 100;
  const stat = (label, f) => [label, "", "", ...HEADERS.slice(3).map((_, j) => f(j + 3))];
  rows.push(stat("Total", sum));
  rows.push(stat("Min.", (i) => Math.min(...col(i))));
  rows.push(stat("Max.", (i) => Math.max(...col(i))));
  rows.push(stat("Avg.", (i) => Math.round((sum(i) / days) * 100) / 100));
  rows.push([]);
  rows.push(stat("Sub Total", sum));
  return rows;
}

function writeFixtures(dir = __dirname) {
  const rows = buildRows();
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(rows);
  // Invoice ranges are text cells, as in the export
  xlsx.utils.book_append_sheet(wb, ws, "Report");
  xlsx.writeFile(wb, path.join(dir, "restaurant-daywise-sample.xlsx"));
  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
  require("fs").writeFileSync(path.join(dir, "restaurant-daywise-sample.csv"), "﻿" + csv);
  return rows;
}

if (require.main === module) {
  writeFixtures();
  console.log("Wrote restaurant-daywise-sample.xlsx and .csv");
}

module.exports = { buildRows, writeFixtures, HEADERS };
