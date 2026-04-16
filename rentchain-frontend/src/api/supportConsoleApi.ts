import { apiFetch } from "./apiFetch";
import type { TimelineItem } from "./timelineApi";

export type SupportConsoleResourceResponse = {
  resource: {
    type: string;
    id: string;
    title?: string | null;
    subtitle?: string | null;
    status?: string | null;
    parentType?: string | null;
    parentId?: string | null;
  };
  timeline: TimelineItem[];
  insight?: Record<string, unknown> | null;
  policyDecisions: Array<{
    id: string;
    timestamp: string;
    action?: string | null;
    outcome?: string | null;
    reasonCodes?: string[];
    summary?: string | null;
  }>;
  automation: Array<{
    id: string;
    timestamp: string;
    action?: string | null;
    executed: boolean;
    skipped: boolean;
    reason?: string | null;
    summary?: string | null;
  }>;
  reconciliation?: Record<string, unknown> | null;
  debug: {
    canonicalEventCount: number;
    domainsPresent: string[];
    identifiers?: Record<string, string | null | undefined>;
  };
};

export async function fetchSupportConsoleResource(
  resourceType: string,
  resourceId: string
): Promise<SupportConsoleResourceResponse> {
  const search = new URLSearchParams();
  search.set("resourceType", resourceType);
  search.set("resourceId", resourceId);
  return await apiFetch<SupportConsoleResourceResponse>(
    `/admin/support-console/resource?${search.toString()}`
  );
}

