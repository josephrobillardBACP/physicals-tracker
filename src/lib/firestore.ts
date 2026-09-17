import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { newId } from "./logic";
import { DataSource, Panel } from "./store";
import { normalizeOutreachStatus, Patient, PatientInput, User } from "./types";

/**
 * Firestore layout (a dedicated top-level collection, so it cannot collide
 * with the travel medicine workflow sharing the same project):
 *
 *   physicals/{panelId}                    { title, order }
 *   physicals/{panelId}/patients/{id}      one document per patient
 *
 * Patient documents carry stable ids, so two staff editing at the same time
 * can never write to each other's patient.
 */

const ROOT = "physicals";

/** Created the first time the app runs against an empty project. */
const DEFAULT_PANELS = [
  { id: "sujansky", title: "Dr. Sujansky", order: 1 },
  { id: "daniher", title: "Dr. Daniher", order: 2 },
];

function toEmails(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function patientsRef(panelId: string) {
  return collection(db(), ROOT, panelId, "patients");
}

function toPatient(id: string, d: Record<string, unknown>): Patient {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  return {
    id,
    firstName: s("firstName"),
    lastName: s("lastName"),
    dob: s("dob"),
    lastPhysical: s("lastPhysical"),
    nextOutreachOverride: s("nextOutreachOverride"),
    nextPhysical: s("nextPhysical"),
    outreachStatus: normalizeOutreachStatus(s("outreachStatus")),
    notes: s("notes"),
    updatedAt: s("updatedAt"),
    updatedBy: s("updatedBy"),
    hintId: s("hintId"),
  };
}

function fromInput(input: PatientInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    dob: input.dob,
    lastPhysical: input.lastPhysical,
    nextOutreachOverride: input.nextOutreachOverride,
    nextPhysical: input.nextPhysical,
    outreachStatus: input.outreachStatus,
    notes: input.notes,
    hintId: input.hintId,
  };
}

function friendly(e: unknown): Error {
  const code = (e as { code?: string }).code ?? "";
  if (code === "permission-denied") {
    return new Error("You don't have access to the physicals data. Ask Joseph to add your account.");
  }
  if (code === "unavailable") {
    return new Error("Can't reach the database. Check your connection and try again.");
  }
  return e instanceof Error ? e : new Error(String(e));
}

export class FirestoreSource implements DataSource {
  async listPanels(): Promise<Panel[]> {
    try {
      const snap = await getDocs(query(collection(db(), ROOT), orderBy("order")));
      if (snap.empty) {
        // First run: create the two practices so the app is usable immediately.
        const batch = writeBatch(db());
        for (const p of DEFAULT_PANELS) {
          batch.set(doc(db(), ROOT, p.id), { title: p.title, order: p.order });
        }
        await batch.commit();
        return DEFAULT_PANELS.map((p) => ({ id: p.id, title: p.title, notifyEmails: [] }));
      }
      return snap.docs.map((d) => ({
        id: d.id,
        title: (d.data().title as string) ?? d.id,
        notifyEmails: toEmails(d.data().notifyEmails),
      }));
    } catch (e) {
      throw friendly(e);
    }
  }

  async listPatients(panel: Panel): Promise<Patient[]> {
    try {
      const snap = await getDocs(patientsRef(panel.id));
      return snap.docs.map((d) => toPatient(d.id, d.data()));
    } catch (e) {
      throw friendly(e);
    }
  }

  /** Live updates, so several staff see each other's changes immediately. */
  subscribe(panel: Panel, onData: (patients: Patient[]) => void, onError: (e: Error) => void): () => void {
    return onSnapshot(
      patientsRef(panel.id),
      (snap) => onData(snap.docs.map((d) => toPatient(d.id, d.data()))),
      (e) => onError(friendly(e)),
    );
  }

  async addPatient(panel: Panel, input: PatientInput, user: User): Promise<Patient> {
    try {
      const id = newId();
      const now = new Date().toISOString();
      await setDoc(doc(patientsRef(panel.id), id), {
        ...fromInput(input),
        updatedAt: now,
        updatedBy: user.email,
        createdAt: serverTimestamp(),
      });
      return { ...input, id, updatedAt: now, updatedBy: user.email };
    } catch (e) {
      throw friendly(e);
    }
  }

  async updatePatient(panel: Panel, id: string, patch: Partial<PatientInput>, user: User): Promise<Patient> {
    try {
      const ref = doc(patientsRef(panel.id), id);
      const now = new Date().toISOString();
      await updateDoc(ref, { ...patch, updatedAt: now, updatedBy: user.email });
      const after = await getDoc(ref);
      if (!after.exists()) throw new Error("That patient was removed by someone else.");
      return toPatient(after.id, after.data());
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "not-found") throw new Error("That patient was removed by someone else.");
      throw friendly(e);
    }
  }

  async deletePatient(panel: Panel, id: string): Promise<void> {
    try {
      await deleteDoc(doc(patientsRef(panel.id), id));
    } catch (e) {
      throw friendly(e);
    }
  }

  async setNotifyEmails(panel: Panel, emails: string[]): Promise<void> {
    try {
      await updateDoc(doc(db(), ROOT, panel.id), { notifyEmails: emails });
    } catch (e) {
      throw friendly(e);
    }
  }

  /** Bulk load, used once to bring the spreadsheet roster across. */
  async importPatients(panel: Panel, rows: PatientInput[], user: User): Promise<number> {
    try {
      const now = new Date().toISOString();
      let written = 0;
      // Firestore allows 500 writes per batch.
      for (let i = 0; i < rows.length; i += 400) {
        const batch = writeBatch(db());
        for (const row of rows.slice(i, i + 400)) {
          batch.set(doc(patientsRef(panel.id), newId()), {
            ...fromInput(row),
            updatedAt: now,
            updatedBy: user.email,
            createdAt: serverTimestamp(),
          });
          written++;
        }
        await batch.commit();
      }
      return written;
    } catch (e) {
      throw friendly(e);
    }
  }
}
