import { nextOutreachFor, parseDate, today, toSheetDate } from "./dates";
import { BOOKED, CONTACT_STATUSES, Patient, SortMode, Stage, STAGE_ORDER } from "./types";

/** The outreach date actually in force: a manual edit if there is one, else the rule. */
export function outreachDueFor(p: Patient): string {
  return p.nextOutreachOverride || nextOutreachFor(p.lastPhysical);
}

export function isOutreachManual(p: Patient): boolean {
  return Boolean(p.nextOutreachOverride);
}

export function stageOf(p: Patient): Stage {
  if (p.outreachStatus === "Not Needed") return "not_needed";
  if (p.outreachStatus === "Completed") return "completed";
  if (p.nextPhysical || p.outreachStatus === BOOKED) return "scheduled";
  if ((CONTACT_STATUSES as readonly string[]).includes(p.outreachStatus)) return "in_progress";
  const due = parseDate(outreachDueFor(p));
  if (!due) return "due"; // nothing on record -> reach out now
  return due <= today() ? "due" : "upcoming";
}

function sortKey(p: Patient, stage: Stage): number {
  const far = 8.64e15;
  switch (stage) {
    case "due":
    case "in_progress":
    case "upcoming": {
      const d = parseDate(outreachDueFor(p));
      return d ? d.getTime() : -far; // never-seen patients float to top
    }
    case "scheduled":
    case "completed":
      return parseDate(p.nextPhysical)?.getTime() ?? far;
    case "not_needed":
      return 0;
  }
}

function byName(a: Patient, b: Patient): number {
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, undefined, { sensitivity: "base" });
}

/** Patients with no physical on record sort as the oldest possible. */
function lastPhysicalTime(p: Patient): number {
  return parseDate(p.lastPhysical)?.getTime() ?? -8.64e15;
}

export function sortPatients(list: Patient[], mode: SortMode = "action"): Patient[] {
  const out = [...list];
  switch (mode) {
    case "name":
      return out.sort(byName);
    case "recent":
      return out.sort((a, b) => lastPhysicalTime(b) - lastPhysicalTime(a) || byName(a, b));
    case "oldest":
      return out.sort((a, b) => lastPhysicalTime(a) - lastPhysicalTime(b) || byName(a, b));
    case "action":
      return out
        .map((p) => ({ p, s: stageOf(p) }))
        .sort((a, b) => {
          const so = STAGE_ORDER.indexOf(a.s) - STAGE_ORDER.indexOf(b.s);
          if (so !== 0) return so;
          const k = sortKey(a.p, a.s) - sortKey(b.p, b.s);
          if (k !== 0) return k;
          return byName(a.p, b.p);
        })
        .map((x) => x.p);
  }
}

/** True once the visit is booked but the date has not been filled in yet. */
export function bookedWithoutDate(p: Patient): boolean {
  return p.outreachStatus === BOOKED && !p.nextPhysical;
}

/** Roll a confirmed-complete patient forward to next year. */
export function rollForward(p: Patient): Partial<Patient> {
  const done = p.nextPhysical || toSheetDate(today());
  return { lastPhysical: done, nextPhysical: "", outreachStatus: "" };
}

export function matches(p: Patient, q: string): boolean {
  if (!q) return true;
  const hay = `${p.firstName} ${p.lastName} ${p.lastName} ${p.firstName} ${p.dob} ${p.notes}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}
