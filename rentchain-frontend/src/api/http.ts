import { resolveApiUrl } from "../lib/apiClient";
import { maybeDispatchUpgradePrompt } from "../lib/upgradePrompt";
import { getFirebaseIdToken, warnIfFirebaseDomainMismatch } from "../lib/firebaseAuthToken";
import { getAuthToken, getTenantToken } from "../lib/authToken";

export type ApiError = Error & { status?: number; body?: any };

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string } = {}
): Promise<T> {
  warnIfFirebaseDomainMismatch();
  const firebaseToken = await getFirebaseIdToken();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const isTenantPath =
    normalizedPath === "/tenant" ||
    normalizedPath.startsWith("/tenant/") ||
    normalizedPath === "/api/tenant" ||
    normalizedPath.startsWith("/api/tenant/");
  const explicitToken = (opts as any)?.token;
  const storedToken = isTenantPath ? getTenantToken() : getAuthToken();
  const token = explicitToken || storedToken;
  const effectiveToken = firebaseToken || token;
  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");
  headers.set("x-api-client", "web");
  if (!headers.has("Content-Type") && opts.body) headers.set("Content-Type", "application/json");
  if (effectiveToken) {
    headers.set("Authorization", `Bearer ${effectiveToken}`);
    headers.set("x-rc-auth", firebaseToken ? "firebase" : "bearer");
  } else {
    headers.set("x-rc-auth", "missing");
    if (import.meta.env.DEV) {
      console.warn("[api/http] missing auth token for request", { path });
    }
  }

  const res = await fetch(resolveApiUrl(normalizedPath), {
    ...opts,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    maybeDispatchUpgradePrompt(json, res.status);
    const err: ApiError = Object.assign(new Error(json?.message || `Request failed (${res.status})`), {
      status: res.status,
      body: json ?? { raw: text },
    });
    throw err;
  }

  return json as T;
}

export const apiJson = apiFetch;

type GetJsonOpts = {
  signal?: AbortSignal;
  allowStatuses?: number[];
};

export async function apiGetJson<T>(
  path: string,
  opts: GetJsonOpts = {}
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const allow = opts.allowStatuses ?? [404, 501];
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(resolveApiUrl(normalizedPath), {
    method: "GET",
    signal: opts.signal,
    headers: {
      Accept: "application/json",
      "x-api-client": "web",
    },
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (res.ok) {
    return { ok: true, data: (json as T) ?? ({} as T) };
  }

  maybeDispatchUpgradePrompt(json, res.status);

  if (allow.includes(res.status)) {
    return {
      ok: false,
      status: res.status,
      error: json?.error || json?.message || `Request failed (${res.status})`,
    };
  }

  throw Object.assign(new Error(json?.message || `Request failed (${res.status})`), {
    status: res.status,
    body: json ?? { raw: text },
  });
}
