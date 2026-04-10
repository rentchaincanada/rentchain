import { tenantApiFetch } from "./tenantApiFetch";

export type TenantAccessRequest = {
  id: string;
  requestedByLabel: string;
  categories: string[];
  status: "pending";
  requestedAt: number | null;
  reviewCtaLabel: string;
};

export type TenantAccessGrant = {
  id: string;
  grantedToLabel: string;
  categories: string[];
  status: "active" | "expired" | "revoked";
  grantedAt: number | null;
  expiresAt: number | null;
  lastActivityAt: number | null;
  canRevoke: boolean;
  accessLabel: string;
};

export type TenantAccessActivity = {
  id: string;
  type: "request_submitted" | "access_granted" | "access_viewed" | "access_revoked" | "access_expired";
  title: string;
  occurredAt: number | null;
};

export type TenantAccessWorkspace = {
  summary: {
    activeGrants: number;
    pendingRequests: number;
    latestActivityAt: number | null;
  };
  pendingRequests: TenantAccessRequest[];
  activeAccess: TenantAccessGrant[];
  recentActivity: TenantAccessActivity[];
  guidance: {
    headline: string;
    body: string;
  };
};

export async function getTenantAccess(): Promise<TenantAccessWorkspace> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantAccessWorkspace }>("/tenant/access");
  return res.data;
}

export async function revokeTenantAccessShare(shareId: string): Promise<{
  ok: boolean;
  shareId: string;
  revoked: boolean;
}> {
  return tenantApiFetch<{ ok: boolean; shareId: string; revoked: boolean }>(
    `/tenant/access/${encodeURIComponent(shareId)}/revoke`,
    {
      method: "POST",
    }
  );
}
