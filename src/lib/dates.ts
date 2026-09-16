/** Dates are stored in the sheet as M/D/YYYY text (what Google Sheets shows in a US locale). */

export function parseDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const d = new Date(y, Number(m[1]) - 1, Number(m[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toSheetDate(d: Date | null): string {
  if (!d) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** yyyy-mm-dd for <input type="date"> */
export function toInputDate(s: string): string {
  const d = parseDate(s);
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function fromInputDate(s: string): string {
  return toSheetDate(parseDate(s));
}

export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * Outreach is due at the end of the month 11 months after the last physical.
 * e.g. 8/1/2025 -> 7/31/2026, 2/5/2025 -> 1/31/2026 (matches the original sheet).
 */
export function nextOutreachFor(lastPhysical: string): string {
  const d = parseDate(lastPhysical);
  if (!d) return "";
  return toSheetDate(new Date(d.getFullYear(), d.getMonth() + 12, 0));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatShort(s: string): string {
  const d = parseDate(s);
  if (!d) return "—";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "3 weeks ago", "in 2 months", "today" */
export function relative(s: string): string {
  const d = parseDate(s);
  if (!d) return "";
  const diff = daysBetween(today(), d);
  const abs = Math.abs(diff);
  let unit: string;
  let n: number;
  if (abs < 1) return "today";
  if (abs < 14) {
    n = abs;
    unit = "day";
  } else if (abs < 60) {
    n = Math.round(abs / 7);
    unit = "week";
  } else if (abs < 365) {
    n = Math.round(abs / 30.4);
    unit = "month";
  } else {
    n = Math.round((abs / 365) * 10) / 10;
    unit = "year";
  }
  const label = `${n} ${unit}${n === 1 ? "" : "s"}`;
  return diff < 0 ? `${label} ago` : `in ${label}`;
}

export function ageFrom(dob: string): number | null {
  const d = parseDate(dob);
  if (!d) return null;
  const t = today();
  let age = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--;
  return age;
}
