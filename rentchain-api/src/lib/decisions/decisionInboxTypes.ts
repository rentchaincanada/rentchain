export type DecisionInboxSeverity = "critical" | "high" | "medium" | "low" | "info" | "unknown";

export type DecisionInboxStatus = "open" | "pending" | "blocked" | "resolved" | "dismissed" | "unknown";

export type DecisionInboxType =
  | "lease"
  | "screening"
  | "maintenance"
  | "compliance"
  | "admin"
  | "property"
  | "tenant"
  | "billing"
  | "unknown";

export type DecisionInboxSource = "dashboard" | "lease_ledger" | "admin_review" | "analytics" | "unknown";

export type DecisionInboxRelatedEntity = {
  kind: "lease" | "application" | "tenant" | "property" | "unit" | "maintenance_request" | "unknown";
  id: string;
  label: string;
};

export type DecisionInboxItem = {
  id: string;
  title: string;
  description: string;
  severity: DecisionInboxSeverity;
  status: DecisionInboxStatus;
  type: DecisionInboxType;
  source: DecisionInboxSource;
  relatedEntity: DecisionInboxRelatedEntity | null;
  destination: string | null;
  automationEligible: false;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DecisionInboxFilters = {
  severity: DecisionInboxSeverity[];
  status: DecisionInboxStatus[];
  type: DecisionInboxType[];
};

export type DecisionInboxSummary = {
  total: number;
  critical: number;
  high: number;
  open: number;
  blocked: number;
};

export type DecisionInboxResult = {
  items: DecisionInboxItem[];
  filters: DecisionInboxFilters;
  summary: DecisionInboxSummary;
};
