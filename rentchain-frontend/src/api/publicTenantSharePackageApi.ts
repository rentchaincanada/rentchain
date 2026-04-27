import { apiFetch } from "./apiFetch";

export type PublicTenantSharePackage = {
  identity?: {
    identityStatus: "incomplete" | "ready" | "verified" | "limited";
    verification: {
      level: "none" | "partial" | "strong";
    };
    readinessLabel: string;
    readinessDescription: string;
  };
  credibilitySummary?: {
    completenessLevel: "low" | "medium" | "high";
    verificationLevel: "none" | "partial" | "strong";
    summaryLabel: string;
    summaryDescription: string;
  };
  application?: {
    reusable: boolean;
  };
  documents?: {
    completionStatus: "complete" | "in_progress" | "missing" | "needs_attention";
  };
  leaseSummary?: {
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    monthlyRent: number | null;
  };
  paymentReadinessSummary?: {
    readinessStatus: "not_ready" | "ready_to_configure" | "blocked";
    readinessLabel: string;
    readinessDescription: string;
    requiredNextAction: "complete_lease_details" | "review_rent_terms" | "confirm_payment_setup_later" | "none";
  };
  identityExchangeReference?: {
    referenceType: "tenant_identity_reference";
    referenceStatus: "available" | "limited" | "not_ready";
    referenceLabel: string;
    referenceDescription: string;
    portabilityStatus: "ready" | "limited" | "not_ready";
  };
  availability: {
    canRequestMore: boolean;
    availableSections: Array<
      "identity" | "credibilitySummary" | "application" | "documents" | "leaseSummary" | "paymentReadinessSummary"
    >;
  };
  generatedAt: string;
};

export async function fetchPublicTenantSharePackage(token: string): Promise<PublicTenantSharePackage | null> {
  const res = await apiFetch<{ ok: boolean; data: PublicTenantSharePackage }>(
    `/public/share/${encodeURIComponent(token)}`,
    {
      method: "GET",
      allow404: true,
      suppressToasts: true,
    }
  );
  return res?.data ?? null;
}

export async function requestPublicTenantSharePackageItems(
  token: string,
  requestedItems: Array<"identity_summary" | "credibility_summary" | "application_summary" | "documents_summary">
): Promise<{ requestedItems: typeof requestedItems }> {
  const res = await apiFetch<{ ok: boolean; data: { requestedItems: typeof requestedItems } }>(
    `/public/share/${encodeURIComponent(token)}/request`,
    {
      method: "POST",
      body: { requestedItems },
      suppressToasts: true,
    }
  );
  return res.data;
}

export async function requestPublicTenantSharePackageVerification(
  token: string,
  requestedScopes: Array<
    | "credibility_summary"
    | "application_summary"
    | "documents_summary"
    | "lease_summary"
    | "payment_readiness_summary"
  >
): Promise<{ status: "requested"; requestedScopes: typeof requestedScopes }> {
  const res = await apiFetch<{ ok: boolean; data: { status: "requested"; requestedScopes: typeof requestedScopes } }>(
    `/public/share/${encodeURIComponent(token)}/verification-request`,
    {
      method: "POST",
      body: { requestedScopes },
      suppressToasts: true,
    }
  );
  return res.data;
}
