/**
 * Asia/Kolkata (IST) date helpers.
 *
 * IST is a fixed UTC+05:30 offset with no daylight saving, so all conversions
 * can be done with plain arithmetic. Every Date stored in MongoDB stays a UTC
 * instant; these helpers only decide how an instant maps to an IST calendar
 * day / time and back.
 *
 * Mirror of server/utils/istDate.js — keep them in sync so the manager and
 * client dashboards and the API always agree on dates.
 */

const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const TIMEZONE = "Asia/Kolkata";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const toDate = (value) => {
  if (value instanceof Date) return new Date(value.getTime());
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Returns the IST wall-clock components of an instant. */
function toISTParts(value) {
  const d = toDate(value);
  if (!d) return null;
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1, // 1..12
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

/** Builds the UTC instant for an IST wall-clock time. Month is 1..12. */
function fromISTParts(year, month, day, hour = 0, minute = 0, second = 0) {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Parses "YYYY-MM-DD" + optional "HH:mm" as IST.
 * Also accepts a full ISO string with an explicit offset / Z (used as-is).
 * Returns null when invalid.
 */
function parseISTDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();

  // Full ISO timestamp with zone information -> trust it.
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    return toDate(raw);
  }

  // "YYYY-MM-DDTHH:mm" (no zone) -> interpret as IST.
  let datePart = raw;
  let timePart = timeStr ? String(timeStr).trim() : "";
  if (raw.includes("T")) {
    [datePart, timePart] = raw.split("T");
  }

  const dm = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const year = Number(dm[1]);
  const month = Number(dm[2]);
  const day = Number(dm[3]);

  let hour = 0;
  let minute = 0;
  if (timePart) {
    const tm = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!tm) return null;
    hour = Number(tm[1]);
    minute = Number(tm[2]);
    if (hour > 23 || minute > 59) return null;
  }

  const result = fromISTParts(year, month, day, hour, minute);
  // Reject impossible dates such as 2026-02-31
  const check = toISTParts(result);
  if (check.year !== year || check.month !== month || check.day !== day) return null;
  return result;
}

const pad = (n) => String(n).padStart(2, "0");

/** "26 October 2026" */
function formatISTDate(value) {
  const p = toISTParts(value);
  if (!p) return "";
  return `${p.day} ${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

/** "10:30 AM" */
function formatISTTime(value) {
  const p = toISTParts(value);
  if (!p) return "";
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h12}:${pad(p.minute)} ${p.hour < 12 ? "AM" : "PM"}`;
}

/** "26 October 2026, 10:30 AM IST" */
function formatISTDateTime(value) {
  if (!toDate(value)) return "";
  return `${formatISTDate(value)}, ${formatISTTime(value)} IST`;
}

/** "2026-10-26" (IST calendar day key) */
function istDayKey(value) {
  const p = toISTParts(value);
  if (!p) return "";
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** UTC instant of IST midnight that starts the IST day containing `value`. */
function startOfISTDay(value) {
  const p = toISTParts(value);
  if (!p) return null;
  return fromISTParts(p.year, p.month, p.day);
}

function endOfISTDay(value) {
  const start = startOfISTDay(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** IST month range [start, end] as UTC instants. Month 1..12 */
function istMonthRange(year, month) {
  const start = fromISTParts(year, month, 1);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(fromISTParts(nextYear, nextMonth, 1).getTime() - 1);
  return { start, end };
}

/**
 * Quarter helpers. `startMonth` = 1 gives calendar quarters (Q1 = Jan-Mar).
 * `startMonth` = 4 gives Indian financial-year quarters (Q1 = Apr-Jun),
 * where `year` is the FY start year (FY 2026-27 -> 2026).
 */
function quarterMonths(quarter, startMonth = 1) {
  const q = Number(quarter);
  if (![1, 2, 3, 4].includes(q)) return null;
  const months = [];
  for (let i = 0; i < 3; i++) {
    const offset = (q - 1) * 3 + i; // 0..11 from startMonth
    const m = ((startMonth - 1 + offset) % 12) + 1;
    const yearOffset = Math.floor((startMonth - 1 + offset) / 12);
    months.push({ month: m, yearOffset });
  }
  return months;
}

function quarterRange(year, quarter, startMonth = 1) {
  const months = quarterMonths(quarter, startMonth);
  if (!months) return null;
  const first = months[0];
  const last = months[2];
  const start = istMonthRange(year + first.yearOffset, first.month).start;
  const end = istMonthRange(year + last.yearOffset, last.month).end;
  return {
    start,
    end,
    months: months.map((m) => ({ year: year + m.yearOffset, month: m.month, name: MONTH_NAMES[m.month - 1] })),
  };
}

function quarterOf(value, startMonth = 1) {
  const p = toISTParts(value);
  if (!p) return null;
  const offset = (p.month - startMonth + 12) % 12;
  const quarter = Math.floor(offset / 3) + 1;
  const year = p.month >= startMonth ? p.year : p.year - 1;
  return { quarter, year };
}

export {
  IST_OFFSET_MINUTES,
  IST_OFFSET_MS,
  TIMEZONE,
  MONTH_NAMES,
  toISTParts,
  fromISTParts,
  parseISTDateTime,
  formatISTDate,
  formatISTTime,
  formatISTDateTime,
  istDayKey,
  startOfISTDay,
  endOfISTDay,
  istMonthRange,
  quarterMonths,
  quarterRange,
  quarterOf,
};

/** Value for <input type="date"> in IST */
export function toISTDateInput(value) {
  return istDayKey(value);
}

/** Value for <input type="time"> in IST */
export function toISTTimeInput(value) {
  const p = toISTParts(value);
  if (!p) return "";
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today's IST parts */
export function nowIST() {
  return toISTParts(new Date());
}

/** Adds days to an IST day key ("2026-10-26") and returns a new key. */
export function addDaysToKey(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  return istDayKey(new Date(fromISTParts(y, m, d, 12).getTime() + days * 86400000));
}

/** Monday-first week start key for an IST day key. */
export function weekStartKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  const wd = toISTParts(fromISTParts(y, m, d, 12)).weekday; // 0 = Sun
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDaysToKey(key, diff);
}

export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
