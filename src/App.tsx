import { ChevronDown, LogOut, Mail, Plus, RefreshCw, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddPatientDialog } from "./components/AddPatientDialog";
import { NotificationsDialog } from "./components/NotificationsDialog";
import { PatientDrawer } from "./components/PatientDrawer";
import { PatientList } from "./components/PatientList";
import { SignIn } from "./components/SignIn";
import { Modal, Pill, Spinner, STAGE_STYLE, ToastProvider, useToast } from "./components/ui";
import { AUTH_CONFIGURED, signIn, signOutNow, watchAuth } from "./lib/auth";
import { readPatientCsv } from "./lib/csv";
import { DemoSource } from "./lib/demo";
import { FirestoreSource } from "./lib/firestore";
import { matches, rollForward, sortPatients, stageOf } from "./lib/logic";
import { DataSource, Panel } from "./lib/store";
import { Patient, PatientInput, SORT_LABEL, SortMode, Stage, STAGE_LABEL, STAGE_ORDER, User } from "./lib/types";

const DEMO_ONLY = (import.meta.env.VITE_DEMO_ONLY as string | undefined) === "1";
const DEMO_ALLOWED = DEMO_ONLY || import.meta.env.DEV || new URLSearchParams(location.search).has("demo");

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}

function Root() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!AUTH_CONFIGURED);
  const [rejected, setRejected] = useState<string | null>(null);
  const [demo, setDemo] = useState(DEMO_ONLY);

  useEffect(() => {
    if (!AUTH_CONFIGURED) return;
    return watchAuth((u, why) => {
      setUser(u);
      setRejected(why ?? null);
      setAuthReady(true);
    });
  }, []);

  const source = useMemo<DataSource | null>(() => {
    if (demo) return new DemoSource();
    return user ? new FirestoreSource() : null;
  }, [demo, user]);

  const activeUser: User | null = demo ? { email: "preview@example.com", name: "Preview" } : user;

  if (!authReady && !demo) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        <Spinner />
      </main>
    );
  }

  if (!source || !activeUser) {
    return <SignIn onSignIn={signIn} onDemo={DEMO_ALLOWED ? () => setDemo(true) : undefined} notice={rejected} />;
  }

  return (
    <Tracker
      source={source}
      user={activeUser}
      demo={demo}
      onSignOut={() => {
        setDemo(false);
        void signOutNow();
      }}
    />
  );
}

