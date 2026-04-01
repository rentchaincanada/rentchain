// src/types/screening.ts
export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  consent: boolean;
  createdAt: string;
}

export type ScreeningStatus =
  | "requested"
  | "paid"
  | "completed"
  | "failed"
  | "pending";

export interface CreditReport {
  id: string;
  provider: string;
  score: number;
  summary: string;
  recommendations: string[];
  generatedAt: string;
}

export interface ScreeningReportSummary {
  headline: string;
  highlights: string[];
  createdAt: string;
  applicationId?: string;
  providerName?: string;
  providerReferenceId?: string;
  score?: number;
  riskBand?: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface ScreeningRequest {
  id: string;
  applicationId?: string;
  landlordId?: string;
  landlordEmail?: string;
  applicantId?: string;
  status: ScreeningStatus;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  amount?: number;
  priceCents?: number;
  currency?: string;
  reportSummary?: ScreeningReportSummary;
  creditReport?: CreditReport;
  checkoutSessionId?: string;
  encryptedPayload?: EncryptedPayload;
  deleteAfterAt?: string;
  providerName?: string;
  providerReferenceId?: string;
  failureReason?: string;
  lastProviderDurationMs?: number;
  lastWebhookEventId?: string;
  providerOverride?: string;
}

export type ScreeningRecordProvider = "transunion" | "equifax" | "other";

export type ScreeningRecordStatus = "pending" | "completed" | "failed";

export type ScreeningResultState = "approved" | "review" | "declined" | "unknown";

export type ScreeningRiskLevel = "low" | "medium" | "high" | "unknown";

export type ScreeningReportStatus =
  | "available"
  | "archived"
  | "not_stored"
  | "retrieval_required"
  | "pending"
  | "failed";

export type ScreeningReportStorageMode =
  | "rentchain_encrypted"
  | "provider_only"
  | "none";

export interface ScreeningSummarySnapshot {
  recommendation: string | null;
  scoreBand: string | null;
  confidence: string | null;
  openAccounts: number | null;
  pastDueTotal: number | null;
  collectionsPresent: boolean | null;
  bankruptcyPresent: boolean | null;
  inquiriesCount: number | null;
  flags: string[];
  notes: string | null;
}

export interface ScreeningReportSnapshot {
  status: ScreeningReportStatus;
  storageMode: ScreeningReportStorageMode;
  fileRef: string | null;
  archivedAt: string | number | null;
  retrievalCost: number | null;
  retrievalRequired: boolean | null;
}

export interface ScreeningAuditSnapshot {
  lastViewedAt: string | number | null;
  lastViewedByUserId: string | null;
  accessCount: number | null;
}

export interface ScreeningHistoryRecord {
  id: string;
  landlordId: string;
  propertyId: string | null;
  unitId: string | null;
  applicationId: string | null;
  tenantId: string | null;
  applicantName: string | null;
  provider: ScreeningRecordProvider;
  providerReferenceId: string | null;
  screeningType: string | null;
  status: ScreeningRecordStatus;
  result: ScreeningResultState;
  riskLevel: ScreeningRiskLevel;
  screenedAt: string | number | null;
  requestedAt: string | number | null;
  requestedByUserId: string | null;
  summary: ScreeningSummarySnapshot;
  report: ScreeningReportSnapshot;
  audit: ScreeningAuditSnapshot;
  createdAt: string | number | null;
  updatedAt: string | number | null;
}

export interface ScreeningHistoryDetail extends ScreeningHistoryRecord {
  propertyLabel: string | null;
  unitLabel: string | null;
  applicationStatus: string | null;
  metadata: {
    sourceType: "order" | "request";
    sourceId: string;
    referenceId: string | null;
    packageType: string | null;
    requestedByLabel: string | null;
  };
}
