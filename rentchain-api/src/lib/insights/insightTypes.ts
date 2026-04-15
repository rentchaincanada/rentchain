export type InsightDomain =
  | "screening"
  | "maintenance"
  | "lease"
  | "expense"
  | "application"
  | "system";

export type DerivedInsightV1 = {
  version: "v1";
  resourceType: string;
  resourceId: string;
  domain: InsightDomain;
  generatedAt: string;
  summary: {
    lifecycleState?: string | null;
    blockedCount?: number;
    reopenCount?: number;
    eventCount?: number;
    firstEventAt?: string | null;
    lastEventAt?: string | null;
    durationMs?: number | null;
  };
  metrics?: Record<string, number | null>;
  tags?: string[];
  notes?: string[];
};
