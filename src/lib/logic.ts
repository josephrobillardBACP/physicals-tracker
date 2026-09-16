import { nextOutreachFor, parseDate, today, toSheetDate } from "./dates";
import { CONTACT_STATUSES, Patient, Stage, STAGE_ORDER } from "./types";

export function stageOf(p: Patient): Stage {
  if (p.outreachStatus === "Not Needed") return "not_needed";
  if (p.outreachStatus === "Completed") return "completed";
  if (p.nextPhysical) return "scheduled";
  if ((CONTACT_STATUSES as readonly string[]).includes(p.outreachStatus)) return "in_progress";
  const due = parseDate(nextOutreachFor(p.lastPhysical));
  if (!due) return "due"; // no physical on record -> reach out now
  return due <= today() ? "due" : "upcoming";
}

function sortKey(p: Patient, stage: Stage): number {
  const far = 8.64e15;
  switch (stage) {
    case "due":
    case "in_progress":
    case "upcoming": {
      const d = parseDate(nextOutreachFor(p.lastPhysical));
      return d ? d.getTime() : -far; // never-seen patients float to top
    }
    case "scheduled":
    case "completed":
      return parseDate(p.nextPhysical)?.getTime() ?? far;
    case "not_needed":
      return 0;
  }
}

/** Action-needed first, then by date; up-to-date patients sink to the bottom. */
export function sortPatients(list: Patient[]): Patient[] {
  return [...list]
    .map((p) => ({ p, s: stageOf(p) }))
    .sort((a, b) => {
      const so = STAGE_ORDER.indexOf(a.s) - STAGE_ORDER.indexOf(b.s);
      if (so !== 0) return so;
      const k = sortKey(a.p, a.s) - sortKey(b.p, b.s);
      if (k !== 0) return k;
      return `${a.p.lastName} ${a.p.firstName}`.localeCompare(`${b.p.lastName} ${b.p.firstName}`);
    })
    .map((x) => x.p);
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