function Tracker({ source, user, demo, onSignOut }: { source: DataSource; user: User; demo: boolean; onSignOut: () => void }) {
  const toast = useToast();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Stage | "all">("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("action");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Patient | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingNotify, setEditingNotify] = useState(false);

  /**
   * Rows stay put while staff work. `orderIds` is the frozen order, recomputed
   * only on an explicit action: Refresh, a sort or filter change, adding a
   * patient, or confirming a completed physical. Setting a status or typing a
   * date never moves a row out from under the person editing it.
   */
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const patientsRef = useRef<Patient[]>([]);
  patientsRef.current = patients;

  const resort = useCallback(
    (list?: Patient[]) => {
      const all = list ?? patientsRef.current;
      const shown = all.filter((p) => (filter === "all" || stageOf(p) === filter) && matches(p, query));
      setOrderIds(sortPatients(shown, sortMode).map((p) => p.id));
    },
    [filter, query, sortMode],
  );

  // Changing what you are looking at re-evaluates the list; editing does not.
  useEffect(() => {
    resort();
  }, [resort]);

  // ---- Panels ------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ps = await source.listPanels();
        if (!alive) return;
        setPanels(ps);
        const remembered = localStorage.getItem("physicals.panel");
        setPanel(ps.find((p) => p.title === remembered) ?? ps[0] ?? null);
        if (ps.length === 0) setError("No practices are set up yet.");
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [source]);

  // ---- Patients ----------------------------------------------------------
  const load = useCallback(
    async (quiet = false) => {
      if (!panel) return;
      quiet ? setRefreshing(true) : setLoading(true);
      try {
        const list = await source.listPatients(panel);
        setPatients(list);
        resort(list);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [source, panel, resort],
  );

  // Live updates keep the data current while the visible order stays frozen.
  useEffect(() => {
    if (!panel) return;
    setFilter("all");
    setQuery("");
    localStorage.setItem("physicals.panel", panel.title);

    if (!source.subscribe) {
      void load();
      return;
    }
    setLoading(true);
    let first = true;
    const stop = source.subscribe(
      panel,
      (list) => {
        setPatients(list);
        if (first) {
          resort(list);
          first = false;
        }
        setLoading(false);
        setError(null);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return stop;
    // `resort` is intentionally not a dependency: re-subscribing whenever the
    // filter changes would reset the frozen order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, panel]);

  const refresh = () => {
    if (source.subscribe) {
      // Data is already live; Refresh is what re-sorts and reveals new rows.
      setRefreshing(true);
      resort();
      window.setTimeout(() => setRefreshing(false), 250);
    } else {
      void load(true);
    }
  };

  // ---- Mutations ---------------------------------------------------------
  const replace = (p: Patient) => setPatients((list) => list.map((x) => (x.id === p.id ? p : x)));

  const patch = async (p: Patient, changes: Partial<PatientInput>, msg?: string) => {
    if (!panel) return;
    setBusyId(p.id);
    try {
      replace(await source.updatePatient(panel, p.id, changes, user));
      if (msg) toast({ kind: "ok", text: msg });
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const add = async (input: PatientInput) => {
    if (!panel) return;
    const saved = await source.addPatient(panel, input, user);
    const next = [...patientsRef.current.filter((p) => p.id !== saved.id), saved];
    setPatients(next);
    resort(next);
    toast({ kind: "ok", text: `Added ${saved.firstName} ${saved.lastName} to ${panel.title}.` });
  };

  const confirmComplete = async (p: Patient) => {
    if (!panel) return;
    const before = { lastPhysical: p.lastPhysical, nextPhysical: p.nextPhysical, outreachStatus: p.outreachStatus };
    setBusyId(p.id);
    try {
      const saved = await source.updatePatient(panel, p.id, rollForward(p), user);
      const next = patientsRef.current.map((x) => (x.id === saved.id ? saved : x));
      setPatients(next);
      resort(next); // this patient is done for the year, so the list re-orders here
      toast({
        kind: "ok",
        text: `${p.firstName} ${p.lastName} is set for next year (last physical ${saved.lastPhysical}).`,
        action: {
          label: "Undo",
          run: async () => {
            try {
              replace(await source.updatePatient(panel, p.id, before, user));
            } catch (e) {
              toast({ kind: "error", text: (e as Error).message });
            }
          },
        },
      });
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    const p = removing;
    if (!p || !panel) return;
    setRemoving(null);
    setBusyId(p.id);
    try {
      await source.deletePatient(panel, p.id);
      setPatients((list) => list.filter((x) => x.id !== p.id));
      const { id: _id, updatedAt: _u, updatedBy: _b, ...snapshot } = p;
      toast({
        kind: "ok",
        text: `Removed ${p.firstName} ${p.lastName}.`,
        action: {
          label: "Undo",
          run: async () => {
            try {
              await add(snapshot);
            } catch (e) {
              toast({ kind: "error", text: (e as Error).message });
            }
          },
        },
      });
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const importCsv = async (file: File) => {
    if (!panel || !source.importPatients) return;
    setImporting(true);
    try {
      const { rows, missing } = readPatientCsv(await file.text());
      if (missing.length) throw new Error(`That file needs ${missing.join(" and ")} columns.`);
      if (!rows.length) throw new Error("No patients found in that file.");
      const n = await source.importPatients(panel, rows, user);
      const list = await source.listPatients(panel);
      setPatients(list);
      resort(list);
      toast({ kind: "ok", text: `Imported ${n} patients into ${panel.title}.` });
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
    } finally {
      setImporting(false);
    }
  };

  // ---- Derived -----------------------------------------------------------
  const counts = useMemo(() => {
    const c: Record<Stage, number> = { due: 0, in_progress: 0, scheduled: 0, completed: 0, upcoming: 0, not_needed: 0 };
    for (const p of patients) c[stageOf(p)]++;
    return c;
  }, [patients]);

  const byId = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const visible = useMemo(() => orderIds.map((id) => byId.get(id)).filter((p): p is Patient => Boolean(p)), [orderIds, byId]);

  // Patients added elsewhere, or now matching the filter, since the last sort.
  const pending = useMemo(() => {
    const shown = new Set(orderIds);
    return patients.filter((p) => !shown.has(p.id) && (filter === "all" || stageOf(p) === filter) && matches(p, query)).length;
  }, [patients, orderIds, filter, query]);

  const open = openId ? patients.find((p) => p.id === openId) : undefined;

  // ---- Render ------------------------------------------------------------
  return (
    <div className="min-h-screen">
      <div className="bg-navy text-white">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">Annual Physicals Tracker</h1>
        </div>
      </div>

      <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {panels.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Practice</span>
              <label className="relative">
                <select
                  className="appearance-none rounded-full border border-navy/15 bg-white pl-4 pr-9 py-1.5 text-sm font-semibold text-navy shadow-sm hover:border-navy/40 cursor-pointer"
                  value={panel?.id ?? ""}
                  onChange={(e) => setPanel(panels.find((p) => p.id === e.target.value) ?? null)}
                  aria-label="Practice"
                >
                  {panels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" aria-hidden="true" />
              </label>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {source.setNotifyEmails && panel && (
              <button
                className="btn-secondary py-1.5"
                onClick={() => setEditingNotify(true)}
                title={`Who gets the daily email for ${panel.title}`}
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email settings</span>
                {panel.notifyEmails.length > 0 && (
                  <span className="rounded-full bg-azure/15 px-1.5 text-xs font-semibold text-navy">{panel.notifyEmails.length}</span>
                )}
              </button>
            )}
            {demo && <span className="rounded-md bg-amber-100 text-amber-900 text-xs font-semibold px-2 py-1">Sample data</span>}
            {user.picture ? (
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="h-8 w-8 rounded-full bg-azure/20 text-navy text-xs font-bold flex items-center justify-center">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hidden sm:block text-sm text-muted max-w-[12rem] truncate">{user.name}</span>
            <button className="btn-ghost px-2" onClick={onSignOut} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex flex-wrap gap-2">
          <Chip on={filter === "all"} onClick={() => setFilter("all")} label="All" n={patients.length} />
          {STAGE_ORDER.map((s) => (
            <Chip key={s} stage={s} on={filter === s} onClick={() => setFilter(filter === s ? "all" : s)} label={STAGE_LABEL[s]} n={counts[s]} />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[13rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" aria-hidden="true" />
            <input className="field pl-9" placeholder="Search by name or date of birth" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search patients" />
          </label>

          <label className="relative">
            <select
              className="appearance-none rounded-xl border border-navy/15 bg-white pl-3 pr-9 py-2 text-sm text-ink cursor-pointer hover:border-navy/40"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              aria-label="Sort patients"
            >
              {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
                <option key={m} value={m}>
                  Sort: {SORT_LABEL[m]}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" aria-hidden="true" />
          </label>

          <button className="btn-secondary" onClick={refresh} disabled={refreshing || loading} title="Re-sort the list and pull in anything new">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setAdding(true)} disabled={!panel}>
            <Plus className="h-4 w-4" /> Add patient
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="flex-1">{error}</span>
            <button className="btn-danger py-1" onClick={() => load()}>
              Try again
            </button>
          </div>
        )}

        {pending > 0 && (
          <button
            className="mt-4 w-full rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-sm px-4 py-2 text-left hover:bg-sky-100"
            onClick={refresh}
          >
            {pending} {pending === 1 ? "patient is" : "patients are"} not in this list yet. Refresh to include {pending === 1 ? "it" : "them"}.
          </button>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-muted">
              <Spinner /> Loading {panel?.title ?? ""}…
            </div>
          ) : visible.length === 0 ? (
            <div className="card py-16 px-6 text-center text-muted">
              {patients.length === 0 ? (
                <>
                  <p className="font-serif text-2xl text-navy">No patients yet</p>
                  <p className="mt-1 text-sm">Add patients one at a time, or bring the whole list across from a spreadsheet export.</p>
                  {source.importPatients && (
                    <label className="btn-secondary mt-4 cursor-pointer inline-flex">
                      {importing ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                      {importing ? "Importing…" : "Import from CSV"}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        disabled={importing}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void importCsv(f);
                        }}
                      />
                    </label>
                  )}
                </>
              ) : query ? (
                <p>No patients match “{query}”.</p>
              ) : (
                <p>Nothing in “{filter === "all" ? "All" : STAGE_LABEL[filter]}” right now.</p>
              )}
            </div>
          ) : (
            <PatientList
              patients={visible}
              busyId={busyId}
              actions={{ onOpen: (p) => setOpenId(p.id), onPatch: patch, onConfirmComplete: confirmComplete, onRemove: setRemoving }}
            />
          )}
        </div>

        <p className="mt-4 text-xs text-muted text-center">
          Outreach is due at the end of the month, 11 months after the last physical. The list keeps its order while you work; Refresh re-sorts it.
        </p>
      </main>

      {removing && (
        <Modal
          title="Remove patient?"
          onClose={() => setRemoving(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setRemoving(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmRemove}>
                Remove
              </button>
            </>
          }
        >
          <p className="text-sm text-ink">
            <span className="font-semibold">
              {removing.firstName} {removing.lastName}
            </span>{" "}
            will be taken off {panel?.title}&rsquo;s list. You can undo this straight afterwards.
          </p>
        </Modal>
      )}

      {editingNotify && panel && source.setNotifyEmails && (
        <NotificationsDialog
          panel={panel}
          onClose={() => setEditingNotify(false)}
          onSave={async (emails) => {
            await source.setNotifyEmails!(panel, emails);
            const next = { ...panel, notifyEmails: emails };
            setPanel(next);
            setPanels((list) => list.map((p) => (p.id === next.id ? next : p)));
            toast({ kind: "ok", text: emails.length ? `Daily email set for ${emails.length} ${emails.length === 1 ? "person" : "people"}.` : `Daily email off for ${panel.title}.` });
          }}
        />
      )}

      {adding && panel && <AddPatientDialog doctor={panel.title} onClose={() => setAdding(false)} onSave={add} />}
      {open && (
        <PatientDrawer
          key={open.id}
          patient={open}
          onClose={() => setOpenId(null)}
          onSave={(changes) => patch(open, changes, "Saved.")}
          onDelete={async () => {
            setOpenId(null);
            setRemoving(open);
          }}
        />
      )}
    </div>
  );
}

function Chip({ stage, on, onClick, label, n }: { stage?: Stage; on: boolean; onClick: () => void; label: string; n: number }) {
  const style = stage ? STAGE_STYLE[stage] : { chip: "data-[on=true]:bg-navy" };
  return (
    <button
      data-on={on}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-navy/30 data-[on=true]:text-white data-[on=true]:border-transparent ${style.chip}`}
      aria-pressed={on}
    >
      {stage && !on ? (
        <Pill stage={stage} className="!px-0 !py-0 !ring-0 !bg-transparent">
          {label}
        </Pill>
      ) : (
        label
      )}
      <span className={`rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-sand text-muted"}`}>{n}</span>
    </button>
  );
}
