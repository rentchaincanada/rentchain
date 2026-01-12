// src/context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  login as apiLogin,
  loginDemo as apiLoginDemo,
  logout as apiLogout,
  restoreSession as apiRestoreSession,
} from "../api/authApi";

const PUBLIC_ROUTE_ALLOWLIST = [
  "/",
  "/join-waitlist",
  "/pricing",
  "/login",
  "/signup",
  "/terms",
  "/privacy",
];

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  landlordId?: string;
  tenantId?: string;
  leaseId?: string;
  screeningCredits?: number;
  plan?: string;
  actorRole?: string | null;
  actorLandlordId?: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  ready: boolean;
  login: (
    email: string,
    password: string,
    opts?: RequestInit
  ) => Promise<{ requires2fa: boolean }>;
  loginDemo: (plan?: string) => Promise<void>;
  logout: () => Promise<void>;
  twoFactorPendingToken: string | null;
  twoFactorMethods: string[];
  isTwoFactorRequired: boolean;
  completeTwoFactor: (token: string, user: AuthUser) => void;
  resetTwoFactor: () => void;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "rentchain_token";
const TENANT_TOKEN_KEY = "rentchain_tenant_token";

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): { valid: boolean; expired: boolean; expMs?: number } {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return { valid: false, expired: false };
  const expMs = payload.exp * 1000;
  const now = Date.now();
  const expired = now >= expMs - 30_000;
  return { valid: true, expired, expMs };
}

function tokenPreview(token: string | null | undefined) {
  if (!token) return { has: false, len: 0, preview: "" };
  const t = String(token);
  if (!t) return { has: false, len: 0, preview: "" };
  const len = t.length;
  const first = t.slice(0, 10);
  const last = t.slice(-10);
  return { has: true, len, preview: `${first}...${last}` };
}

interface AuthProviderProps {
  children: React.ReactNode;
}

const readTokenSafe = () => {
  if (typeof window === "undefined") return null;
  const raw =
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token");
  const t = (raw ?? "").trim();
  if (!t || t === "null" || t === "undefined") return null;
  if (t.split(".").length !== 3) return null; // basic JWT shape
  return t;
};

