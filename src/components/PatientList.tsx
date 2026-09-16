import { CalendarPlus, Check, ChevronRight, Undo2, X } from "lucide-react";
import { ageFrom, formatShort, fromInputDate, parseDate, relative, today, toInputDate } from "../lib/dates";
import { bookedWithoutDate, isOutreachManual, outreachDueFor, stageOf } from "../lib/logic";
import { BOOKED, CONTACT_STATUSES, OutreachStatus, Patient, PatientInput, Stage, STAGE_LABEL } from "../lib/types";
import { EditableDate } from "./EditableDate";
import { Pill, Spinner } from "./ui";

export interface RowActions {
  onOpen: (p: Patient) => void;
  onPatch: (p: Patient, patch: Partial<PatientInput>, msg?: string) => void;
  onConfirmComplete: (p: Patient) => void;
  onRemove: (p: Patient) => void;
}

function stageDetail(p: Patient, stage: Stage): string {
  switch (stage) {
    case "in_progress":
      return p.outreachStatus;
    case "scheduled":
      return bookedWithoutDate(p) ? "date to be set" : formatShort(p.nextPhysical);
    case "completed":
      return "confirm to clear";
    default:
      return "";
  }
}

// ---- Cells -----------------------------------------------------------------

function LastPhysical({ p, a }: { p: Patient; a: RowActions }) {
  return (
    <EditableDate
      value={p.lastPhysical}
      label={`Last physical for ${p.firstName} ${p.lastName}`}
      onSave={(v) =>
        a.onPatch(
          p,
          { lastPhysical: v },
          v ? `${p.firstName} ${p.lastName}: last physical ${formatShort(v)}` : `${p.firstName} ${p.lastName}: last physical cleared`,
        )
      }
    >
      <span className="text-ink">{formatShort(p.lastPhysical)}</span>
    </EditableDate>
  );
}

function OutreachDue({ p, a }: { p: Patient; a: RowActions }) {
  const due = outreachDueFor(p);
  const manual = isOutreachManual(p);
  const d = parseDate(due);
  const past = d ? d <= today() : false;

  const body =
    p.outreachStatus === "Not Needed" ? (
      <span className="text-muted">—</span>
    ) : !d ? (
      <span className="text-red-700 font-semibold">No physical on record</span>
    ) : (
      <span className={past ? "text-red-700" : "text-ink"}>
        <span className="font-medium">{formatShort(due)}</span>
        <span className={`block text-xs ${past ? "text-red-600 font-semibold" : "text-muted"}`}>
          {relative(due)}
          {manual && <span className="text-muted"> · set by hand</span>}
        </span>
      </span>
    );

  return (
    <EditableDate
      value={due}
      label={`Outreach due for ${p.firstName} ${p.lastName}`}
      onSave={(v) =>
        a.onPatch(p, { nextOutreachOverride: v }, v ? `${p.firstName} ${p.lastName}: outreach due ${formatShort(v)}` : undefined)
      }
      onReset={
        manual
          ? () => a.onPatch(p, { nextOutreachOverride: "" }, `${p.firstName} ${p.lastName}: outreach date back to the 11-month rule`)
          : undefined
      }
    >
      {body}
    </EditableDate>
  );
}

