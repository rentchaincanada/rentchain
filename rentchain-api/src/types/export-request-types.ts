import type { EvidenceClass } from "./evidence-record-types";
import type { ExportDataMinimizationLevel } from "./export-profile-types";

export const EXPORT_REQUEST_STATUSES = ["Pending", "Authorized", "Assembled", "Signed", "Delivered", "Archived"] as const;

export type ExportRequestStatus = (typeof EXPORT_REQUEST_STATUSES)[number];

export type ExportScopeParameters = {
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  evidenceClassFilters?: EvidenceClass[] | null;
  unitScopeOverride?: string[] | null;
};

export type ExportRedactionPolicyOverride = {
  dataMinimizationLevel: ExportDataMinimizationLevel;
  reason: string;
};

export type ExportAuthorizationStatus = {
  isAuthorized: boolean;
  authorizedAt?: string | null;
  authorizedBy?: string | null;
  authorizationReason?: string | null;
  denialReason?: string | null;
  rawIdsIncluded: false;
};

export type ExportRequestMetadata = Record<string, string | number | boolean | null>;

export type ExportRequest = {
  exportRequestId: string;
  exportProfileId: string;
  landlordId: string;
  requestedAt: string;
  requestedBy: string;
  requestReason: string;
  scopeParameters: ExportScopeParameters;
  redactionPolicyOverride?: ExportRedactionPolicyOverride | null;
  status: ExportRequestStatus;
  authorizationStatus: ExportAuthorizationStatus;
  auditTrailReference: string;
  metadata: ExportRequestMetadata;
  rawIdsIncluded: false;
  payloadIncluded: false;
};
