import { resolveApiUrl } from "../lib/apiClient";

export async function joinWaitlist(payload: { email: string; name?: string }) {
  console.log("[joinWaitlist] posting to", resolveApiUrl("/api/public/waitlist"));
  const res = await fetch(resolveApiUrl("/api/public/waitlist"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, source: "landing" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Request failed");
  return data as { ok: true; emailed: boolean };
}
