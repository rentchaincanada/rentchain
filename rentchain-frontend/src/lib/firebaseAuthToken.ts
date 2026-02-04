import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

let authReady = false;
let authReadyPromise: Promise<any | null> | null = null;
let cachedUser: any | null = null;

function ensureAuthReady(): Promise<any | null> {
  if (authReadyPromise) return authReadyPromise;
  try {
    const auth = getFirebaseAuth();
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        cachedUser = user ?? null;
        authReady = true;
        resolve(cachedUser);
        unsubscribe();
      });
    });
  } catch {
    authReady = true;
    authReadyPromise = Promise.resolve(null);
  }
  return authReadyPromise;
}

export async function awaitFirebaseAuthReady(): Promise<{ ready: boolean; user: any | null }> {
  const user = await ensureAuthReady();
  return { ready: authReady, user: user ?? null };
}

export async function getFirebaseIdToken(): Promise<string | null> {
  const user = cachedUser ?? (await ensureAuthReady());
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export function warnIfFirebaseDomainMismatch() {
  if (typeof window === "undefined" || !import.meta.env.DEV) return;
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim().toLowerCase();
  if (!authDomain) return;
  const host = window.location.hostname.toLowerCase();
  if (host && authDomain && host !== authDomain) {
    console.warn("[firebase] authDomain mismatch", { host, authDomain });
  }
}
