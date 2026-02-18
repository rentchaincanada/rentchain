import { apiFetch } from "./apiFetch";

export type TenantInvite = {
  id?: string;
  token: string;
  landlordId?: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantEmail?: string | null;
  tenantName?: string | null;
  status?: string;
  createdAt?: number | null;
  redeemedAt?: number | null;
  inviteUrl?: string;
};

export async function listTenantInvites(): Promise<{ items: TenantInvite[] }> {
  return apiFetch<{ items: TenantInvite[] }>("/tenant-invites");
}

export async function createTenantInvite(payload: {
  propertyId: string;
  unitId: string;
  tenantEmail: string;
  tenantName?: string;
  leaseId?: string | null;
}) {
  return apiFetch<{
    ok: boolean;
    token: string;
    inviteUrl?: string;
    invite?: TenantInvite;
    expiresAt?: number;
    emailed?: boolean;
  }>("/tenant-invites", {
    method: "POST",
    body: payload,
  });
}

export async function redeemTenantInvite(token: string) {
  return apiFetch("/tenant-invites/redeem", {
    method: "POST",
    body: { token },
  });
}
