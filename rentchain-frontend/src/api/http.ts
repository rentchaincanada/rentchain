const RAW_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const API_BASE = RAW_BASE.endsWith("/") ? RAW_BASE.slice(0, -1) : RAW_BASE;

export type ApiError = Error & { status?: number; body?: any };

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string } = {}
): Promise<T> {
  const token = (opts as any)?.token;
  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");
  headers.set("x-api-client", "apiFetch");
  headers.set("X-Rentchain-ApiClient", "1");
  if (!headers.has("Content-Type") && opts.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const finalPath = normalizedPath.startsWith("/api/")
    ? normalizedPath
    : `${API_BASE}${normalizedPath}`;

  const res = await fetch(finalPath, {
    ...opts,
    headers,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    const err: ApiError = Object.assign(new Error(json?.message || `Request failed (${res.status})`), {
      status: res.status,
      body: json ?? { raw: text },
    });
    throw err;
  }

  return json as T;
}

export const apiJson = apiFetch;