function getStoredToken() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const impersonationToken = params.get("impersonationToken");
  if (impersonationToken) {
    window.sessionStorage.setItem(TENANT_TOKEN_KEY, impersonationToken);
    params.delete("impersonationToken");
    const next = params.toString();
    const hash = window.location.hash || "";
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${next ? `?${next}` : ""}${hash}`
    );
  }

  const tenantToken = window.sessionStorage.getItem(TENANT_TOKEN_KEY);
  if (tenantToken) return tenantToken;

  const sessionToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (sessionToken) return sessionToken;

  // Fallback: pull from localStorage if sessionStorage is cleared (iOS)
  const persistedTenant = window.localStorage.getItem(TENANT_TOKEN_KEY);
  if (persistedTenant) {
    window.sessionStorage.setItem(TENANT_TOKEN_KEY, persistedTenant);
    return persistedTenant;
  }

  const persisted = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (persisted) {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, persisted);
    return persisted;
  }

  return null;
}

function storeToken(token: string) {
  if (typeof window === "undefined") return;
  const clean = String(token ?? "").trim();
  if (!clean || clean.includes("\n") || clean.includes("\r") || /\s/.test(clean)) {
    const dbg = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("debugAuth") ?? "" : "";
    if (import.meta.env.DEV || dbg === "1") {
      console.warn("[auth] refusing to store token with whitespace/newlines");
    }
    return;
  }
  const dbgStore = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("debugAuth") ?? "" : "";
  if (dbgStore === "1") {
    window.sessionStorage.setItem("debugAuthStoredAt", String(Date.now()));
  }
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, clean);
  window.localStorage.setItem(TOKEN_STORAGE_KEY, clean);
}

function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(TENANT_TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(TENANT_TOKEN_KEY);
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ready, setReady] = useState<boolean>(false);
  const [twoFactorPendingToken, setTwoFactorPendingToken] =
    useState<string | null>(null);
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);

  // On initial mount, attempt to restore session from localStorage token
  useEffect(() => {
    setIsLoading(true);
    setReady(false);

    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "";
    const isPublic = PUBLIC_ROUTE_ALLOWLIST.includes(pathname);
    const storedToken = getStoredToken();
    const hasToken = Boolean(storedToken);
    const tokenCheck = storedToken ? isTokenExpired(storedToken) : null;

    // No token: stay logged out, skip /api/me on public routes, and don't redirect
    if (!hasToken) {
      setUser(null);
      setToken(null);
      clearStoredToken();
      setIsLoading(false);
      setReady(true);
      return;
    }

    if (tokenCheck && (!tokenCheck.valid || tokenCheck.expired)) {
      setUser(null);
      setToken(null);
      clearStoredToken();
      if (!isPublic && typeof window !== "undefined") {
        const reason = !tokenCheck.valid ? "invalid" : "expired";
        const dbg = sessionStorage.getItem("debugAuthEnabled") === "1";
        window.location.href = `/login?reason=${reason}${dbg ? "&debugAuth=1" : ""}`;
      } else {
        setIsLoading(false);
        setReady(true);
      }
      return;
    }

    setToken(storedToken);

    // Do not call /api/me on public routes; treat as logged-out view
    if (isPublic) {
      setIsLoading(false);
      setReady(true);
      return;
    }

    const runRestore = async () => {
      const token = readTokenSafe();
      if (!token) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        setReady(true);
        return;
      }
      try {
        const me = await apiRestoreSession();
        if (!me?.user) {
          setUser(null);
          setToken(null);
          clearStoredToken();
          if (import.meta.env.DEV) {
            console.warn("[auth] restore missing user payload");
          }
          return;
        }
        setUser(me.user);
      } catch (e: any) {
        const msg = String(e?.message ?? "");
        if (msg.toLowerCase().includes("unauthorized") || msg.includes("401")) {
          setUser(null);
        } else {
          console.error("Failed to restore auth session", e);
          setUser(null);
        }
        setToken(null);
        clearStoredToken();
      } finally {
        setIsLoading(false);
        setReady(true);
      }
    };

    void runRestore();
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      opts?: RequestInit
    ): Promise<{ requires2fa: boolean }> => {
      setIsLoading(true);
      try {
        const response = await apiLogin(email, password, opts);

        if (response.requires2fa) {
          setTwoFactorPendingToken(response.pendingToken ?? null);
          setTwoFactorMethods(response.methods ?? ["totp"]);
          return { requires2fa: true };
        }

        if (response.token && response.user) {
          storeToken(response.token);
          setToken(response.token);
          setUser(response.user);
          setTwoFactorPendingToken(null);
          setTwoFactorMethods([]);
          if (import.meta.env.DEV) {
            const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
            console.info("[auth] login stored token", {
              stored: !!stored,
              len: stored?.length || 0,
            });
          }
          return { requires2fa: false };
        }

        throw new Error("Invalid login response");
      } catch (error) {
        // Make sure we clear any stale auth state on failed login
        clearStoredToken();
        setToken(null);
        setUser(null);
        setTwoFactorPendingToken(null);
        setTwoFactorMethods([]);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const loginDemo = useCallback(async (plan: string = "core") => {
    setIsLoading(true);
    try {
      const demoEmail = import.meta.env.DEV ? "demo@rentchain.dev" : "";
      const response = await apiLogin(demoEmail, "demo", {
        headers: { "x-rentchain-plan": plan },
      });

      if (response.requires2fa) {
        setTwoFactorPendingToken(response.pendingToken ?? null);
        setTwoFactorMethods(response.methods ?? ["totp"]);
        return;
      }

      if (!response.token) throw new Error("Token missing from demo login response");
      storeToken(response.token);
      setToken(response.token);
      setUser(response.user ?? null);
      setTwoFactorPendingToken(null);
      setTwoFactorMethods([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeTwoFactor = useCallback(
    (newToken: string, newUser: AuthUser) => {
      storeToken(newToken);
      setToken(newToken);
      setUser(newUser);
      setTwoFactorPendingToken(null);
      setTwoFactorMethods([]);
    },
    []
  );

  const resetTwoFactor = useCallback(() => {
    setTwoFactorPendingToken(null);
    setTwoFactorMethods([]);
  }, []);

  const logout = useCallback(async () => {
    const currentToken = getStoredToken();

    clearStoredToken();
    setToken(null);
    setUser(null);
    setTwoFactorPendingToken(null);
    setTwoFactorMethods([]);

    try {
      if (currentToken) {
        await apiLogout(currentToken);
      }
    } catch (error) {
      console.error("Failed to notify backend of logout", error);
    }
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const debugAuth = typeof window !== "undefined" && (new URLSearchParams(window.location.search).get("debugAuth") ?? "") === "1";

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      ready,
      login,
      loginDemo,
      logout,
      twoFactorPendingToken,
      twoFactorMethods,
      isTwoFactorRequired: !!twoFactorPendingToken,
      completeTwoFactor,
      resetTwoFactor,
      updateUser,
    }),
    [
      user,
      token,
      isLoading,
      ready,
      login,
      loginDemo,
      logout,
      twoFactorPendingToken,
      twoFactorMethods,
      completeTwoFactor,
      resetTwoFactor,
      updateUser,
    ]
  );

  const overlay = (() => {
    if (!debugAuth || typeof window === "undefined") return null;
    const sessionTok = window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    const localTok = window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
    const tenantSession = window.sessionStorage.getItem(TENANT_TOKEN_KEY) ?? "";
    const tenantLocal = window.localStorage.getItem(TENANT_TOKEN_KEY) ?? "";
    const previewSession = tokenPreview(sessionTok);
    const previewLocal = tokenPreview(localTok);
    const previewTenantSession = tokenPreview(tenantSession);
    const previewTenantLocal = tokenPreview(tenantLocal);

    const check = sessionTok || localTok || tenantSession || tenantLocal
      ? isTokenExpired(sessionTok || localTok || tenantSession || tenantLocal)
      : null;

    const payload = sessionTok || localTok ? decodeJwtPayload(sessionTok || localTok) : null;
    const expMs = payload?.exp ? payload.exp * 1000 : null;

    return (
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          zIndex: 9999,
          background: "rgba(0,0,0,0.8)",
          color: "#fff",
          padding: "10px 12px",
          borderRadius: 8,
          fontSize: 12,
          maxWidth: 320,
          lineHeight: 1.4,
        }}
      >
        <div><strong>debugAuth</strong></div>
        <div>host: {window.location.hostname}</div>
        <div>path: {window.location.pathname}</div>
        <div>session token: {previewSession.has ? "yes" : "no"} len={previewSession.len} {previewSession.preview}</div>
        <div>local token: {previewLocal.has ? "yes" : "no"} len={previewLocal.len} {previewLocal.preview}</div>
        <div>tenant session: {previewTenantSession.has ? "yes" : "no"} {previewTenantSession.preview}</div>
        <div>tenant local: {previewTenantLocal.has ? "yes" : "no"} {previewTenantLocal.preview}</div>
        <div>decode: {payload ? "ok" : "failed"}</div>
        <div>exp: {expMs ? `${expMs} (${new Date(expMs).toISOString()})` : "n/a"}</div>
        <div>now: {Date.now()}</div>
        <div>expired?: {check ? String(check.expired) : "n/a"}</div>
      </div>
    );
  })();

  return (
    <AuthContext.Provider value={value}>
      {overlay}
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}
