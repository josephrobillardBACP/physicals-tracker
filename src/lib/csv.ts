import { parseDate, toSheetDate } from "./dates";
import { titleCase } from "./logic";
import { CONTACT_STATUSES, OutreachStatus, PatientInput } from "./types";

/** Minimal RFC-4180 reader: handles quoted fields, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      /* ignore */
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const ALIASES: Record<string, string[]> = {
  firstName: ["first name", "firstname", "first"],
  lastName: ["last name", "lastname", "last", "surname"],
  dob: ["date of birth", "dob", "birth date", "birthdate"],
  lastPhysical: ["last physical", "last physical date"],
  nextPhysical: ["next physical", "next physical date", "scheduled"],
  outreachStatus: ["outreach status", "status"],
  notes: ["notes", "note", "comments"],
  hintId: ["hint id", "id", "patient id"],
};

function indexOfColumn(header: string[], field: string): number {
  const norm = header.map((h) => h.trim().toLowerCase());
  for (const alias of ALIASES[field]) {
    const i = norm.indexOf(alias);
    if (i !== -1) return i;
  }
  return -1;
}

function cleanDate(v: string): string {
  const t = v.trim();
  if (!t || t.toUpperCase() === "NA") return "";
  return toSheetDate(parseDate(t));
}

function cleanStatus(v: string): OutreachStatus {
  const t = v.trim().toLowerCase();
  if (!t) return "";
  if (t.includes("child") || t === "not needed") return "Not Needed";
  if (t.includes("book")) return "Physical Booked";
  if (t === "completed" || t === "complete") return "Completed";
  const hit = CONTACT_STATUSES.find((s) => s.toLowerCase() === t);
  return hit ?? "";
}

export interface CsvImport {
  rows: PatientInput[];
  skipped: number;
  /** Fields the file did not contain, so the caller can warn. */
  missing: string[];
}

/**
 * Turns a spreadsheet export into patient records. Column order does not
 * matter; headers are matched by name. Rows without any name are skipped.
 */
export function readPatientCsv(text: string): CsvImport {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], skipped: 0, missing: ["First Name", "Last Name"] };

  // The header is the first row that names both a first and a last name column.
  let headerAt = table.findIndex((r) => indexOfColumn(r, "firstName") !== -1 && indexOfColumn(r, "lastName") !== -1);
  if (headerAt === -1) headerAt = 0;
  const header = table[headerAt];

  const at: Record<string, number> = {};
  const missing: string[] = [];
  for (const field of Object.keys(ALIASES)) {
    at[field] = indexOfColumn(header, field);
    if (at[field] === -1 && (field === "firstName" || field === "lastName")) missing.push(field);
  }
  if (missing.length) return { rows: [], skipped: 0, missing: ["First Name", "Last Name"] };

  const get = (r: string[], f: string) => (at[f] === -1 ? "" : (r[at[f]] ?? "").trim());

  const rows: PatientInput[] = [];
  let skipped = 0;
  for (const r of table.slice(headerAt + 1)) {
    const first = get(r, "firstName");
    const last = get(r, "lastName");
    if (!first && !last) {
      skipped++;
      continue;
    }
    rows.push({
      firstName: titleCase(first),
      lastName: titleCase(last),
      dob: cleanDate(get(r, "dob")),
      lastPhysical: cleanDate(get(r, "lastPhysical")),
      // Deliberately not imported: the 11-month rule recomputes it.
      nextOutreachOverride: "",
      nextPhysical: cleanDate(get(r, "nextPhysical")),
      outreachStatus: cleanStatus(get(r, "outreachStatus")),
      notes: get(r, "notes"),
      hintId: get(r, "hintId"),
    });
  }
  return { rows, skipped, missing: [] };
}
