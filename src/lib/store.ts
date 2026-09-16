import { Patient, PatientInput, User } from "./types";

/** A doctor's panel. */
export interface Panel {
  id: string;
  title: string;
}

export interface DataSource {
  listPanels(): Promise<Panel[]>;
  listPatients(panel: Panel): Promise<Patient[]>;
  addPatient(panel: Panel, input: PatientInput, user: User): Promise<Patient>;
  updatePatient(panel: Panel, id: string, patch: Partial<PatientInput>, user: User): Promise<Patient>;
  deletePatient(panel: Panel, id: string): Promise<void>;

  /** Live updates where the backend supports them. Returns an unsubscribe function. */
  subscribe?(panel: Panel, onData: (patients: Patient[]) => void, onError: (e: Error) => void): () => void;

  /** One-time bulk load from a spreadsheet export. */
  importPatients?(panel: Panel, rows: PatientInput[], user: User): Promise<number>;
}
