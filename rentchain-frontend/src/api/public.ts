export async function joinWaitlist(payload: { email: string; name?: string }) {
  const url = `${window.location.origin}/api/waitlist`;
  console.log("[joinWaitlist] posting to", url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, source: "landing" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Request failed");
  return data as { ok: true; emailed: boolean };
}

export async function requestLandlordInquiry(payload: {
  email: string;
  firstName: string;
  portfolioSize: string;
  note?: string;
}) {
  const url = `${window.location.origin}/api/public/landlord-inquiry`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Request failed");
  return data as { ok: true; emailed?: boolean; adminNotified?: boolean };
}
