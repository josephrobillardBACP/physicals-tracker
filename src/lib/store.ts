import { Patient, PatientInput, User } from "./types";

/** A doctor's panel = one tab in the spreadsheet. */
export interface Panel {
  id: string; // sheetId (number as string) or demo key
  title: string; // tab title, shown on the toggle
}

export interface DataSource {
  listPanels(): Promise<Panel[]>;
  listPatients(panel: Panel): Promise<Patient[]>;
  addPatient(panel: Panel, input: PatientInput, user: User): Promise<Patient>;
  updatePatient(panel: Panel, id: string, patch: Partial<PatientInput>, user: User): Promise<Patient>;
  deletePatient(panel: Panel, id: string): Promise<void>;
}
