import { LogOut, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddPatientDialog } from "./components/AddPatientDialog";
import { PatientDrawer } from "./components/PatientDrawer";
import { PatientList } from "./components/PatientList";
import { SignIn } from "./components/SignIn";
import { Logo, Pill, Spinner, STAGE_STYLE, ToastProvider, useToast } from "./components/ui";
import { loadSession, saveSession, Session, signIn, signOut } from "./lib/auth";
import { DemoSource } from "./lib/demo";
import { matches, rollForward, sortPatients, stageOf } from "./lib/logic";
import { SheetsSource } from "./lib/sheets";
import { DataSource, Panel } from "./lib/store";
import { Patient, PatientInput, Stage, STAGE_LABEL, STAGE_ORDER, User } from "./lib/types";

const SHEET_ID = (import.meta.env.VITE_SHEET_ID as string | undefined) ?? "";
const DEMO_ALLOWED = import.meta.env.DEV || new URLSearchParams(location.search).has("demo");
const REFRESH_MS = 90_000;

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}

function Root() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [demo, setDemo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const source = useMemo<DataSource | null>(() => {
    if (demo) return new DemoSource();
    if (!session) return null;
    return new SheetsSource(SHEET_ID, async () => {
      const s = sessionRef.current;
      if (s && s.expiresAt > Date.now()) return s.accessToken;
      try {
        const fresh = await signIn(true, s?.user.email);
        setSession(fresh);
        return fresh.accessToken;
      } catch (e) {
        // Silent refresh failed (popup blocked, consent revoked, signed out of Google):
        // send the user back to the sign-in screen instead of leaving a broken session.
        saveSession(null);
        setSession(null);
        setNotice("Your session expired. Please sign in again.");
        throw e;
      }
    });
  }, [demo, session?.user.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const user: User | null = demo ? { email: "preview@example.com", name: "Preview" } : (session?.user ?? null);

  if (!source || !user) {
    return (
      <SignIn
        onSignIn={async () => {
          setSession(await signIn(false));
          setNotice(null);
        }}
        onDemo={DEMO_ALLOWED ? () => setDemo(true) : undefined}
        notice={notice}
      />
    );
  }

  return (
    <Tracker
      source={source}
      user={user}
      demo={demo}
      onSignOut={() => {
        signOut(session);
        saveSession(null);
        setSession(null);
        setDemo(false);
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
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // ---- Load panels once, then patients per panel -------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ps = await source.listPanels();
        if (!alive) return;
        setPanels(ps);
        const remembered = localStorage.getItem("physicals.panel");
        setPanel(ps.find((p) => p.title === remembered) ?? ps[0] ?? null);
        if (ps.length === 0) setError("The spreadsheet has no tabs. Add one tab per doctor.");
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

  const load = useCallback(
    async (quiet = false) => {
      if (!panel) return;
      quiet ? setRefreshing(true) : setLoading(true);
      try {
        const list = await source.listPatients(panel);
        setPatients(list);
        setUpdatedAt(new Date());
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [source, panel],
  );

  useEffect(() => {
    if (panel) {
      localStorage.setItem("physicals.panel", panel.title);
      setFilter("all");
      setQuery("");
      load();
    }
  }, [panel, load]);

  // Keep the list fresh when several staff are working at once.
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && load(true), REFRESH_MS);
    const onVis = () => document.visibilityState === "visible" && load(true);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  // ---- Mutations ---------------------------------------------------------
  const replace = (p: Patient) => setPatients((list) => list.map((x) => (x.id === p.id ? p : x)));

  const patch = async (p: Patient, changes: Partial<PatientInput>, msg?: string) => {
    if (!panel) return;
    setBusyId(p.id);
    try {
      const saved = await source.updatePatient(panel, p.id, changes, user);
      replace(saved);
      if (msg) toast({ kind: "ok", text: msg });
    } catch (e) {
      toast({ kind: "error", text: (e as Error).message });
      load(true);
    } finally {
      setBusyId(null);
    }
  };

  const confirmComplete = async (p: Patient) => {
    if (!panel) return;
    const before = { lastPhysical: p.lastPhysical, nextPhysical: p.nextPhysical, outreachStatus: p.outreachStatus };
    setBusyId(p.id);
    try {
      const saved = await source.updatePatient(panel, p.id, rollForward(p), user);
      replace(saved);
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
      load(true);
    } finally {
      setBusyId(null);
    }
  };

  const add = async (input: PatientInput) => {
    if (!panel) return;
    const saved = await source.addPatient(panel, input, user);
    setPatients((list) => [...list, saved]);
    toast({ kind: "ok", text: `Added ${saved.firstName} ${saved.lastName} to ${panel.title}.` });
  };

  const remove = async (p: Patient) => {
    if (!panel) return;
    await source.deletePatient(panel, p.id);
    setPatients((list) => list.filter((x) => x.id !== p.id));
    toast({ kind: "ok", text: `Removed ${p.firstName} ${p.lastName}.` });
  };

  // ---- Derived -----------------------------------------------------------
  const counts = useMemo(() => {
    const c: Record<Stage, number> = { due: 0, in_progress: 0, scheduled: 0, completed: 0, upcoming: 0, not_needed: 0 };
    for (const p of patients) c[stageOf(p)]++;
    return c;
  }, [patients]);

  const visible = useMemo(
    () => sortPatients(patients.filter((p) => (filter === "all" || stageOf(p) === filter) && matches(p, query))),
    [patients, filter, query],
  );

  const open = openId ? patients.find((p) => p.id === openId) : undefined;

  // ---- Render ------------------------------------------------------------
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur border-b border-navy/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 mr-2">
            <Logo />
            <h1 className="font-serif text-2xl font-semibold text-navy leading-tight">Annual Physicals Tracker</h1>
          </div>

          {panels.length > 0 && (
            <nav className="flex rounded-full bg-sand p-1 order-last w-full sm:order-none sm:w-auto" aria-label="Doctor">
              {panels.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPanel(p)}
                  className={`flex-1 sm:flex-none rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    panel?.id === p.id ? "bg-navy text-white shadow-sm" : "text-navy hover:bg-white/60"
                  }`}
                  aria-current={panel?.id === p.id ? "page" : undefined}
                >
                  {p.title}
                </button>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            {demo && <span className="rounded-md bg-amber-100 text-amber-900 text-xs font-semibold px-2 py-1">Sample data</span>}
            {user.picture ? (
              <img src={user.picture} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="h-8 w-8 rounded-full bg-azure/20 text-navy text-xs font-bold flex items-center justify-center">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hidden sm:block text-sm text-muted max-w-[10rem] truncate">{user.name}</span>
            <button className="btn-ghost px-2" onClick={onSignOut} title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        {/* Summary / filter chips */}
        <div className="flex flex-wrap gap-2">
          <Chip on={filter === "all"} onClick={() => setFilter("all")} label="All" n={patients.length} />
          {STAGE_ORDER.map((s) => (
            <Chip key={s} stage={s} on={filter === s} onClick={() => setFilter(filter === s ? "all" : s)} label={STAGE_LABEL[s]} n={counts[s]} />
          ))}
        </div>

        {/* Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[14rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" aria-hidden="true" />
            <input className="field pl-9" placeholder="Search by name or date of birth" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search patients" />
          </label>
          <button className="btn-secondary" onClick={() => load(true)} disabled={refreshing || loading} title="Reload the list from the spreadsheet">
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

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-muted">
              <Spinner /> Loading {panel?.title ?? ""}…
            </div>
          ) : visible.length === 0 ? (
            <div className="card py-16 text-center text-muted">
              {patients.length === 0 ? (
                <>
                  <p className="font-serif text-2xl text-navy">No patients yet</p>
                  <p className="mt-1 text-sm">Use “Add patient” to start {panel?.title}’s list.</p>
                </>
              ) : query ? (
                <p>No patients match “{query}”.</p>
              ) : (
                <p>Nothing in “{filter === "all" ? "All" : STAGE_LABEL[filter]}” right now.</p>
              )}
            </div>
          ) : (
            <PatientList patients={visible} busyId={busyId} actions={{ onOpen: (p) => setOpenId(p.id), onPatch: patch, onConfirmComplete: confirmComplete }} />
          )}
        </div>

        <p className="mt-4 text-xs text-muted text-center">
          {updatedAt && `Updated ${updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. `}
          Outreach is due at the end of the month, 11 months after the last physical.
        </p>
      </main>

      {adding && panel && <AddPatientDialog doctor={panel.title} onClose={() => setAdding(false)} onSave={add} />}
      {open && (
        <PatientDrawer
          key={open.id}
          patient={open}
          onClose={() => setOpenId(null)}
          onSave={(changes) => patch(open, changes, "Saved.")}
          onDelete={() => remove(open)}
        />
      )}
    </div>
  );
}

function Chip({ stage, on, onClick, label, n }: { stage?: Stage; on: boolean; onClick: () => void; label: string; n: number }) {
  const style = stage ? STAGE_STYLE[stage] : { pill: "", dot: "", chip: "data-[on=true]:bg-navy" };
  return (
    <button
      data-on={on}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-navy/30 data-[on=true]:text-white data-[on=true]:border-transparent ${style.chip}`}
      aria-pressed={on}
    >
      {stage && !on ? <Pill stage={stage} className="!px-0 !py-0 !ring-0 !bg-transparent">{label}</Pill> : label}
      <span className={`rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-sand text-muted"}`}>{n}</span>
    </button>
  );
}
