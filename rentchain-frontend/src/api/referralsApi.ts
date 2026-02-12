import { apiFetch } from "../lib/apiClient";

export type ReferralRecord = {
  id: string;
  refereeEmail: string;
  refereeName?: string | null;
  status: "sent" | "accepted" | "approved" | "expired";
  referralCode: string;
  createdAt: number;
  acceptedAt?: number | null;
  approvedAt?: number | null;
};

export async function listReferrals(): Promise<ReferralRecord[]> {
  const res = await apiFetch("/referrals", { method: "GET" });
  return Array.isArray((res as any)?.referrals) ? (res as any).referrals : [];
}

export async function createReferral(payload: {
  refereeEmail: string;
  refereeName?: string;
  note?: string;
}): Promise<{ ok: true; referral: ReferralRecord & { link?: string }; emailed?: boolean; deduped?: boolean }> {
  return apiFetch("/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }) as any;
}
