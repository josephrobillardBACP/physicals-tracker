import { User } from "./types";

/**
 * Google sign-in via Google Identity Services (token model).
 * The access token lets the app call the Sheets API as the signed-in staff member,
 * so the sheet's own sharing settings decide who can read/write.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

const STORAGE_KEY = "physicals.session";

export interface Session {
  accessToken: string;
  expiresAt: number; // epoch ms
  user: User;
}

export const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";
export const ALLOWED_DOMAIN = (import.meta.env.VITE_ALLOWED_DOMAIN as string | undefined) ?? "";

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.accessToken || s.expiresAt - Date.now() < 60_000) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };

function gis(): any {
  const g = (window as any).google;
  if (!g?.accounts?.oauth2) throw new Error("Google sign-in is still loading. Try again in a moment.");
  return g.accounts.oauth2;
}

/**
 * @param silent try to get a token without showing the consent screen
 *   (works once the user has already consented in this browser).
 */
export async function signIn(silent = false, loginHint?: string): Promise<Session> {
  if (!CLIENT_ID) throw new Error("VITE_GOOGLE_CLIENT_ID is not configured.");
  const token = await new Promise<TokenResponse>((resolve, reject) => {
    const client = gis().initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      hd: ALLOWED_DOMAIN || undefined,
      login_hint: loginHint,
      callback: (r: TokenResponse) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r)),
      error_callback: (e: { type?: string; message?: string }) =>
        reject(new Error(e?.type === "popup_closed" ? "Sign-in window was closed." : e?.message || "Sign-in failed.")),
    });
    client.requestAccessToken({ prompt: silent ? "" : "select_account" });
  });
  if (!token.access_token) throw new Error("Google did not return an access token.");

  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!res.ok) throw new Error("Could not read your Google profile.");
  const info = (await res.json()) as { email: string; name?: string; picture?: string; hd?: string };

  if (ALLOWED_DOMAIN && !info.email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN.toLowerCase())) {
    gis().revoke?.(token.access_token, () => {});
    throw new Error(`Please sign in with your @${ALLOWED_DOMAIN} account.`);
  }

  const session: Session = {
    accessToken: token.access_token,
    expiresAt: Date.now() + ((token.expires_in ?? 3600) - 30) * 1000,
    user: { email: info.email, name: info.name ?? info.email, picture: info.picture },
  };
  saveSession(session);
  return session;
}

export function signOut(session: Session | null) {
  try {
    if (session?.accessToken) gis().revoke?.(session.accessToken, () => {});
  } catch {
    /* ignore */
  }
  saveSession(null);
}
