import { tenantApiFetch } from "./tenantApiFetch";

export type TenantShareVerificationRequestScope =
  | "identity_summary"
  | "credibility_summary"
  | "application_summary"
  | "documents_summary"
  | "lease_summary"
  | "payment_readiness_summary";

export type IdentityExchangeReference = {
  referenceType: "tenant_identity_reference";
  referenceStatus: "available" | "limited" | "not_ready";
  referenceLabel: string;
  referenceDescription: string;
  portabilityStatus: "ready" | "limited" | "not_ready";
  exchangeReadiness: {
    identityReady: boolean;
    credibilityReady: boolean;
    sharingControlsReady: boolean;
    auditTimelineReady: boolean;
    paymentReadinessAvailable: boolean;
  };
};

export type TenantSharePackageLink = {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: "active";
  permissions: {
    identitySummary: boolean;
    credibilitySummary: boolean;
    applicationSummary: boolean;
    documents: "none" | "summary" | "approved_only";
    leaseSummary: boolean;
    paymentReadinessSummary: boolean;
  };
  requestedItems: TenantShareVerificationRequestScope[];
  approvedItems: TenantShareVerificationRequestScope[];
  verificationRequests: Array<{
    requestId: string;
    requestedByType: "landlord" | "internal" | "future_institution";
    requestedScopes: TenantShareVerificationRequestScope[];
    status: "requested" | "approved" | "declined" | "revoked" | "expired";
    createdAt: number;
    expiresAt?: number;
  }>;
  identityExchangeReference: IdentityExchangeReference | null;
};

export type TenantSharePackageCreated = TenantSharePackageLink & {
  shareUrl: string;
};

export async function createTenantSharePackage(expiresInDays = 7): Promise<TenantSharePackageCreated> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantSharePackageCreated }>("/tenant/share-packages", {
    method: "POST",
    body: { expiresInDays },
  });
  return res.data;
}

export async function listTenantSharePackages(): Promise<TenantSharePackageLink[]> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantSharePackageLink[] }>("/tenant/share-packages");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function revokeTenantSharePackage(id: string): Promise<void> {
  await tenantApiFetch(`/tenant/share-packages/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function respondToTenantSharePackage(
  id: string,
  approvedItems: TenantShareVerificationRequestScope[]
): Promise<TenantSharePackageLink> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantSharePackageLink }>(
    `/tenant/share-packages/${encodeURIComponent(id)}/respond`,
    {
      method: "POST",
      body: { approvedItems },
    }
  );
  return res.data;
}

export async function respondToTenantShareVerificationRequest(
  sharePackageId: string,
  requestId: string,
  approvedScopes: TenantShareVerificationRequestScope[]
): Promise<TenantSharePackageLink> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantSharePackageLink }>(
    `/tenant/share-packages/${encodeURIComponent(sharePackageId)}/verification-requests/${encodeURIComponent(requestId)}/respond`,
    {
      method: "POST",
      body: { approvedScopes },
    }
  );
  return res.data;
}

export async function revokeTenantShareVerificationRequest(
  sharePackageId: string,
  requestId: string
): Promise<TenantSharePackageLink> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantSharePackageLink }>(
    `/tenant/share-packages/${encodeURIComponent(sharePackageId)}/verification-requests/${encodeURIComponent(requestId)}/revoke`,
    {
      method: "POST",
    }
  );
  return res.data;
}
