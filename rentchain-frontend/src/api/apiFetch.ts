import { API_BASE_URL } from "./config";

export async function apiFetch<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token =
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token");

  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers: Record<string, string> = {
    ...(init.headers as any),
  };

  // Mark requests coming from our API helpers so the dev fetch-guard doesn't warn
  headers["X-Rentchain-ApiClient"] = "1";

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 403 && data?.error === "PLAN_LIMIT") {
      window.dispatchEvent(
        new CustomEvent("upgrade:plan-limit", {
          detail: {
            limitType: data?.limitType,
            max: data?.limit,
            message: data?.message,
          },
        })
      );
    }
    const msg = data?.message || data?.error || text || `apiFetch ${res.status}`;
    throw new Error(msg);
  }

  return (data as T) ?? (text as unknown as T);
}
