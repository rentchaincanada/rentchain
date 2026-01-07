import api from "./client";

export type TenantInvite = {
  id?: string;
  token: string;
  landlordId?: string;
  propertyId?: string | null;
  tenantEmail?: string | null;
  tenantName?: string | null;
  status?: string;
  createdAt?: number | null;
  redeemedAt?: number | null;
  inviteUrl?: string;
};

export async function listTenantInvites(): Promise<{ items: TenantInvite[] }> {
  const res = await api.get("/api/tenant-invites");
  return res.data;
}

export async function createTenantInvite(payload: {
  propertyId: string;
  tenantEmail: string;
  tenantName?: string;
}) {
  const res = await api.post("/api/tenant-invites", payload);
  return res.data as {
    ok: boolean;
    token: string;
    inviteUrl?: string;
    invite?: TenantInvite;
    expiresAt?: number;
  };
}

export async function redeemTenantInvite(token: string) {
  const res = await api.post("/api/tenant-invites/redeem", { token });
  return res.data;
}
