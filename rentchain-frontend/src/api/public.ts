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
  referralCode?: string;
}) {
  const useReferralFlow = Boolean(payload.referralCode);
  const url = useReferralFlow
    ? `${window.location.origin}/api/public/landlord-inquiry`
    : `${window.location.origin}/api/access/request`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || "Request failed");
  return data as { ok: true; emailed?: boolean; adminNotified?: boolean };
}
