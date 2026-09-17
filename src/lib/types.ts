export const CONTACT_STATUSES = [
  "Sent Message",
  "Left Voicemail",
  "Coordinating with Patient",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** What is stored in the Outreach Status column. */
/**
 * "Physical Booked" = the visit is on the calendar but has not happened yet.
 * "Not Needed"      = no annual physical required (e.g. a child on a family membership).
 */
export type OutreachStatus = "" | ContactStatus | "Physical Booked" | "Completed" | "Not Needed";

export const BOOKED: OutreachStatus = "Physical Booked";

/**
 * Statuses that earlier versions wrote. Records already in Firestore keep the
 * old wording until something rewrites them, so every read maps them forward.
 * Without this a patient someone is actively chasing would read as though no
 * outreach had started.
 */
const RENAMED: Record<string, OutreachStatus> = {
  "Patient Calling Back": "Coordinating with Patient",
};

export function normalizeOutreachStatus(raw: string): OutreachStatus {
  return (RENAMED[raw] ?? raw) as OutreachStatus;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // M/D/YYYY or ""
  lastPhysical: string; // M/D/YYYY or ""
  /** Set only when staff typed an outreach date by hand; "" means use the 11-month rule. */
  nextOutreachOverride: string;
  nextPhysical: string; // M/D/YYYY or "" (the scheduled appointment)
  outreachStatus: OutreachStatus;
  notes: string;
  updatedAt: string; // ISO
  updatedBy: string;
  hintId: string;
}

export type PatientInput = Omit<Patient, "id" | "updatedAt" | "updatedBy">;

/** Derived, never stored. Order here is the default sort order. */
export type Stage = "due" | "in_progress" | "scheduled" | "completed" | "upcoming" | "not_needed";

export const STAGE_ORDER: Stage[] = ["due", "in_progress", "scheduled", "completed", "upcoming", "not_needed"];

export const STAGE_LABEL: Record<Stage, string> = {
  due: "Needs outreach",
  in_progress: "In progress",
  scheduled: "Physical booked",
  completed: "Completed",
  upcoming: "Up to date",
  not_needed: "No physical needed",
};

export type SortMode = "action" | "name" | "recent" | "oldest";

export const SORT_LABEL: Record<SortMode, string> = {
  action: "Needs attention first",
  name: "Last name (A–Z)",
  recent: "Most recent physical",
  oldest: "Oldest physical",
};

export interface User {
  email: string;
  name: string;
  picture?: string;
}

/** Column order in the sheet. Row 1 is this header. */
export const SHEET_HEADERS = [
  "ID",
  "First Name",
  "Last Name",
  "Date of Birth",
  "Last Physical",
  "Next Outreach",
  "Next Physical",
  "Outreach Status",
  "Notes",
  "Last Updated",
  "Updated By",
  "Hint ID",
] as const;
