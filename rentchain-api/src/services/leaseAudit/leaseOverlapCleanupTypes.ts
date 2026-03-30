import type { LeaseOverlapAuditGroup } from "./leaseOverlapAuditTypes";

export type LeaseOverlapCleanupTargetStatus = "superseded" | "inactive";

export type LeaseOverlapCleanupLeaseChange = {
  leaseId: string;
  fromStatus: string | null;
  toStatus: string;
};

export type LeaseOverlapCleanupTenantChange = {
  tenantId: string;
  fromCurrentLeaseId: string | null;
  toCurrentLeaseId: string | null;
};

export type LeaseOverlapCleanupPreview = {
  dryRun: boolean;
  landlordId: string;
  propertyId: string;
  canonicalLeaseId: string;
  targetStatus: LeaseOverlapCleanupTargetStatus;
  group: LeaseOverlapAuditGroup | null;
  leaseChanges: LeaseOverlapCleanupLeaseChange[];
  tenantChanges: LeaseOverlapCleanupTenantChange[];
};

export type LeaseOverlapCleanupApplyResult = LeaseOverlapCleanupPreview & {
  applied: boolean;
  resolutionLogId: string;
  actorUserId: string;
  appliedAt: string;
};
