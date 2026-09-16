import { useState } from "react";
import { fromInputDate } from "../lib/dates";
import { titleCase } from "../lib/logic";
import { PatientInput } from "../lib/types";
import { Modal, Spinner } from "./ui";

export function AddPatientDialog({
  doctor,
  onClose,
  onSave,
}: {
  doctor: string;
  onClose: () => void;
  onSave: (input: PatientInput) => Promise<void>;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dob, setDob] = useState("");
  const [lastPhysical, setLastPhysical] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = first.trim() && last.trim();

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        firstName: titleCase(first.trim()),
        lastName: titleCase(last.trim()),
        dob: fromInputDate(dob),
            lastPhysical: fromInputDate(lastPhysical),
        nextOutreachOverride: "",
        nextPhysical: "",
        outreachStatus: "",
        notes: notes.trim(),
        hintId: "",
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add patient"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="add-patient-form" className="btn-primary" disabled={!valid || busy}>
            {busy && <Spinner className="h-4 w-4" />}
            Add to {doctor}
          </button>
        </>
      }
    >
      <form
        id="add-patient-form"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          // Enter in any single-line field submits (belt and braces for implicit submission)
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
            save();
          }
        }}
      >
        <div>
          <label className="label" htmlFor="ap-first">First name</label>
          <input id="ap-first" className="field" autoFocus value={first} onChange={(e) => setFirst(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="ap-last">Last name</label>
          <input id="ap-last" className="field" value={last} onChange={(e) => setLast(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="ap-dob">Date of birth</label>
          <input id="ap-dob" className="field" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ap-lp">Last physical</label>
          <input id="ap-lp" className="field" type="date" value={lastPhysical} onChange={(e) => setLastPhysical(e.target.value)} />
          <p className="mt-1 text-xs text-muted">Leave blank if unknown. The patient will show as “Needs outreach” right away.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ap-notes">Notes</label>
          <textarea id="ap-notes" className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Best time to call, preferred phone, etc." />
        </div>
        {error && <p className="sm:col-span-2 text-sm text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}
