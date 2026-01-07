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

  // Legacy migration: if an older build wrote to localStorage, move it to sessionStorage
  const legacy = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (legacy) {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, legacy);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return legacy;
  }

  return null;
}

function storeToken(token: string) {
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(TENANT_TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ready, setReady] = useState<boolean>(false);
  const [twoFactorPendingToken, setTwoFactorPendingToken] =
    useState<string | null>(null);
  const [twoFactorMethods, setTwoFactorMethods] = useState<string[]>([]);

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      setToken(stored);
      setIsLoading(false);
    }
  }, []);

  // On initial mount, attempt to restore session from localStorage token
  useEffect(() => {
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "";
    const isPublic = PUBLIC_ROUTE_ALLOWLIST.includes(pathname);
    const storedToken = getStoredToken();
    const hasToken = Boolean(storedToken);

    // No token: stay logged out, skip /api/me on public routes, and don't redirect
    if (!hasToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      setReady(true);
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
          setIsLoading(false);
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
        // redirect only on protected routes when a token actually existed
        if (!isPublic && hasToken && typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          params.set("reason", "expired");
          window.location.href = `/login?${params.toString()}`;
        }
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
      const response = await apiLogin("demo@rentchain.dev", "demo", {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider />");
  }
  return ctx;
}
