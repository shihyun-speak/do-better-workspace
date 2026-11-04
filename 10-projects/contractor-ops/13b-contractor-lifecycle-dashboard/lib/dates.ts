const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) {
    return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed);
  if (slash) {
    const yr = +slash[3] < 100 ? 2000 + +slash[3] : +slash[3];
    return new Date(Date.UTC(yr, +slash[1] - 1, +slash[2]));
  }
  const longForm = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(trimmed);
  if (longForm) {
    const m = MONTHS[longForm[1].toLowerCase()];
    if (m !== undefined) return new Date(Date.UTC(+longForm[3], m, +longForm[2]));
  }
  const shortForm = /^([A-Za-z]+)\s+(\d{1,2})$/.exec(trimmed);
  if (shortForm) {
    const m = MONTHS[shortForm[1].toLowerCase()];
    if (m !== undefined) {
      return new Date(Date.UTC(new Date().getUTCFullYear(), m, +shortForm[2]));
    }
  }
  const ts = Date.parse(trimmed);
  if (!Number.isNaN(ts)) return new Date(ts);
  return null;
}

export function workingDaysUntil(target: Date, today: Date = new Date()): number {
  const a = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const b = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  if (b < a) {
    return -workingDaysBetween(b, a);
  }
  return workingDaysBetween(a, b);
}

function workingDaysBetween(start: Date, end: Date): number {
  let days = 0;
  const cur = new Date(start);
  while (cur < end) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) days += 1;
  }
  return days;
}

export function fmtDate(d: Date | null): string {
  if (!d) return "";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Compact date format for the Active Roster table: drops the year when it
 * matches the current year. "MM/DD" most of the time, "MM/DD/YYYY" when the
 * date is in a different year.
 */
export function fmtDateShort(d: Date | null): string {
  if (!d) return "";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  return yyyy === thisYear ? `${mm}/${dd}` : `${mm}/${dd}/${yyyy}`;
}

export function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
