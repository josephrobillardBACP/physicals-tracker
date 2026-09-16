import { toSheetDate } from "./dates";
import { newId } from "./logic";
import { DataSource, Panel } from "./store";
import { Patient, PatientInput, User } from "./types";

/** Local, in-memory data for previewing the UI without Google. Fictional names only. */

function d(offsetDays: number): string {
  const t = new Date();
  t.setDate(t.getDate() + offsetDays);
  return toSheetDate(t);
}

function mk(p: Partial<Patient> & Pick<Patient, "firstName" | "lastName">): Patient {
  return {
    id: newId(),
    dob: "",
    lastPhysical: "",
    nextOutreachOverride: "",
    nextPhysical: "",
    outreachStatus: "",
    notes: "",
    updatedAt: new Date().toISOString(),
    updatedBy: "demo@example.com",
    hintId: "",
    ...p,
  };
}

// Last physical ~ N days ago -> outreach due at month-end 11 months later.
const seed: Record<string, Patient[]> = {
  "Dr. Sujansky": [
    mk({ firstName: "Harold", lastName: "Whitcombe", dob: "3/14/1941", lastPhysical: d(-420) }),
    mk({ firstName: "Marjorie", lastName: "Ellsworth", dob: "9/2/1950", lastPhysical: d(-380), outreachStatus: "Left Voicemail", notes: "Prefers mornings." }),
    mk({ firstName: "Desmond", lastName: "Okafor", dob: "11/30/1962", lastPhysical: d(-370), outreachStatus: "Sent Message" }),
    mk({ firstName: "Lucinda", lastName: "Pratt", dob: "1/8/1938", lastPhysical: d(-400) }),
    mk({ firstName: "Teodoro", lastName: "Mancini", dob: "6/21/1957" }),
    mk({ firstName: "Priya", lastName: "Raghunathan", dob: "4/4/1979", lastPhysical: d(-365), nextPhysical: d(12) }),
    mk({ firstName: "Winifred", lastName: "Castellanos", dob: "7/19/1934", lastPhysical: d(-390), outreachStatus: "Patient Calling Back" }),
    mk({ firstName: "Bartholomew", lastName: "Quist", dob: "12/12/1969", lastPhysical: d(-372), nextPhysical: d(-2), outreachStatus: "Completed" }),
    mk({ firstName: "Anneliese", lastName: "Fortner", dob: "2/27/1946", lastPhysical: d(-200) }),
    mk({ firstName: "Rufus", lastName: "Delacroix", dob: "8/8/1955", lastPhysical: d(-150) }),
    mk({ firstName: "Clementine", lastName: "Aberforth", dob: "10/3/1990", lastPhysical: d(-90) }),
    mk({ firstName: "Ignatius", lastName: "Vellacourt", dob: "5/17/1948", lastPhysical: d(-30) }),
    mk({ firstName: "Ottoline", lastName: "Brannigan", dob: "9/9/1972", lastPhysical: d(-10) }),
  ],
  "Dr. Daniher": [
    mk({ firstName: "Percival", lastName: "Lindqvist", dob: "4/22/1960", lastPhysical: d(-400) }),
    mk({ firstName: "Rosalind", lastName: "Achebe", dob: "8/15/1985", lastPhysical: d(-120) }),
  ],
};

const wait = () => new Promise((r) => setTimeout(r, 150));

export class DemoSource implements DataSource {
  private data: Record<string, Patient[]> = structuredClone(seed);
  private notify: Record<string, string[]> = { "Dr. Sujansky": ["frontdesk@example.com"], "Dr. Daniher": [] };

  async listPanels(): Promise<Panel[]> {
    return Object.keys(this.data).map((k) => ({ id: k, title: k, notifyEmails: this.notify[k] ?? [] }));
  }

  async setNotifyEmails(panel: Panel, emails: string[]): Promise<void> {
    await wait();
    this.notify[panel.id] = emails;
  }
  async listPatients(panel: Panel): Promise<Patient[]> {
    await wait();
    return structuredClone(this.data[panel.id] ?? []);
  }
  async addPatient(panel: Panel, input: PatientInput, user: User): Promise<Patient> {
    await wait();
    const p: Patient = { ...input, id: newId(), updatedAt: new Date().toISOString(), updatedBy: user.email };
    (this.data[panel.id] ??= []).push(p);
    return structuredClone(p);
  }
  async updatePatient(panel: Panel, id: string, patch: Partial<PatientInput>, user: User): Promise<Patient> {
    await wait();
    const list = this.data[panel.id] ?? [];
    const i = list.findIndex((p) => p.id === id);
    if (i < 0) throw new Error("Patient no longer exists. Refresh the list.");
    list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString(), updatedBy: user.email };
    return structuredClone(list[i]);
  }
  async deletePatient(panel: Panel, id: string): Promise<void> {
    await wait();
    this.data[panel.id] = (this.data[panel.id] ?? []).filter((p) => p.id !== id);
  }
}
