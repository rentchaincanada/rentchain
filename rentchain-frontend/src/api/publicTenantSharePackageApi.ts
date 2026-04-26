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
  availability: {
    canRequestMore: boolean;
    availableSections: Array<"identity" | "credibilitySummary" | "application" | "documents">;
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
