import { Check, Pencil, RotateCcw, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { fromInputDate, toInputDate } from "../lib/dates";

/**
 * A date shown as text that staff can correct in place. Double-click it, or
 * click the pencil that appears on hover, or press Enter when it has keyboard
 * focus. Enter saves, Escape cancels; nothing saves until they say so.
 */
export function EditableDate({
  value,
  onSave,
  onReset,
  label,
  children,
  disabled,
}: {
  /** Current value in M/D/YYYY form, or "" when unset. */
  value: string;
  onSave: (next: string) => void;
  /** Offered while editing when the value can fall back to being calculated. */
  onReset?: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toInputDate(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(toInputDate(value));
      // Let the input mount before focusing it.
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    const next = fromInputDate(draft);
    if (next !== value) onSave(next);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="date"
          className="rounded-lg border border-azure bg-white px-2 py-1 text-sm text-ink"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          aria-label={label}
        />
        <button className="rounded-full p-1 text-teal hover:bg-teal/10" onClick={commit} title="Save" aria-label="Save">
          <Check className="h-4 w-4" />
        </button>
        {onReset && (
          <button
            className="rounded-full p-1 text-muted hover:bg-navy/5"
            onClick={() => {
              setEditing(false);
              onReset();
            }}
            title="Go back to the calculated date"
            aria-label="Go back to the calculated date"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          className="rounded-full p-1 text-muted hover:bg-navy/5"
          onClick={() => setEditing(false)}
          title="Cancel"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`group/edit inline-flex items-start gap-1 rounded-md ${disabled ? "" : "cursor-text hover:bg-navy/5"} -mx-1 px-1`}
      onDoubleClick={disabled ? undefined : () => setEditing(true)}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setEditing(true);
              }
            }
      }
      tabIndex={disabled ? undefined : 0}
      role={disabled ? undefined : "button"}
      title={disabled ? undefined : `${label} — double-click to edit`}
    >
      {children}
      {!disabled && (
        <Pencil
          className="mt-0.5 h-3 w-3 shrink-0 text-muted opacity-0 group-hover/edit:opacity-100 transition-opacity"
          aria-hidden="true"
        />
      )}
    </span>
  );
}
