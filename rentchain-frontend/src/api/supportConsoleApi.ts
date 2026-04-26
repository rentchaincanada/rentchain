import { apiFetch } from "./apiFetch";
import type { SlaEvaluationV1 } from "./adminSlaApi";
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
  sla?: SlaEvaluationV1 | null;
  assignment?: AssignmentRecordV1 | null;
  resolution?: ResolutionRecordV1 | null;
  watch?: {
    version: "v1";
    id: string;
    target: {
      type: "portfolio" | "application" | "maintenance" | "lease";
      id: string;
      portfolioId?: string | null;
    };
    createdAt: string;
    updatedAt: string;
    createdBy?: string | null;
    notes?: string | null;
    tags?: string[];
    isActive: boolean;
  } | null;
  debug: {
    canonicalEventCount: number;
    domainsPresent: string[];
    identifiers?: Record<string, string | null | undefined>;
  };
};

export type ResolutionStatus = "open" | "acknowledged" | "in_progress" | "resolved" | "dismissed";

export type AssignmentRecordV1 = {
  version: "v1";
  id: string;
  resource: {
    type: string;
    id: string;
  };
  currentOwner: {
    ownerId?: string | null;
    ownerLabel?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  history: Array<{
    id: string;
    timestamp: string;
    action: "set" | "changed" | "cleared";
    fromOwnerId?: string | null;
    fromOwnerLabel?: string | null;
    toOwnerId?: string | null;
    toOwnerLabel?: string | null;
    authorId?: string | null;
    authorRole?: string | null;
    note?: string | null;
  }>;
  metadata?: Record<string, unknown>;
};

export type ResolutionRecordV1 = {
  version: "v1";
  id: string;
  resource: {
    type: string;
    id: string;
  };
  triage: {
    category?: string | null;
    severity?: string | null;
    reasonCode?: string | null;
  };
  status: ResolutionStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  dismissedAt?: string | null;
  notes: Array<{
    id: string;
    createdAt: string;
    authorId?: string | null;
    authorRole?: string | null;
    message: string;
  }>;
  history: Array<{
    id: string;
    timestamp: string;
    fromStatus?: ResolutionStatus | null;
    toStatus: ResolutionStatus;
    authorId?: string | null;
    authorRole?: string | null;
    reason?: string | null;
  }>;
  metadata?: Record<string, unknown>;
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
