import { TENANT_TOKEN_KEY } from "./authKeys";

export const TOKEN_KEY = "rentchain_token";
export const TOKEN_KEY_LEGACY = "token";

let inMemoryToken: string | null = null;
let inMemoryTenantToken: string | null = null;

function normalizeToken(raw: string | null | undefined) {
  const t = String(raw ?? "").trim();
  if (!t || t === "null" || t === "undefined") return null;
  return t;
}

function readStorage(key: string, preferLocal: boolean) {
  if (typeof window === "undefined") return null;
  try {
    const local = window.localStorage.getItem(key);
    const session = window.sessionStorage.getItem(key);
    return normalizeToken(preferLocal ? local || session : session || local);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

export function getAuthToken(): string | null {
  return (
    normalizeToken(inMemoryToken) ||
    readStorage(TOKEN_KEY, true) ||
    readStorage(TOKEN_KEY_LEGACY, true)
  );
}

export function setAuthToken(token: string | null) {
  const clean = normalizeToken(token);
  inMemoryToken = clean;
  writeStorage(TOKEN_KEY, clean);
  if (!clean) {
    writeStorage(TOKEN_KEY_LEGACY, null);
  }
}

export function clearAuthToken() {
  inMemoryToken = null;
  writeStorage(TOKEN_KEY, null);
  writeStorage(TOKEN_KEY_LEGACY, null);
}

export function getTenantToken(): string | null {
  return normalizeToken(inMemoryTenantToken) || readStorage(TENANT_TOKEN_KEY, true);
}

export function setTenantToken(token: string | null) {
  const clean = normalizeToken(token);
  inMemoryTenantToken = clean;
  writeStorage(TENANT_TOKEN_KEY, clean);
}

export function clearTenantToken() {
  inMemoryTenantToken = null;
  writeStorage(TENANT_TOKEN_KEY, null);
}
