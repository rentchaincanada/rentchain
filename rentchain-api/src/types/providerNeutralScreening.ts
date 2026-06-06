export type ScreeningWorkflowStatus =
  | "pending"
  | "provider_pending"
  | "completed"
  | "manual_completed"
  | "failed"
  | "expired";

export type ScreeningConsentStatus = "active" | "revoked";

export type ScreeningDecisionStatus = "not_started" | "approve" | "deny" | "review_needed";

export type ScreeningProviderWebhookStatus = "verified" | "rejected" | "parse_failed";

export type ScreeningWorkflowAuditAction =
  | "consent_granted"
  | "consent_revoked"
  | "request_created"
  | "webhook_received"
  | "result_recorded"
  | "decision_recorded"
  | "manual_report_recorded";

export type ScreeningWorkflowAuditEntry = {
  action: ScreeningWorkflowAuditAction;
  actorRole: "tenant" | "landlord" | "admin" | "provider" | "system";
  actorRef: string;
  at: string;
  note?: string;
};

export type ScreeningProviderStartInput = {
  requestId: string;
  landlordRef: string;
  tenantRef: string;
  unitRef: string;
  consentRef: string;
};

export type ScreeningProviderStartResult = {
  providerRequestRef?: string;
  redirectUrl?: string;
};

export type ScreeningProviderParsedWebhook = {
  requestId: string;
  status: "completed" | "failed" | "pending";
  riskScore?: number | null;
  decisionRecommendation?: "approve" | "deny" | "review_needed" | null;
  summary?: string | null;
  flags?: string[];
  providerRequestRef?: string | null;
};

export type ScreeningProviderResult = {
  status: ScreeningWorkflowStatus;
  riskScore?: number | null;
  decisionRecommendation?: "approve" | "deny" | "review_needed" | null;
  summary?: string | null;
  flags?: string[];
};

export interface IScreeningProvider {
  getName(): string;
  isConfigured(): boolean;
  initiateScreening(input: ScreeningProviderStartInput): Promise<ScreeningProviderStartResult>;
  verifyWebhookSignature(input: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    rawBody?: Buffer;
  }): Promise<boolean>;
  parseWebhookPayload(input: unknown): Promise<ScreeningProviderParsedWebhook>;
  getScreeningResult(requestId: string): Promise<ScreeningProviderResult | null>;
}

export type ScreeningConsent = {
  id: string;
  tenantId: string;
  landlordId: string;
  unitId: string;
  consentType: "screening";
  status: ScreeningConsentStatus;
  grantedAt: string;
  revokedAt?: string | null;
  auditLog: ScreeningWorkflowAuditEntry[];
};

export type ScreeningRequest = {
  id: string;
  landlordId: string;
  unitId: string;
  tenantId: string;
  consentId: string;
  providerId: string | null;
  status: ScreeningWorkflowStatus;
  requestedAt: string;
  resultReceivedAt?: string | null;
  manualReportUrl?: string | null;
  manualReportUploadedAt?: string | null;
  decisionStatus: ScreeningDecisionStatus;
  decisionReason?: string | null;
  decisionNotes?: string | null;
  decisionMadeAt?: string | null;
  auditLog: ScreeningWorkflowAuditEntry[];
};

export type ScreeningResult = {
  id: string;
  requestId: string;
  tenantId: string;
  landlordId: string;
  providerId: string;
  payloadDigest: string;
  parsedResult: ScreeningProviderResult;
  riskScore?: number | null;
  decisionRecommendation?: "approve" | "deny" | "review_needed" | null;
  receivedAt: string;
  expiresAt: string;
};

export type ScreeningWebhookLog = {
  id: string;
  providerId: string;
  timestamp: string;
  signatureHeaderPresent: boolean;
  verified: boolean;
  status: ScreeningProviderWebhookStatus;
  payloadDigest: string;
  parsedRequestId?: string | null;
  errorCode?: string | null;
};

export type ScreeningRequestProjection = {
  requestId: string;
  unitId: string;
  tenantId: string;
  status: ScreeningWorkflowStatus;
  initiatedAt: string;
  resultReceivedAt: string | null;
  decisionStatus: ScreeningDecisionStatus;
  manualReportUploadedAt: string | null;
};

export type ScreeningResultProjection = {
  requestId: string;
  riskScore: number | null;
  decisionRecommendation: "approve" | "deny" | "review_needed" | null;
  summary: string | null;
  flags: string[];
};
