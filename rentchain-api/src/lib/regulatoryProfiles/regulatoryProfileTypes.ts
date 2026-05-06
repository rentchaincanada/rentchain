import type { AuditComplianceReadiness } from "../auditCompliance/auditComplianceTypes";
import type { SettlementReadiness } from "../settlementReadiness/settlementReadinessTypes";

export type RegulatoryProfileStatus = "ready_for_review" | "partially_ready" | "blocked" | "unknown";
export type RegulatoryReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";
export type RegulatoryReferenceType = "registry" | "screening" | "privacy" | "settlement" | "export" | "sharing" | "audit" | "review";
export type RegulatoryEventType =
  | "regulatory_profile_derived"
  | "regulatory_restriction_detected"
  | "regulatory_review_required"
  | "regulatory_profile_blocked"
  | "regulatory_redaction_applied";

export type RegulatoryJurisdiction = {
  country: "CA";
  province: string;
  municipality: string;
};

export type RegulatoryReference = {
  referenceId: string;
  referenceType: RegulatoryReferenceType;
  status: RegulatoryReferenceStatus;
  label: string;
  description: string;
  jurisdictionScope: RegulatoryJurisdiction;
  restrictionSummary: {
    restricted: boolean;
    reasons: string[];
  };
  reviewLineage: string[];
  evidenceLineage: string[];
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
  destination: string | null;
};

export type RegulatoryCanonicalEvent = {
  eventType: RegulatoryEventType;
  action: string;
  status: RegulatoryProfileStatus;
  resourceType: "regulatory_profile";
  resourceId: string;
  summary: string;
};

export type RegulatoryProfile = {
  regulatoryProfileId: string;
  jurisdiction: RegulatoryJurisdiction;
  status: RegulatoryProfileStatus;
  manualReviewRequired: true;
  legalCertificationEnabled: false;
  externalRegulatorSubmissionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyReadyReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  registryReferences: RegulatoryReference[];
  screeningReadiness: RegulatoryReference[];
  privacyReadiness: RegulatoryReference[];
  sharingRestrictions: RegulatoryReference[];
  settlementRestrictions: RegulatoryReference[];
  reviewReferences: RegulatoryReference[];
  evidenceReferences: RegulatoryReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: RegulatoryCanonicalEvent[];
};

export type DeriveRegulatoryProfileInput = {
  landlordId?: unknown;
  country?: unknown;
  province?: unknown;
  municipality?: unknown;
  generatedAt?: unknown;
  properties?: Record<string, unknown>[] | null;
  registryStatuses?: Record<string, unknown>[] | null;
  screeningOrders?: Record<string, unknown>[] | null;
  consentRecords?: Record<string, unknown>[] | null;
  sharingRooms?: Record<string, unknown>[] | null;
  institutionExportPackages?: Record<string, unknown>[] | null;
  evidencePacks?: Record<string, unknown>[] | null;
  operatorReviewSessions?: Record<string, unknown>[] | null;
  auditEvents?: Record<string, unknown>[] | null;
  auditComplianceReadiness?: AuditComplianceReadiness | null;
  settlementReadiness?: SettlementReadiness | null;
};
