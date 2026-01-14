import { API_BASE_URL } from "./config";

type Jsonish = Record<string, any>;
type TenantApiInit = Omit<RequestInit, "body"> & { body?: BodyInit | Jsonish };

const TENANT_TOKEN_KEY = "rentchain_tenant_token";

export async function tenantApiFetch<T = any>(path: string, init: TenantApiInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("API_BASE_URL is not configured");
  const base = API_BASE_URL.replace(/\/$/, "");

  const url = (() => {
    if (path.startsWith("http")) return path;
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  })();

  const token = sessionStorage.getItem(TENANT_TOKEN_KEY) || localStorage.getItem(TENANT_TOKEN_KEY) || "";

  const headers: Record<string, string> = {
    ...(init.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let bodyToSend: any = init.body;
  const isPlainObject =
    bodyToSend &&
    typeof bodyToSend === "object" &&
    !(bodyToSend instanceof FormData) &&
    !(bodyToSend instanceof Blob) &&
    !(bodyToSend instanceof ArrayBuffer) &&
    !(bodyToSend instanceof URLSearchParams);
  if (isPlainObject) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    bodyToSend = JSON.stringify(bodyToSend);
  }

  const res = await fetch(url, { ...init, headers, body: bodyToSend });
  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err: any = new Error(data?.error || data?.message || text || `tenantApiFetch ${res.status}`);
    err.payload = data ?? text;
    throw err;
  }

  return (data as T) ?? (text as unknown as T);
}
