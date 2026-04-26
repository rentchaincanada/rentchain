import { apiFetch } from "./apiFetch";

export type PublicTenantSharePackage = {
  identity: {
    identityStatus: "incomplete" | "ready" | "verified" | "limited";
    verification: {
      level: "none" | "partial" | "strong";
    };
    readinessLabel: string;
    readinessDescription: string;
  };
  profile: {
    completionStatus: "complete" | "in_progress" | "missing" | "needs_attention";
  };
  application: {
    reusable: boolean;
  };
  documents: {
    completionStatus: "complete" | "in_progress" | "missing" | "needs_attention";
  };
  screening: {
    status: "not_started" | "in_progress" | "completed" | "needs_attention" | "blocked";
  };
  leases: {
    summary: {
      activeCount: number;
      historicalCount: number;
    };
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
