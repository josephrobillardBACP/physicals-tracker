import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, FIREBASE_CONFIGURED } from "./firebase";
import { User } from "./types";

/**
 * Sign-in mirrors the travel medicine workflow: Google sign-in, then an
 * allowlist check. Anyone on the clinic's Workspace domain is allowed, and
 * individual outside addresses can be granted access through the shared
 * `admin/allowlist` document that the existing admin page manages.
 */

export const ALLOWED_DOMAIN = (import.meta.env.VITE_ALLOWED_DOMAIN as string | undefined) ?? "";
export const AUTH_CONFIGURED = FIREBASE_CONFIGURED;

function onDomain(email: string): boolean {
  if (!ALLOWED_DOMAIN) return true;
  return email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN.toLowerCase());
}

/** Outside addresses explicitly granted access by an admin. */
async function onAllowlist(email: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db(), "admin", "allowlist"));
    const emails = (snap.data()?.emails ?? {}) as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(emails, email.toLowerCase());
  } catch {
    // A rules error or offline read must not grant access.
    return false;
  }
}

export async function isAllowed(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return onDomain(email) || (await onAllowlist(email));
}

function toUser(u: FirebaseUser): User {
  return {
    email: u.email ?? "",
    name: u.displayName ?? u.email ?? "",
    picture: u.photoURL ?? undefined,
  };
}

/**
 * Calls back with the signed-in user, or null when signed out. Anyone who is
 * signed in but not allowed is signed straight back out and reported as a
 * rejection so the sign-in screen can explain why.
 */
export function watchAuth(cb: (user: User | null, rejected?: string) => void): () => void {
  if (!AUTH_CONFIGURED) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth(), async (u) => {
    if (!u) return cb(null);
    if (await isAllowed(u.email)) return cb(toUser(u));
    await fbSignOut(auth()).catch(() => {});
    cb(
      null,
      ALLOWED_DOMAIN
        ? `${u.email} isn't set up for this app. Sign in with your @${ALLOWED_DOMAIN} work account, or ask Joseph to add you.`
        : `${u.email} isn't set up for this app.`,
    );
  });
}

export async function signIn(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account", ...(ALLOWED_DOMAIN ? { hd: ALLOWED_DOMAIN } : {}) });
  try {
    await signInWithPopup(auth(), provider);
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw new Error("Sign-in window was closed.");
    }
    if (code === "auth/popup-blocked") {
      throw new Error("Your browser blocked the sign-in pop-up. Allow pop-ups for this site and try again.");
    }
    throw new Error((e as Error).message || "Sign-in failed.");
  }
}

export async function signOutNow(): Promise<void> {
  if (AUTH_CONFIGURED) await fbSignOut(auth()).catch(() => {});
}
