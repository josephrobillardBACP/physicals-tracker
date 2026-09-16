import { Trash2 } from "lucide-react";
import { useState } from "react";
import { ageFrom, formatShort, fromInputDate, nextOutreachFor, toInputDate } from "../lib/dates";
import { stageOf } from "../lib/logic";
import { CONTACT_STATUSES, Membership, OutreachStatus, Patient, PatientInput, STAGE_LABEL } from "../lib/types";
import { Modal, Pill, Spinner } from "./ui";

export function PatientDrawer({
  patient,
  onClose,
  onSave,
  onDelete,
}: {
  patient: Patient;
  onClose: () => void;
  onSave: (patch: Partial<PatientInput>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [first, setFirst] = useState(patient.firstName);
  const [last, setLast] = useState(patient.lastName);
  const [dob, setDob] = useState(toInputDate(patient.dob));
  const [membership, setMembership] = useState<Membership>(patient.membership);
  const [lastPhysical, setLastPhysical] = useState(toInputDate(patient.lastPhysical));
  const [nextPhysical, setNextPhysical] = useState(toInputDate(patient.nextPhysical));
  const [status, setStatus] = useState<OutreachStatus>(patient.outreachStatus);
  const [notes, setNotes] = useState(patient.notes);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft: Patient = {
    ...patient,
    firstName: first,
    lastName: last,
    dob: fromInputDate(dob),
    membership,
    lastPhysical: fromInputDate(lastPhysical),
    nextPhysical: fromInputDate(nextPhysical),
    outreachStatus: status,
    notes,
  };
  const stage = stageOf(draft);
  const age = ageFrom(draft.dob);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id: _id, updatedAt: _u, updatedBy: _b, ...input } = draft;
      await onSave({ ...input, firstName: first.trim(), lastName: last.trim(), notes: notes.trim() });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`${patient.firstName} ${patient.lastName}`}
      onClose={onClose}
      wide
      footer={
        confirmDelete ? (
          <>
            <span className="text-sm text-red-800 self-center mr-auto">Remove this patient from the list? This can’t be undone.</span>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Keep
            </button>
            <button className="btn-danger" onClick={del} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              Yes, remove
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost text-red-700 mr-auto" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Remove patient
            </button>
            <button className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={busy || !first.trim() || !last.trim()}>
              {busy && <Spinner className="h-4 w-4" />}
              Save changes
            </button>
          </>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-muted">
        <Pill stage={stage}>{STAGE_LABEL[stage]}</Pill>
        {draft.lastPhysical && (
          <span>
            Next outreach <span className="font-semibold text-ink">{formatShort(nextOutreachFor(draft.lastPhysical))}</span>
          </span>
        )}
        {age !== null && <span>· Age {age}</span>}
        {patient.hintId && <span className="font-mono text-xs">· {patient.hintId}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="pd-first">First name</label>
          <input id="pd-first" className="field" value={first} onChange={(e) => setFirst(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pd-last">Last name</label>
          <input id="pd-last" className="field" value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pd-dob">Date of birth</label>
          <input id="pd-dob" className="field" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pd-mem">Membership</label>
          <select id="pd-mem" className="field" value={membership} onChange={(e) => setMembership(e.target.value as Membership)}>
            <option>Active</option>
            <option>Unpaid</option>
          </select>
        </div>

        <div className="sm:col-span-2 h-px bg-navy/10 my-1" />

        <div>
          <label className="label" htmlFor="pd-lp">Last physical</label>
          <input id="pd-lp" className="field" type="date" value={lastPhysical} onChange={(e) => setLastPhysical(e.target.value)} />
          <p className="mt-1 text-xs text-muted">Outreach is due at the end of the month, 11 months later.</p>
        </div>
        <div>
          <label className="label" htmlFor="pd-np">Next physical (scheduled)</label>
          <input id="pd-np" className="field" type="date" value={nextPhysical} onChange={(e) => setNextPhysical(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pd-status">Outreach status</label>
          <select id="pd-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as OutreachStatus)}>
            <option value="">Not started</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Completed">Completed (awaiting confirmation)</option>
            <option value="Not Needed">No physical needed (e.g. child)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="pd-notes">Notes</label>
          <textarea id="pd-notes" className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Best time to call, preferred phone, etc." />
        </div>
      </div>

      {patient.updatedAt && (
        <p className="mt-4 text-xs text-muted">
          Last updated {new Date(patient.updatedAt).toLocaleString()} {patient.updatedBy && `by ${patient.updatedBy}`}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}
