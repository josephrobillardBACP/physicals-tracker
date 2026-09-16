import { useState } from "react";
import { ALLOWED_DOMAIN, AUTH_CONFIGURED } from "../lib/auth";
import { Spinner } from "./ui";

export function SignIn({ onSignIn, onDemo, notice }: { onSignIn: () => Promise<void>; onDemo?: () => void; notice?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSignIn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="font-serif text-4xl font-semibold text-navy">Annual Physicals Tracker</h1>
        <p className="mt-3 text-sm text-muted">
          Track who is due for an annual physical, log outreach, and schedule visits.
          {ALLOWED_DOMAIN && (
            <>
              {" "}
              Sign in with your <span className="font-semibold text-ink">@{ALLOWED_DOMAIN}</span> Google account.
            </>
          )}
        </p>

        {AUTH_CONFIGURED ? (
          <button className="btn-primary w-full mt-6 py-3" onClick={go} disabled={busy}>
            {busy ? <Spinner /> : <GoogleMark />}
            {busy ? "Signing in…" : "Sign in with Google"}
          </button>
        ) : (
          <p className="mt-6 rounded-xl bg-amber-50 text-amber-900 text-sm p-3 text-left">
            Sign-in isn&rsquo;t configured yet. Set the <code>VITE_FIREBASE_*</code> variables (see README).
          </p>
        )}

        {notice && !error && <p className="mt-4 rounded-xl bg-sky-50 text-sky-900 text-sm p-3">{notice}</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        {onDemo && (
          <button className="btn-ghost mt-4 text-xs text-muted" onClick={onDemo}>
            Preview with sample data
          </button>
        )}
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41.4 35.4 44 30 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}
