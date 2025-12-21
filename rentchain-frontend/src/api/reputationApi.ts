import type { ReputationTimelineEvent } from "../types/models";
import { apiJson } from "./http";

export async function fetchTenantReputationTimeline(
  tenantId: string
): Promise<ReputationTimelineEvent[]> {
  try {
    const data = await apiJson<any>(
      `/tenants/${encodeURIComponent(tenantId)}/reputation/timeline`
    );
    return ((data as any)?.events || []) as ReputationTimelineEvent[];
  } catch (err: any) {
    const status = err?.status ?? err?.body?.status;
    if (status === 404) {
      return [];
    }
    const msg = err?.message || "Failed to load reputation timeline";
    throw new Error(msg);
  }
}
