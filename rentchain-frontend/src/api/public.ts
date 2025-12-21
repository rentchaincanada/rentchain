export async function joinWaitlist(payload: { email: string; name?: string }) {
  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const url = `${base}/api/waitlist`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, source: "landing" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Request failed");
  return data as { ok: true; already: boolean };
}
