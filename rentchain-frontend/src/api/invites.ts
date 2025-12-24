export type InviteInfo = {
  ok: boolean;
  inviteId: string;
  campaign: string;
  inviteStatus: string;
  waitlistId: string;
  waitlistStatus: string;
  email?: string | null;
  name?: string | null;
  sentAt?: number | null;
  acceptedAt?: number | null;
};

export async function fetchInvite(inviteId: string): Promise<InviteInfo> {
  const r = await fetch(`/api/public/invites/${encodeURIComponent(inviteId)}`);
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || "Invite lookup failed");
  return j;
}

export async function acceptInvite(
  inviteId: string,
  payload?: { fullName?: string; companyName?: string; phone?: string }
) {
  const r = await fetch(`/api/public/invites/${encodeURIComponent(inviteId)}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(j.error || "Invite accept failed");
  return j;
}
