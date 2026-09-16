import { CalendarPlus, Check, ChevronRight, Undo2 } from "lucide-react";
import { ageFrom, formatShort, fromInputDate, nextOutreachFor, parseDate, relative, today, toInputDate } from "../lib/dates";
import { stageOf } from "../lib/logic";
import { CONTACT_STATUSES, OutreachStatus, Patient, PatientInput, Stage, STAGE_LABEL } from "../lib/types";
import { Pill, Spinner } from "./ui";

export interface RowActions {
  onOpen: (p: Patient) => void;
  onPatch: (p: Patient, patch: Partial<PatientInput>, msg?: string) => void;
  onConfirmComplete: (p: Patient) => void;
}

function stageDetail(p: Patient, stage: Stage): string {
  switch (stage) {
    case "in_progress":
      return p.outreachStatus;
    case "scheduled":
      return formatShort(p.nextPhysical);
    case "completed":
      return "confirm to clear";
    default:
      return "";
  }
}

function OutreachDue({ p }: { p: Patient }) {
  if (p.outreachStatus === "Not Needed") return <span className="text-muted">—</span>;
  const due = nextOutreachFor(p.lastPhysical);
  if (!due) return <span className="text-red-700 font-semibold">No physical on record</span>;
  const d = parseDate(due)!;
  const past = d <= today();
  return (
    <span className={past ? "text-red-700" : "text-ink"}>
      <span className="font-medium">{formatShort(due)}</span>
      <span className={`block text-xs ${past ? "text-red-600 font-semibold" : "text-muted"}`}>{relative(due)}</span>
    </span>
  );
}

function StatusSelect({ p, a, className = "" }: { p: Patient; a: RowActions; className?: string }) {
  return (
    <select
      className={`field py-1.5 ${className}`}
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
    </select>
  );
}

function ScheduleInput({ p, a, className = "" }: { p: Patient; a: RowActions; className?: string }) {
  const has = Boolean(p.nextPhysical);
  return (
    <label className={`inline-flex items-center gap-2 rounded-full border bg-white pl-3 pr-1.5 py-1 text-xs font-semibold ${has ? "border-sky-300 text-sky-800" : "border-navy/15 text-navy"} ${className}`}>
      <CalendarPlus className="h-4 w-4 text-azure" aria-hidden="true" />
      {has ? "Visit" : "Schedule"}
      <input
        type="date"
        className="rounded-md border-0 bg-transparent px-1 py-0.5 text-sm font-medium text-ink focus:ring-0"
        value={toInputDate(p.nextPhysical)}
        onChange={(e) => {
          const v = fromInputDate(e.target.value);
          a.onPatch(p, { nextPhysical: v }, v ? `${p.firstName} ${p.lastName} scheduled for ${formatShort(v)}` : `${p.firstName} ${p.lastName}: appointment cleared`);
        }}
        aria-label={`Scheduled physical date for ${p.firstName} ${p.lastName}`}
      />
    </label>
  );
}

function Actions({ p, a, stage, busy }: { p: Patient; a: RowActions; stage: Stage; busy: boolean }) {
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
      return (
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect p={p} a={a} className="w-48" />
          <ScheduleInput p={p} a={a} />
        </div>
      );
    case "scheduled":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <ScheduleInput p={p} a={a} />
          <button className="btn-success py-1.5" onClick={() => a.onPatch(p, { outreachStatus: "Completed" }, `${p.firstName} ${p.lastName} marked complete — confirm to clear`)}>
            <Check className="h-4 w-4" /> Physical done
          </button>
        </div>
      );
    case "completed":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-success py-1.5" onClick={() => a.onConfirmComplete(p)}>
            <Check className="h-4 w-4" /> Confirm &amp; clear
          </button>
          <button className="btn-ghost py-1.5 text-muted" onClick={() => a.onPatch(p, { outreachStatus: "" })} title="Not done yet">
            <Undo2 className="h-4 w-4" /> Not yet
          </button>
        </div>
      );
    case "upcoming":
      return <ScheduleInput p={p} a={a} />;
    case "not_needed":
      return (
        <button className="btn-ghost py-1.5 text-muted" onClick={() => a.onPatch(p, { outreachStatus: "" }, `${p.firstName} ${p.lastName} is now tracked for physicals`)}>
          Start tracking
        </button>
      );
  }
}

function NameCell({ p, a }: { p: Patient; a: RowActions }) {
  const age = ageFrom(p.dob);
  return (
    <button className="group text-left" onClick={() => a.onOpen(p)}>
      <span className="font-semibold text-navy group-hover:underline inline-flex items-center gap-1">
        {p.lastName}, {p.firstName}
        <ChevronRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
      <span className="block text-xs text-muted">
        {p.dob ? (
          <>
            DOB {p.dob}
            {age !== null && ` · ${age}`}
          </>
        ) : (
          "DOB unknown"
        )}
        {p.membership === "Unpaid" && <span className="ml-2 rounded-md bg-amber-100 text-amber-900 px-1.5 py-0.5 font-semibold">Unpaid</span>}
      </span>
    </button>
  );
}

export function PatientList({ patients, actions, busyId }: { patients: Patient[]; actions: RowActions; busyId: string | null }) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="text-left font-semibold px-4 py-3">Patient</th>
              <th className="text-left font-semibold px-4 py-3">Status</th>
              <th className="text-left font-semibold px-4 py-3">Last physical</th>
              <th className="text-left font-semibold px-4 py-3">Outreach due</th>
              <th className="text-left font-semibold px-4 py-3 w-[22rem]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/5">
            {patients.map((p) => {
              const stage = stageOf(p);
              return (
                <tr key={p.id} className="hover:bg-cream/50 align-middle">
                  <td className="px-4 py-3">
                    <NameCell p={p} a={actions} />
                  </td>
                  <td className="px-4 py-3">
                    <Pill stage={stage}>
                      {STAGE_LABEL[stage]}
                      {stageDetail(p, stage) && <span className="font-normal opacity-80">· {stageDetail(p, stage)}</span>}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-ink">{formatShort(p.lastPhysical)}</td>
                  <td className="px-4 py-3">
                    <OutreachDue p={p} />
                  </td>
                  <td className="px-4 py-3">
                    <Actions p={p} a={actions} stage={stage} busy={busyId === p.id} />
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
                <Pill stage={stage}>{STAGE_LABEL[stage]}</Pill>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Last physical</dt>
                  <dd className="font-medium">{formatShort(p.lastPhysical)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Outreach due</dt>
                  <dd>
                    <OutreachDue p={p} />
                  </dd>
                </div>
              </dl>
              <div className="mt-3">
                <Actions p={p} a={actions} stage={stage} busy={busyId === p.id} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
