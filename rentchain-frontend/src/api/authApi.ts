// src/api/authApi.ts
import { apiFetch, apiJson } from "./http";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/apiClient";
import { awaitFirebaseAuthReady } from "@/lib/firebaseAuthToken";

export interface AuthUser {
  id: string;
  email: string;
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

  const res = await apiJson<LoginResponse>("/api/auth/login", {
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

export async function signup(
  email: string,
  password: string,
  fullName?: string
): Promise<LoginResponse> {
  const response = await apiJson<LoginResponse>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName }),
  });
  const token = (response as any)?.token;
  if (!token) throw new Error("Token missing from signup response");
  setAuthToken(token);
  return response;
}

export async function loginDemo(plan: string = "core"): Promise<LoginResponse> {
  const demoEmail = import.meta.env.DEV ? "demo@rentchain.dev" : "";
  return login(demoEmail, "demo", {
    headers: { "x-rentchain-plan": plan },
  });
}

export async function verifyTwoFactorCode(
  pendingToken: string,
  method: string,
  code: string
): Promise<TwoFaVerifyResponse> {
  const res = await apiFetch<TwoFaVerifyResponse>("/api/auth/2fa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingToken, method, code }),
  });

  return res;
}

export async function startTotpSetup(): Promise<TotpSetupResponse> {
  const response = await apiFetch<TotpSetupResponse>("/api/auth/2fa/totp/setup", {
    method: "POST",
    token: getAuthToken() ?? undefined,
  });
  return response;
}

export async function confirmTotpSetup(code: string): Promise<TotpConfirmResponse> {
  const response = await apiFetch<TotpConfirmResponse>("/api/auth/2fa/totp/confirm", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  return response;
}

export async function regenerateBackupCodes(code: string): Promise<BackupCodesRegenerateResponse> {
  return apiFetch<BackupCodesRegenerateResponse>("/api/auth/2fa/backup-codes/regenerate", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function trustDevice(code: string, deviceName?: string): Promise<TrustDeviceResponse> {
  return apiFetch<TrustDeviceResponse>("/api/auth/2fa/trust-device", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, deviceName }),
  });
}

export async function disable2fa(code: string): Promise<Disable2faResponse> {
  return apiFetch<Disable2faResponse>("/auth/2fa/disable", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export async function getCurrentUser(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me", {
    method: "GET",
    token,
  });
}

export async function restoreSession(): Promise<{ user: any | null }> {
  // Fast path: if no token stored, skip any network calls
  if (typeof window !== "undefined") {
    const raw = getAuthToken();
    const t = (raw ?? "").trim();
    if (!t || t === "null" || t === "undefined" || t.split(".").length !== 3) {
      const fb = await awaitFirebaseAuthReady().catch(() => ({ ready: true, user: null }));
      if (!fb?.user) {
        return { user: null };
      }
    }
  }

  let shouldFallbackToAuthMe = false;
  try {
    const me = await apiFetch<{ ok?: boolean; user?: AuthUser }>("/me");
    if (me?.user) {
      return { user: me.user };
    }
    shouldFallbackToAuthMe = true;
  } catch (e: any) {
    const status = Number(e?.status || e?.body?.status || 0);
    if (status === 401) {
      shouldFallbackToAuthMe = true;
    } else {
      if (import.meta.env.DEV) {
        console.warn("[auth] /me hydration failed", { status, message: String(e?.message || "") });
      }
      return { user: null };
    }
  }

  if (!shouldFallbackToAuthMe) {
    return { user: null };
  }

  let res: any = null;
  try {
    res = await apiFetch<any>("/auth/me");
  } catch {
    return { user: null };
  }
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
        },
      };
    }
  }

  return { user: null };
}

export async function logout(token?: string): Promise<void> {
  await apiJson("/api/auth/logout", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function logoutLocal() {
  clearAuthToken();
}
