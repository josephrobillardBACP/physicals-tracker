export type Membership = "Active" | "Unpaid";

export const CONTACT_STATUSES = [
  "Sent Message",
  "Left Voicemail",
  "Patient Calling Back",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** What is stored in the Outreach Status column. */
/** "Not Needed" = no annual physical required (e.g. a child on a family membership). */
export type OutreachStatus = "" | ContactStatus | "Completed" | "Not Needed";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // M/D/YYYY or ""
  membership: Membership;
  lastPhysical: string; // M/D/YYYY or ""
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
  scheduled: "Scheduled",
  completed: "Completed",
  upcoming: "Up to date",
  not_needed: "No physical needed",
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
  "Membership",
  "Last Physical",
  "Next Outreach",
  "Next Physical",
  "Outreach Status",
  "Notes",
  "Last Updated",
  "Updated By",
  "Hint ID",
] as const;
