/**
 * Whether a patient currently needs outreach.
 *
 * KEEP IN SYNC with `src/lib/dates.ts` and `src/lib/logic.ts` in the app. This
 * is a deliberate copy: Cloud Functions deploy only this directory, so it
 * cannot import from the app's source. The rule is small and stable, but if
 * the outreach rule ever changes it must change in both places.
 */

export interface PatientRecord {
  lastPhysical?: string;
  nextOutreachOverride?: string;
  nextPhysical?: string;
  outreachStatus?: string;
}

// Both spellings: "Patient Calling Back" was the earlier wording and may still
// sit in records that nothing has rewritten yet.
const CONTACT_STATUSES = ["Sent Message", "Left Voicemail", "Coordinating with Patient", "Patient Calling Back"];

export function parseDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let y = Number(m[3]);
  if (y < 100) y += y < 50 ? 2000 : 1900;
  const d = new Date(y, Number(m[1]) - 1, Number(m[2]));
  return isNaN(d.getTime()) ? null : d;
}

/** Keep in step with OUTREACH_MONTHS in src/lib/dates.ts. */
const OUTREACH_MONTHS = 10;

/** End of the month, OUTREACH_MONTHS after the last physical. */
export function nextOutreachFor(lastPhysical: string | undefined): string {
  const d = parseDate(lastPhysical);
  if (!d) return "";
  const end = new Date(d.getFullYear(), d.getMonth() + OUTREACH_MONTHS + 1, 0);
  return `${end.getMonth() + 1}/${end.getDate()}/${end.getFullYear()}`;
}

export function outreachDueFor(p: PatientRecord): string {
  return p.nextOutreachOverride || nextOutreachFor(p.lastPhysical);
}

/**
 * True when this patient is in the "needs outreach" state: nobody has started
 * contacting them, no visit is booked, and the outreach date has arrived.
 */
export function needsOutreach(p: PatientRecord, asOf: Date): boolean {
  const status = p.outreachStatus ?? "";
  if (status === "Not Needed" || status === "Completed") return false;
  if (p.nextPhysical || status === "Physical Booked") return false;
  if (CONTACT_STATUSES.includes(status)) return false;
  const due = parseDate(outreachDueFor(p));
  if (!due) return true; // nothing on record -> reach out now
  return due <= asOf;
}
