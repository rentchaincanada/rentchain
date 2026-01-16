import { getTenantToken } from "./tenantAuth";

export async function tenantApiFetch(path: string, opts: RequestInit = {}) {
  const cleanPath = path.startsWith("/api/") ? path.slice(4) : path;
  const url = `/api${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;

  const token = getTenantToken();

  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    const payload = isJson
      ? await res.json().catch(() => null)
      : await res.text().catch(() => "");
    const errPayload = res.status === 401 ? { error: "UNAUTHORIZED" } : payload;
    const err: any = new Error(
      `tenantApiFetch ${res.status}: ${isJson ? JSON.stringify(errPayload) : String(errPayload)}`
    );
    err.payload = errPayload;
    err.status = res.status;
    throw err;
  }

  return isJson ? res.json() : { ok: true, text: await res.text() };
}
