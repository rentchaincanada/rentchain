export type TenantLeasePointerCandidate = {
  leaseId: string;
  unitId: string | null;
  unitNumber: string | null;
  unitLabel: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  tenantIds: string[];
};

export type TenantLeasePointerConflict = {
  tenantId: string;
  landlordId: string;
  propertyId: string;
  tenantUnitId: string | null;
  tenantUnitNumber: string | null;
  tenantUnitLabel: string | null;
  currentLeaseId: string;
  currentLeaseUnitId: string | null;
  currentLeaseUnitNumber: string | null;
  currentLeaseUnitLabel: string | null;
  candidateLeases: TenantLeasePointerCandidate[];
  suggestedLeaseId: string | null;
  reason: string;
};

export type TenantLeasePointerCorrectionPreview = {
  dryRun: boolean;
  tenantId: string;
  landlordId: string;
  propertyId: string;
  fromCurrentLeaseId: string;
  toCurrentLeaseId: string;
  conflict: TenantLeasePointerConflict;
};

export type TenantLeasePointerCorrectionApplyResult = TenantLeasePointerCorrectionPreview & {
  applied: boolean;
  actorUserId: string;
  appliedAt: string;
  resolutionLogId: string;
};
