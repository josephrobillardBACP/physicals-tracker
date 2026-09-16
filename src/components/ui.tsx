import { X } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Stage } from "../lib/types";

// ---- Stage colours -----------------------------------------------------------

export const STAGE_STYLE: Record<Stage, { pill: string; dot: string; chip: string }> = {
  due: { pill: "bg-red-50 text-red-800 ring-red-200", dot: "bg-red-500", chip: "data-[on=true]:bg-red-600" },
  in_progress: { pill: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500", chip: "data-[on=true]:bg-amber-600" },
  scheduled: { pill: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500", chip: "data-[on=true]:bg-sky-700" },
  completed: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", chip: "data-[on=true]:bg-emerald-700" },
  upcoming: { pill: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400", chip: "data-[on=true]:bg-slate-600" },
  not_needed: { pill: "bg-stone-100 text-stone-500 ring-stone-200", dot: "bg-stone-300", chip: "data-[on=true]:bg-stone-500" },
};

export function Pill({ stage, children, className = "" }: { stage: Stage; children: ReactNode; className?: string }) {
  const s = STAGE_STYLE[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${s.pill} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {children}
    </span>
  );
}

// ---- Modal -------------------------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} card rounded-b-none sm:rounded-2xl max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-serif text-2xl font-semibold text-navy">{title}</h2>
          <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-navy/10 flex flex-wrap gap-2 justify-end bg-cream/40 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Toasts ------------------------------------------------------------------

interface Toast {
  id: number;
  text: string;
  kind: "ok" | "error";
  action?: { label: string; run: () => void };
}

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((list) => [...list, { ...t, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.kind === "error" ? 8000 : 6000);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[min(92vw,28rem)]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card px-4 py-3 text-sm flex items-center gap-3 ${t.kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "text-ink"}`}
          >
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button
                className="font-semibold text-azure hover:underline"
                onClick={() => {
                  t.action?.run();
                  setToasts((list) => list.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="text-muted hover:text-ink" aria-label="Dismiss" onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- Misc --------------------------------------------------------------------

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