function StatusSelect({ p, a, className = "" }: { p: Patient; a: RowActions; className?: string }) {
  return (
    <select
      className={`field py-1.5 px-2 ${className}`}
      value={p.outreachStatus === "Completed" ? "" : p.outreachStatus}
      onChange={(e) => {
        const v = e.target.value as OutreachStatus;
        a.onPatch(p, { outreachStatus: v }, v ? `${p.firstName} ${p.lastName}: ${v}` : undefined);
      }}
      aria-label={`Outreach status for ${p.firstName} ${p.lastName}`}
    >
      <option value="">Not started</option>
      {CONTACT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
      <option value={BOOKED}>{BOOKED}</option>
    </select>
  );
}

/** The "Next physical date" column: the booked appointment. */
function ScheduleCell({ p, a }: { p: Patient; a: RowActions }) {
  if (stageOf(p) === "not_needed") return <span className="text-muted">—</span>;
  const has = Boolean(p.nextPhysical);
  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-full border bg-white pl-2.5 pr-1 py-1 ${
        has ? "border-sky-300" : "border-navy/15"
      }`}
    >
      <CalendarPlus className={`h-4 w-4 shrink-0 ${has ? "text-sky-600" : "text-azure"}`} aria-hidden="true" />
      <input
        type="date"
        className="w-[7.5rem] rounded-md border-0 bg-transparent px-0.5 py-0.5 text-sm font-medium text-ink focus:ring-0"
        value={toInputDate(p.nextPhysical)}
        onChange={(e) => {
          const v = fromInputDate(e.target.value);
          a.onPatch(
            p,
            // Setting a date books the visit, so the stored status stays meaningful.
            v ? { nextPhysical: v, outreachStatus: BOOKED } : { nextPhysical: "", outreachStatus: "" },
            v ? `${p.firstName} ${p.lastName} booked for ${formatShort(v)}` : `${p.firstName} ${p.lastName}: appointment cleared`,
          );
        }}
        aria-label={`Next physical date for ${p.firstName} ${p.lastName}`}
      />
    </label>
  );
}

/** The "Action" column: whatever this patient needs from staff right now. */
function ActionCell({ p, a, stage, busy }: { p: Patient; a: RowActions; stage: Stage; busy: boolean }) {
  if (busy) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-4 w-4" /> Saving…
      </span>
    );
  }
  switch (stage) {
    case "due":
    case "in_progress":
      return <StatusSelect p={p} a={a} className="w-40" />;
    case "scheduled":
      return (
        <button
          className="btn-success py-1.5"
          onClick={() => a.onPatch(p, { outreachStatus: "Completed" }, `${p.firstName} ${p.lastName} marked complete — confirm to clear`)}
        >
          <Check className="h-4 w-4" /> Physical done
        </button>
      );
    case "completed":
      return (
        <div className="flex flex-wrap items-center gap-1">
          <button className="btn-success py-1.5" onClick={() => a.onConfirmComplete(p)}>
            <Check className="h-4 w-4" /> Confirm &amp; clear
          </button>
          <button className="btn-ghost py-1.5 px-2 text-muted" onClick={() => a.onPatch(p, { outreachStatus: "" })} title="Not done yet">
            <Undo2 className="h-4 w-4" />
          </button>
        </div>
      );
    case "upcoming":
      return <span className="text-sm text-muted">—</span>;
    case "not_needed":
      return (
        <button
          className="btn-ghost py-1.5 text-muted"
          onClick={() => a.onPatch(p, { outreachStatus: "" }, `${p.firstName} ${p.lastName} is now tracked for physicals`)}
        >
          Start tracking
        </button>
      );
  }
}

function RemoveButton({ p, a }: { p: Patient; a: RowActions }) {
  return (
    <button
      className="rounded-full p-1.5 text-muted/70 hover:bg-red-50 hover:text-red-700 transition-colors"
      onClick={() => a.onRemove(p)}
      title={`Remove ${p.firstName} ${p.lastName}`}
      aria-label={`Remove ${p.firstName} ${p.lastName}`}
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function NameCell({ p, a }: { p: Patient; a: RowActions }) {
  const age = ageFrom(p.dob);
  return (
    <button className="group text-left" onClick={() => a.onOpen(p)}>
      <span className="font-semibold text-navy group-hover:underline inline-flex items-center gap-1 whitespace-nowrap">
        {p.lastName}, {p.firstName}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
      <span className="block text-xs text-muted whitespace-nowrap">
        {p.dob ? (
          <>
            DOB {p.dob}
            {age !== null && ` · ${age}`}
          </>
        ) : (
          "DOB unknown"
        )}
      </span>
    </button>
  );
}

// ---- List ------------------------------------------------------------------

export function PatientList({ patients, actions, busyId }: { patients: Patient[]; actions: RowActions; busyId: string | null }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-sand/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">Patient</th>
              <th className="text-left font-semibold px-3 py-3">Status</th>
              <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">Last physical</th>
              <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">Outreach due</th>
              <th className="text-left font-semibold px-3 py-3">Action</th>
              <th className="text-left font-semibold px-3 py-3 whitespace-nowrap">Next physical date</th>
              <th className="w-10">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {patients.map((p) => {
              const stage = stageOf(p);
              return (
                <tr key={p.id} className="hover:bg-cream/50 align-middle">
                  <td className="px-3 py-3 w-px">
                    <NameCell p={p} a={actions} />
                  </td>
                  <td className="px-3 py-3">
                    <Pill stage={stage}>
                      {STAGE_LABEL[stage]}
                      {stageDetail(p, stage) && <span className="font-normal opacity-80">· {stageDetail(p, stage)}</span>}
                    </Pill>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <LastPhysical p={p} a={actions} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <OutreachDue p={p} a={actions} />
                  </td>
                  <td className="px-3 py-3">
                    <ActionCell p={p} a={actions} stage={stage} busy={busyId === p.id} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <ScheduleCell p={p} a={actions} />
                  </td>
                  <td className="pr-3 text-right">
                    <RemoveButton p={p} a={actions} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {patients.map((p) => {
          const stage = stageOf(p);
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <NameCell p={p} a={actions} />
                <div className="flex items-center gap-1 shrink-0">
                  <Pill stage={stage}>{STAGE_LABEL[stage]}</Pill>
                  <RemoveButton p={p} a={actions} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Last physical</dt>
                  <dd className="font-medium">
                    <LastPhysical p={p} a={actions} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Outreach due</dt>
                  <dd>
                    <OutreachDue p={p} a={actions} />
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ActionCell p={p} a={actions} stage={stage} busy={busyId === p.id} />
              </div>
              <div className="mt-2">
                <dt className="text-xs text-muted mb-1">Next physical date</dt>
                <ScheduleCell p={p} a={actions} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
