// src/api/authApi.ts
import { apiFetch, apiJson } from "./http";
import { getAuthToken, setAuthToken } from "@/lib/apiClient";
import { API_BASE } from "../config/apiBase";

function authUrl(path: string) {
  const base = String(API_BASE || "").replace(/\/$/, "");
  const normalized = path.startsWith("/api/")
    ? path
    : `/api${path.startsWith("/") ? path : `/${path}`}`;
  return `${base}${normalized}`;
}

export interface AuthUser {
  id: string;
  email: string;
  screeningCredits?: number;
  role?: string;
  permissions?: string[];
  plan?: string;
}

export interface LoginResponse {
  token?: string;
  user?: AuthUser;
  requires2fa?: boolean;
  pendingToken?: string;
  methods?: string[];
}

export interface TwoFaVerifyResponse {
  token: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

export interface TotpSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export interface TotpConfirmResponse {
  success: boolean;
  backupCodes: string[];
}

export interface BackupCodesRegenerateResponse {
  success: boolean;
  backupCodes: string[];
}

export interface TrustDeviceResponse {
  success: boolean;
  trustedDeviceToken: string;
}

export interface Disable2faResponse {
  success: boolean;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const error = await res.json();
      if (error?.error) {
        message = error.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function login(
  email: string,
  password: string,
  opts: RequestInit = {}
): Promise<LoginResponse> {
  if (import.meta.env.DEV) {
    console.log("login payload", { email, password: password ? "***" : "" });
  }

  const headers = new Headers(opts.headers || {});
  headers.set("Content-Type", "application/json");

  const res = await apiJson<LoginResponse>(authUrl("/auth/login"), {
    method: "POST",
    ...opts,
    headers,
    body: JSON.stringify({ email, password }),
  });

  const token = (res as any)?.token;
  if (!token) throw new Error("Token missing from login response");
  setAuthToken(token);

  return res;
}

export async function loginDemo(plan: string = "core"): Promise<LoginResponse> {
  return login("demo@rentchain.dev", "demo", {
    headers: { "x-rentchain-plan": plan },
  });
}

export async function verifyTwoFactorCode(
  pendingToken: string,
  method: string,
  code: string
): Promise<TwoFaVerifyResponse> {
  const res = await apiFetch<TwoFaVerifyResponse>(authUrl("/auth/2fa/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingToken, method, code }),
  });

  return res;
}

export async function startTotpSetup(): Promise<TotpSetupResponse> {
  const response = await apiFetch<TotpSetupResponse>(
    authUrl("/auth/2fa/totp/setup"),
    {
      method: "POST",
      token: getAuthToken() ?? undefined,
    }
  );
  return response;
}

export async function confirmTotpSetup(code: string): Promise<TotpConfirmResponse> {
  const response = await apiFetch<TotpConfirmResponse>(
    authUrl("/auth/2fa/totp/confirm"),
    {
      method: "POST",
      token: getAuthToken() ?? undefined,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }
  );

  return response;
}

export async function regenerateBackupCodes(code: string): Promise<BackupCodesRegenerateResponse> {
  return apiFetch<BackupCodesRegenerateResponse>(
    authUrl("/auth/2fa/backup-codes/regenerate"),
    {
      method: "POST",
      token: getAuthToken() ?? undefined,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }
  );
}

export async function trustDevice(code: string, deviceName?: string): Promise<TrustDeviceResponse> {
  return apiFetch<TrustDeviceResponse>(authUrl("/auth/2fa/trust-device"), {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, deviceName }),
  });
}

export async function disable2fa(code: string): Promise<Disable2faResponse> {
  return apiFetch<Disable2faResponse>(authUrl("/auth/2fa/disable"), {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function getCurrentUser(token: string): Promise<MeResponse> {
  const res = await fetch(authUrl("/auth/me"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<MeResponse>(res);
}

export async function restoreSession(): Promise<{ user: any | null }> {
  try {
    const res = await apiFetch<any>(authUrl("/me"));
    if (res && typeof res === "object") {
      if ("user" in res) {
        return { user: (res as any).user ?? null };
      }

      const landlordId = (res as any).landlordId || (res as any).id;
      const email = (res as any).email;
      if (landlordId || email) {
        return {
          user: {
            id: String(landlordId ?? ""),
            email: String(email ?? ""),
            screeningCredits: 0,
          },
        };
      }
    }

    return { user: null };
  } catch (e: any) {
    throw e;
  }
}

export async function logout(token?: string): Promise<void> {
  await apiJson("/auth/logout", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function logoutLocal() {
  localStorage.removeItem("rentchain_token");
  sessionStorage.removeItem("rentchain_token");
}
