import { nextOutreachFor } from "./dates";
import { newId } from "./logic";
import { DataSource, Panel } from "./store";
import { Membership, OutreachStatus, Patient, PatientInput, SHEET_HEADERS, User } from "./types";

/**
 * Google Sheets as the database. One tab per doctor; row 1 = SHEET_HEADERS.
 * Rows are located by the ID in column A at write time, so two staff members
 * editing at once cannot clobber each other's rows.
 */

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const LAST_COL = String.fromCharCode(64 + SHEET_HEADERS.length); // "M"

export class SheetsSource implements DataSource {
  constructor(
    private sheetId: string,
    private getToken: () => Promise<string>,
  ) {}

  // ---- HTTP ---------------------------------------------------------------

  private async call<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${API}/${this.sheetId}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (res.status === 401 && retry) {
      // token expired mid-session: getToken() refreshes, try once more
      return this.call<T>(path, init, false);
    }
    if (!res.ok) {
      let msg = `Google Sheets error ${res.status}`;
      try {
        const j = await res.json();
        msg = j?.error?.message ?? msg;
      } catch {
        /* ignore */
      }
      if (res.status === 403) msg = "You don't have access to the physicals spreadsheet. Ask Joseph to share it with you.";
      throw new Error(msg);
    }
    return (await res.json()) as T;
  }

  private q(title: string, range: string) {
    return encodeURIComponent(`'${title.replace(/'/g, "''")}'!${range}`);
  }

  // ---- Panels (tabs) ------------------------------------------------------

  async listPanels(): Promise<Panel[]> {
    const meta = await this.call<{ sheets: { properties: { sheetId: number; title: string; hidden?: boolean } }[] }>(
      "?fields=sheets.properties(sheetId,title,hidden)",
    );
    return meta.sheets
      .filter((s) => !s.properties.hidden)
      .map((s) => ({ id: String(s.properties.sheetId), title: s.properties.title }));
  }

  // ---- Read ---------------------------------------------------------------

  private async readAll(panel: Panel): Promise<{ rows: string[][] }> {
    const r = await this.call<{ values?: string[][] }>(
      `/values/${this.q(panel.title, `A1:${LAST_COL}`)}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
    );
    const rows = r.values ?? [];
    if (rows.length === 0 || (rows[0][0] ?? "").trim() !== "ID") {
      // brand-new tab: write the header row so staff can start adding patients
      if (rows.length === 0) {
        await this.call(`/values/${this.q(panel.title, "A1")}?valueInputOption=RAW`, {
          method: "PUT",
          body: JSON.stringify({ values: [[...SHEET_HEADERS]] }),
        });
        return { rows: [[...SHEET_HEADERS]] };
      }
      throw new Error(`Tab "${panel.title}" doesn't have the expected header row.`);
    }
    return { rows };
  }

  async listPatients(panel: Panel): Promise<Patient[]> {
    const { rows } = await this.readAll(panel);
    const out: Patient[] = [];
    for (let i = 1; i < rows.length; i++) {
      const p = fromRow(rows[i]);
      if (p) out.push(p);
    }
    return out;
  }

  /** 1-based sheet row number for a patient id, or -1. */
  private async findRow(panel: Panel, id: string): Promise<number> {
    const r = await this.call<{ values?: string[][] }>(`/values/${this.q(panel.title, "A:A")}`);
    const col = r.values ?? [];
    for (let i = 1; i < col.length; i++) if ((col[i]?.[0] ?? "") === id) return i + 1;
    return -1;
  }

  // ---- Write --------------------------------------------------------------

  async addPatient(panel: Panel, input: PatientInput, user: User): Promise<Patient> {
    const p: Patient = { ...input, id: newId(), updatedAt: new Date().toISOString(), updatedBy: user.email };
    await this.call(`/values/${this.q(panel.title, `A1:${LAST_COL}`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: [toRow(p)] }),
    });
    return p;
  }

  async updatePatient(panel: Panel, id: string, patch: Partial<PatientInput>, user: User): Promise<Patient> {
    const row = await this.findRow(panel, id);
    if (row < 0) throw new Error("That patient was removed by someone else. Refresh the list.");
    const cur = await this.call<{ values?: string[][] }>(`/values/${this.q(panel.title, `A${row}:${LAST_COL}${row}`)}`);
    const existing = fromRow(cur.values?.[0] ?? []);
    if (!existing || existing.id !== id) throw new Error("The list changed underneath you. Refresh and try again.");
    const next: Patient = { ...existing, ...patch, updatedAt: new Date().toISOString(), updatedBy: user.email };
    await this.call(`/values/${this.q(panel.title, `A${row}:${LAST_COL}${row}`)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ values: [toRow(next)] }),
    });
    return next;
  }

  async deletePatient(panel: Panel, id: string): Promise<void> {
    const row = await this.findRow(panel, id);
    if (row < 0) return; // already gone
    await this.call(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          { deleteDimension: { range: { sheetId: Number(panel.id), dimension: "ROWS", startIndex: row - 1, endIndex: row } } },
        ],
      }),
    });
  }
}

// ---- Row <-> Patient --------------------------------------------------------

function toRow(p: Patient): string[] {
  return [
    p.id,
    p.firstName,
    p.lastName,
    p.dob,
    p.membership,
    p.lastPhysical,
    nextOutreachFor(p.lastPhysical), // kept in the sheet for anyone reading it directly
    p.nextPhysical,
    p.outreachStatus,
    p.notes,
    p.updatedAt,
    p.updatedBy,
    p.hintId,
  ];
}

function fromRow(r: string[]): Patient | null {
  const g = (i: number) => (r[i] ?? "").toString().trim();
  const id = g(0);
  if (!id) return null;
  const membership = g(4) === "Unpaid" ? "Unpaid" : "Active";
  return {
    id,
    firstName: g(1),
    lastName: g(2),
    dob: g(3),
    membership: membership as Membership,
    lastPhysical: g(5),
    nextPhysical: g(7),
    outreachStatus: g(8) as OutreachStatus,
    notes: g(9),
    updatedAt: g(10),
    updatedBy: g(11),
    hintId: g(12),
  };
}
