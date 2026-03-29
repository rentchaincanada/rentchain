export type LeaseOverlapType =
  | "duplicate_current_same_unitId"
  | "duplicate_current_same_logical_unit"
  | "overlapping_dates_same_unit"
  | "stale_pointer_conflict"
  | "property_unit_mismatch";

export type LeaseOverlapSeverity = "high" | "medium" | "low";

export type LeaseOverlapAuditGroup = {
  landlordId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  unitLabel: string | null;
  overlapType: LeaseOverlapType;
  severity: LeaseOverlapSeverity;
  confidence: "high" | "medium" | "review_needed";
  leaseIds: string[];
  tenantIds: string[];
  leaseStatuses: string[];
  startDates: Array<string | null>;
  endDates: Array<string | null>;
  currentLeaseHints: string[];
  riskNotes: string[];
  sourceHints: string[];
  recommendedReviewAction: string;
  generatedAt: string;
};

export type LeaseOverlapAuditSummary = {
  generatedAt: string;
  overlapGroupCount: number;
  byType: Record<LeaseOverlapType, number>;
  bySeverity: Record<LeaseOverlapSeverity, number>;
};

export type LeaseOverlapAuditReport = {
  generatedAt: string;
  filters: {
    landlordId: string | null;
    propertyId: string | null;
  };
  summary: LeaseOverlapAuditSummary;
  groups: LeaseOverlapAuditGroup[];
};
