import { Mail, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Panel } from "../lib/store";
import { Modal, Spinner } from "./ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Who gets the once-a-day "new physicals need booking" email for this practice.
 * Each practice has its own list and only hears about its own patients.
 */
export function NotificationsDialog({
  panel,
  onClose,
  onSave,
}: {
  panel: Panel;
  onClose: () => void;
  onSave: (emails: string[]) => Promise<void>;
}) {
  const [emails, setEmails] = useState<string[]>(panel.notifyEmails);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDraft = () => {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (!EMAIL.test(v)) {
      setError(`"${v}" doesn't look like an email address.`);
      return;
    }
    if (emails.includes(v)) {
      setError(`${v} is already on the list.`);
      return;
    }
    setEmails([...emails, v]);
    setDraft("");
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(emails);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Daily email"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />}
            Save
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Once a day at 7am, anyone listed here gets an email if a{" "}
        <span className="font-semibold text-ink">{panel.title}</span> patient has newly come due for outreach. Patients who
        have been waiting for a while do not trigger another email, so this only fires when something changes.
      </p>
      <p className="mt-2 text-xs text-muted">The email contains a count and a link. It never contains patient names.</p>

      <div className="mt-4">
        <label className="label" htmlFor="notify-add">
          Add an address
        </label>
        <div className="flex gap-2">
          <input
            id="notify-add"
            className="field flex-1"
            type="email"
            placeholder="frontdesk@blueangelclinical.com"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraft();
              }
            }}
          />
          <button className="btn-secondary" onClick={addDraft} disabled={!draft.trim()}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {emails.length === 0 && (
          <li className="rounded-xl bg-sand/60 px-3 py-3 text-sm text-muted">
            Nobody is on the list, so no email goes out for {panel.title}.
          </li>
        )}
        {emails.map((e) => (
          <li key={e} className="flex items-center gap-2 rounded-xl border border-navy/10 px-3 py-2">
            <Mail className="h-4 w-4 shrink-0 text-azure" aria-hidden="true" />
            <span className="flex-1 text-sm text-ink truncate">{e}</span>
            <button
              className="rounded-full p-1.5 text-muted hover:bg-red-50 hover:text-red-700"
              onClick={() => setEmails(emails.filter((x) => x !== e))}
              title={`Remove ${e}`}
              aria-label={`Remove ${e}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}
