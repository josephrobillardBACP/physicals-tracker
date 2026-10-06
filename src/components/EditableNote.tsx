import { Check, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A free-text note staff can write straight into the row. Click it (or press
 * Enter when it has keyboard focus) to edit.
 *
 * Enter saves and Shift+Enter starts a new line, so a quick note takes one
 * keystroke while a longer one is still possible. Escape abandons the edit.
 */
export function EditableNote({
  value,
  onSave,
  label,
  disabled,
}: {
  value: string;
  onSave: (next: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(value);
    const t = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onSave(next);
  };

  if (editing) {
    return (
      <div className="flex items-start gap-1">
        <textarea
          ref={ref}
          rows={2}
          className="w-full min-w-[10rem] rounded-lg border border-azure bg-white px-2 py-1 text-sm text-ink resize-y"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          aria-label={label}
          placeholder="Enter to save, Shift+Enter for a new line"
        />
        <div className="flex flex-col gap-0.5 shrink-0">
          <button className="rounded-full p-1 text-teal hover:bg-teal/10" onClick={commit} title="Save" aria-label="Save note">
            <Check className="h-4 w-4" />
          </button>
          <button
            className="rounded-full p-1 text-muted hover:bg-navy/5"
            onClick={() => setEditing(false)}
            title="Cancel"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      className={`group/note flex w-full items-start gap-1 rounded-md px-1 -mx-1 text-left ${disabled ? "" : "hover:bg-navy/5"}`}
      onClick={disabled ? undefined : () => setEditing(true)}
      title={value || undefined}
      aria-label={value ? `${label}: ${value}` : `Add a ${label.toLowerCase()}`}
      disabled={disabled}
    >
      {value ? (
        // Two lines at most, so one long note cannot stretch the whole row.
        <span className="line-clamp-2 text-sm text-ink whitespace-pre-wrap">{value}</span>
      ) : (
        <span className="text-sm text-muted/70 italic">Add note</span>
      )}
      {!disabled && (
        <Pencil
          className="mt-0.5 h-3 w-3 shrink-0 text-muted opacity-0 group-hover/note:opacity-100 transition-opacity"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
