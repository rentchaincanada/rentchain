// src/api/authApi.ts
import { apiFetch, apiJson } from "./http";
import { getAuthToken, setAuthToken, resolveApiUrl } from "@/lib/apiClient";

export interface AuthUser {
  id: string;
  email: string;
  screeningCredits?: number;
  role?: string;
  landlordId?: string;
  tenantId?: string;
  leaseId?: string;
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

  const res = await apiJson<LoginResponse>("auth/login", {
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
  const res = await apiFetch<TwoFaVerifyResponse>("auth/2fa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingToken, method, code }),
  });

  return res;
}

export async function startTotpSetup(): Promise<TotpSetupResponse> {
  const response = await apiFetch<TotpSetupResponse>("auth/2fa/totp/setup", {
    method: "POST",
    token: getAuthToken() ?? undefined,
  });
  return response;
}

export async function confirmTotpSetup(code: string): Promise<TotpConfirmResponse> {
  const response = await apiFetch<TotpConfirmResponse>("auth/2fa/totp/confirm", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  return response;
}

export async function regenerateBackupCodes(code: string): Promise<BackupCodesRegenerateResponse> {
  return apiFetch<BackupCodesRegenerateResponse>("auth/2fa/backup-codes/regenerate", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function trustDevice(code: string, deviceName?: string): Promise<TrustDeviceResponse> {
  return apiFetch<TrustDeviceResponse>("auth/2fa/trust-device", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, deviceName }),
  });
}

export async function disable2fa(code: string): Promise<Disable2faResponse> {
  return apiFetch<Disable2faResponse>("auth/2fa/disable", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function getCurrentUser(token: string): Promise<MeResponse> {
  const res = await fetch(resolveApiUrl("auth/me"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse<MeResponse>(res);
}

export async function restoreSession(): Promise<{ user: any | null }> {
  try {
    // Prefer auth/me which returns the decoded token payload
    const authMe = await apiFetch<{ ok?: boolean; user?: AuthUser }>("auth/me");
    if (authMe?.user) {
      return { user: authMe.user };
    }
  } catch (e: any) {
    // fall through to /me fallback
  }

  const res = await apiFetch<any>("me");
  if (res && typeof res === "object") {
    if ("user" in res) {
      return { user: (res as any).user ?? null };
    }

    const landlordId = (res as any).landlordId || (res as any).id;
    const email = (res as any).email;
    const role = (res as any).role;
    const tenantId = (res as any).tenantId;
    const leaseId = (res as any).leaseId;
    if (landlordId || email || tenantId) {
      return {
        user: {
          id: String(landlordId ?? tenantId ?? ""),
          email: String(email ?? ""),
          role,
          tenantId: tenantId ?? undefined,
          leaseId: leaseId ?? undefined,
          screeningCredits: 0,
        },
      };
    }
  }

  return { user: null };
}

export async function logout(token?: string): Promise<void> {
  await apiJson("auth/logout", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function logoutLocal() {
  localStorage.removeItem("rentchain_token");
  sessionStorage.removeItem("rentchain_token");
}
