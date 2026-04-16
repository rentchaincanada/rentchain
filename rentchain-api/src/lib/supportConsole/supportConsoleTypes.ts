import type { TimelineItem } from "../timeline/timelineAdapter";
import type { ResolutionRecordV1 } from "../resolution/resolutionTypes";

export type SupportConsoleResourceSummary = {
  type: string;
  id: string;
  title?: string | null;
  subtitle?: string | null;
  status?: string | null;
  parentType?: string | null;
  parentId?: string | null;
};

export type SupportConsolePolicyDecision = {
  id: string;
  timestamp: string;
  action?: string | null;
  outcome?: string | null;
  reasonCodes?: string[];
  summary?: string | null;
};

export type SupportConsoleAutomationItem = {
  id: string;
  timestamp: string;
  action?: string | null;
  executed: boolean;
  skipped: boolean;
  reason?: string | null;
  summary?: string | null;
};

export type SupportConsoleResourceResponse = {
  resource: SupportConsoleResourceSummary;
  timeline: TimelineItem[];
  insight?: Record<string, unknown> | null;
  policyDecisions: SupportConsolePolicyDecision[];
  automation: SupportConsoleAutomationItem[];
  reconciliation?: Record<string, unknown> | null;
  resolution?: ResolutionRecordV1 | null;
  debug: {
    canonicalEventCount: number;
    domainsPresent: string[];
    identifiers?: Record<string, string | null | undefined>;
  };
};
