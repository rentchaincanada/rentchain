import { apiFetch } from "./http";

export async function joinWaitlist(payload: { email: string; name?: string }) {
  return apiFetch<{ ok: true; emailed: boolean }>("/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, source: "landing" }),
  });
}

export async function requestLandlordInquiry(payload: {
  email: string;
  firstName: string;
  portfolioSize: string;
  note?: string;
  referralCode?: string;
}) {
  const useReferralFlow = Boolean(payload.referralCode);
  const path = useReferralFlow ? "/public/landlord-inquiry" : "/access/request";
  return apiFetch<{ ok: true; emailed?: boolean; adminNotified?: boolean }>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
