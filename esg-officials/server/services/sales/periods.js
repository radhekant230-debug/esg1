/**
 * Calendar helpers for date-range sales analytics (pure, no database).
 *
 * All dates are calendar days in India Standard Time, handled as "YYYY-MM-DD"
 * keys. Arithmetic is done on UTC midnights of those keys, so it is never
 * shifted by the server's time zone.
 *
 * Weeks start on Monday. Quarters/years follow QUARTER_START_MONTH (default 1 =
 * calendar quarters; 4 = Indian financial year), the same setting the planner uses.
 */
const ist = require("../../utils/istDate");

const DAY_MS = 86400000;
const MONTH_SHORT = ist.MONTH_NAMES.map((m) => m.slice(0, 3));
const KEY_RX = /^(\d{4})-(\d{2})-(\d{2})$/;

const quarterStartMonth = () => {
  const n = Number(process.env.QUARTER_START_MONTH);
  return n >= 1 && n <= 12 ? n : 1;
};

function isValidKey(key) {
  const m = KEY_RX.exec(String(key || ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const toUTC = (key) => {
  const m = KEY_RX.exec(key);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
};
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
const keyOf = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const addDays = (key, n) => fromUTC(toUTC(key) + n * DAY_MS);
const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY_MS); // b - a
const spanDays = (start, end) => daysBetween(start, end) + 1;
const parts = (key) => {
  const m = KEY_RX.exec(key);
  return { y: +m[1], m: +m[2], d: +m[3] };
};
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthStart = (y, m) => keyOf(y, m, 1);
const monthEnd = (y, m) => keyOf(y, m, daysInMonth(y, m));
const weekday = (key) => (new Date(toUTC(key)).getUTCDay() + 6) % 7; // Monday = 0

/** Today's date in IST as a key. */
function todayKey(now = new Date()) {
  const p = ist.toISTParts(now);
  return keyOf(p.year, p.month, p.day);
}

/** Converts a Date (an IST midnight or any instant) to its IST day key. */
function dateToKey(date) {
  const p = ist.toISTParts(date);
  return keyOf(p.year, p.month, p.day);
}
/** IST midnight Date for a day key (what SalesEntry.date stores). */
const keyToDate = (key) => {
  const p = parts(key);
  return ist.fromISTParts(p.y, p.m, p.d);
};

function quarterOfKey(key, startMonth = quarterStartMonth()) {
  const p = parts(key);
  const offset = (p.m - startMonth + 12) % 12;
  const q = Math.floor(offset / 3) + 1;
  const fy = p.m >= startMonth ? p.y : p.y - 1; // year in which this fiscal year starts
  const idx = startMonth - 1 + (q - 1) * 3; // months after January of `fy`
  const sy = fy + Math.floor(idx / 12);
  const sm = (idx % 12) + 1;
  const ey = fy + Math.floor((idx + 2) / 12);
  const em = ((idx + 2) % 12) + 1;
  return { quarter: q, fiscalYear: fy, start: monthStart(sy, sm), end: monthEnd(ey, em) };
}

function yearOfKey(key, startMonth = quarterStartMonth()) {
  const p = parts(key);
  const y = p.m >= startMonth ? p.y : p.y - 1;
  const start = monthStart(y, startMonth);
  const endY = startMonth === 1 ? y : y + 1;
  const endM = startMonth === 1 ? 12 : startMonth - 1;
  return { year: y, start, end: monthEnd(endY, endM), label: startMonth === 1 ? `${y}` : `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}` };
}

const fmt = (key) => {
  const p = parts(key);
  return `${p.d} ${MONTH_SHORT[p.m - 1]} ${p.y}`;
};
function rangeLabel(start, end) {
  if (start === end) return fmt(start);
  const a = parts(start);
  const b = parts(end);
  if (start === monthStart(a.y, a.m) && end === monthEnd(a.y, a.m)) return `${ist.MONTH_NAMES[a.m - 1]} ${a.y}`;
  if (a.y === b.y) return `${a.d} ${MONTH_SHORT[a.m - 1]} – ${fmt(end)}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

const PRESETS = {
  today: "Today",
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  this_week: "This week",
  previous_week: "Previous week",
  this_month: "This month",
  previous_month: "Previous month",
  this_quarter: "This quarter",
  previous_quarter: "Previous quarter",
  this_year: "This year",
  custom: "Custom range",
};

/**
 * Resolves a preset (or a custom start/end) to { preset, start, end, label }.
 * Throws { status: 400 } for invalid input.
 */
function resolveRange({ preset, start, end } = {}, now = new Date()) {
  const today = todayKey(now);
  const t = parts(today);
  const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
  let r;
  switch (preset || (start || end ? "custom" : "this_month")) {
    case "today":
      r = { start: today, end: today };
      break;
    case "last_7_days":
      r = { start: addDays(today, -6), end: today };
      break;
    case "last_30_days":
      r = { start: addDays(today, -29), end: today };
      break;
    case "this_week": {
      const s = addDays(today, -weekday(today));
      r = { start: s, end: addDays(s, 6) };
      break;
    }
    case "previous_week": {
      const s = addDays(today, -weekday(today) - 7);
      r = { start: s, end: addDays(s, 6) };
      break;
    }
    case "this_month":
      r = { start: monthStart(t.y, t.m), end: monthEnd(t.y, t.m) };
      break;
    case "previous_month": {
      const pm = t.m === 1 ? 12 : t.m - 1;
      const py = t.m === 1 ? t.y - 1 : t.y;
      r = { start: monthStart(py, pm), end: monthEnd(py, pm) };
      break;
    }
    case "this_quarter": {
      const q = quarterOfKey(today);
      r = { start: q.start, end: q.end };
      break;
    }
    case "previous_quarter": {
      const q = quarterOfKey(addDays(quarterOfKey(today).start, -1));
      r = { start: q.start, end: q.end };
      break;
    }
    case "this_year": {
      const y = yearOfKey(today);
      r = { start: y.start, end: y.end };
      break;
    }
    case "custom": {
      if (!isValidKey(start) || !isValidKey(end)) throw bad("Choose a valid start and end date (YYYY-MM-DD).");
      if (end < start) throw bad("The end date is before the start date.");
      if (spanDays(start, end) > 3 * 366) throw bad("Choose a range of at most three years.");
      r = { start, end };
      break;
    }
    default:
      throw bad(`Unknown period "${preset}".`);
  }
  const p = preset && PRESETS[preset] ? preset : start || end ? "custom" : "this_month";
  return { preset: p, presetLabel: PRESETS[p], ...r, days: spanDays(r.start, r.end), label: rangeLabel(r.start, r.end) };
}

/** True when [start,end] is made of whole calendar months. */
function isWholeMonths(start, end) {
  const a = parts(start);
  const b = parts(end);
  return a.d === 1 && end === monthEnd(b.y, b.m);
}

/** Months (y,m) overlapping [start,end]. */
function monthsBetween(start, end) {
  const out = [];
  let { y, m } = parts(start);
  const b = parts(end);
  while (y < b.y || (y === b.y && m <= b.m)) {
    out.push({ y, m, start: monthStart(y, m), end: monthEnd(y, m) });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/**
 * The comparable previous period: the previous calendar unit for month /
 * quarter / year / week shaped ranges, otherwise the same number of days
 * immediately before.
 */
function previousRange(range) {
  const { start, end } = range;
  const a = parts(start);
  const b = parts(end);
  if (isWholeMonths(start, end)) {
    const months = (b.y - a.y) * 12 + (b.m - a.m) + 1;
    let pm = a.m - months;
    let py = a.y;
    while (pm < 1) {
      pm += 12;
      py--;
    }
    const pe = addDays(start, -1);
    const pp = parts(pe);
    return { start: monthStart(py, pm), end: monthEnd(pp.y, pp.m), label: rangeLabel(monthStart(py, pm), monthEnd(pp.y, pp.m)) };
  }
  const n = spanDays(start, end);
  const ps = addDays(start, -n);
  const pe = addDays(start, -1);
  return { start: ps, end: pe, label: rangeLabel(ps, pe) };
}

// ---------------------------------------------------------------- buckets ---

const GRANULARITIES = ["day", "week", "month", "quarter", "year"];

/** Bucket containing a day: { key, start, end, label }. */
function bucketOf(dayKey, granularity) {
  const p = parts(dayKey);
  switch (granularity) {
    case "day":
      return { key: dayKey, start: dayKey, end: dayKey, label: `${p.d} ${MONTH_SHORT[p.m - 1]}` };
    case "week": {
      const s = addDays(dayKey, -weekday(dayKey));
      const sp = parts(s);
      return { key: `W${s}`, start: s, end: addDays(s, 6), label: `Wk ${sp.d} ${MONTH_SHORT[sp.m - 1]}` };
    }
    case "month":
      return { key: `${p.y}-${String(p.m).padStart(2, "0")}`, start: monthStart(p.y, p.m), end: monthEnd(p.y, p.m), label: `${MONTH_SHORT[p.m - 1]} ${p.y}` };
    case "quarter": {
      const q = quarterOfKey(dayKey);
      const sm = parts(q.start);
      return { key: `Q${q.start}`, start: q.start, end: q.end, label: quarterStartMonth() === 1 ? `Q${q.quarter} ${sm.y}` : `Q${q.quarter} FY${String(q.fiscalYear % 100).padStart(2, "0")}` };
    }
    case "year": {
      const y = yearOfKey(dayKey);
      return { key: `Y${y.start}`, start: y.start, end: y.end, label: y.label };
    }
    default:
      throw new Error(`bad granularity ${granularity}`);
  }
}

/** All buckets that intersect [start,end], in order. */
function bucketsFor(start, end, granularity) {
  const out = [];
  let cur = bucketOf(start, granularity);
  while (cur.start <= end) {
    out.push(cur);
    cur = bucketOf(addDays(cur.end, 1), granularity);
  }
  return out;
}

/** Does a span [s,e] fit entirely inside one bucket of this granularity? */
const fitsBucket = (s, e, granularity) => bucketOf(s, granularity).key === bucketOf(e, granularity).key;

/** Default chart granularity for a range length. */
function defaultGranularity(days) {
  if (days <= 62) return "day";
  if (days <= 190) return "week";
  if (days <= 3 * 366) return "month";
  return "quarter";
}

// ---------------------------------------------------------- date parsing ---

const MONTH_LOOKUP = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const valid = (y, m, d) => (isValidKey(keyOf(y, m, d)) && y >= 2000 && y <= 2100 ? keyOf(y, m, d) : null);

/**
 * Parses a calendar date cell. Returns "YYYY-MM-DD" or null.
 * Accepts Excel date serials, JS Dates, ISO (2026-10-05, with or without time),
 * Indian dd/mm/yyyy and dd-mm-yyyy (also dd.mm.yyyy and 2-digit years),
 * "5 Oct 2026", "5-Oct-26", "Oct 5, 2026". Month-only values ("Oct 2026")
 * are NOT dates and return null (they are handled as monthly periods).
 */
function parseDateKey(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      // Excel serial (1900 date system); fractional part is the time of day
      const ms = Math.round((Math.floor(value) - 25569) * DAY_MS);
      const key = fromUTC(ms);
      return isValidKey(key) ? key : null;
    }
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateToKey(value);
  const s = String(value).trim().replace(/\s+/g, " ");
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/))) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(y, +m[2], +m[1]); // Indian format: day first
  }
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]+)\.?[\s,-]+(\d{2}|\d{4})$/)) && MONTH_LOOKUP[m[2].toLowerCase()]) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(y, MONTH_LOOKUP[m[2].toLowerCase()], +m[1]);
  }
  if ((m = s.match(/^([A-Za-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/)) && MONTH_LOOKUP[m[1].toLowerCase()]) {
    return valid(+m[3], MONTH_LOOKUP[m[1].toLowerCase()], +m[2]);
  }
  return null;
}

module.exports = {
  PRESETS,
  GRANULARITIES,
  todayKey,
  dateToKey,
  keyToDate,
  isValidKey,
  addDays,
  spanDays,
  daysBetween,
  parts,
  keyOf,
  monthStart,
  monthEnd,
  daysInMonth,
  monthsBetween,
  isWholeMonths,
  resolveRange,
  previousRange,
  rangeLabel,
  bucketOf,
  bucketsFor,
  fitsBucket,
  defaultGranularity,
  parseDateKey,
  quarterOfKey,
  yearOfKey,
  formatKey: fmt,
};
