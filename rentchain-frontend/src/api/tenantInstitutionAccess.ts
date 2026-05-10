import { tenantApiFetch } from "./tenantApiFetch";

export type TenantInstitutionAccessAudience = "insurer" | "lender" | "institutional_landlord" | "auditor";

export type TenantInstitutionAccessPurpose =
  | "insurance_review"
  | "lender_review"
  | "institutional_landlord_review"
  | "auditor_review";

export type TenantInstitutionAccessLifecycle =
  | "preview"
  | "active"
  | "revoked"
  | "expired"
  | "blocked"
  | "consent_required"
  | "reverification_required";

export type TenantInstitutionAccessRecipient = {
  email: string;
  displayName: string | null;
  organizationName: string | null;
  authenticationRequirement: "recipient_email_session_required";
};

export type TenantInstitutionAccessPreview = {
  grantId: string | null;
  schemaVersion: "tenant_institution_access.v1";
  audience: TenantInstitutionAccessAudience;
  purpose: TenantInstitutionAccessPurpose;
  lifecycle: TenantInstitutionAccessLifecycle;
  recipient: TenantInstitutionAccessRecipient;
  consent: {
    required: true;
    granted: boolean;
    consentId: string | null;
    consentVersion: "tenant_institution_access_consent.v1";
    grantedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    audience: TenantInstitutionAccessAudience;
    purpose: TenantInstitutionAccessPurpose;
    recipientEmail: string | null;
    claimCategories: string[];
    summary: string;
  };
  expiresAt: string | null;
  revokedAt: string | null;
  generatedAt: string;
  metadataOnly: true;
  policyGated: true;
  publicAccessEnabled: false;
  publicProfileEnabled: false;
  externalSubmissionEnabled: false;
  providerIntegrationEnabled: false;
  automatedDecisioningEnabled: false;
  recipientAccess: {
    enabled: boolean;
    accessUrl: string | null;
    accessTokenIssued: false;
    recipientAuthenticationRequired: true;
    sessionBound: true;
    downloadEnabled: false;
    summary: string;
  };
  package: {
    status: "export_ready" | "blocked" | "unavailable";
    blockedReasons: string[];
    exportSummaries: Array<{
      attestationId: string;
      claimCategory: string;
      claimLabel: string;
      metadataOnly: true;
      rawEvidenceIncluded: false;
      rawProviderPayloadIncluded: false;
      supportMetadataIncluded: false;
      publicAccessEnabled: false;
      externalSubmissionEnabled: false;
    }>;
  };
  includedClaims: Array<{
    attestationId: string;
    claimCategory: string;
    claimLabel: string;
    lifecycleState: string;
    consentExpiresAt: string | null;
  }>;
  excludedClaims: Array<{
    attestationId: string;
    claimCategory: string;
    claimLabel: string;
    reasons: string[];
  }>;
  redactions: string[];
  disclaimers: string[];
};

export type TenantInstitutionAccessGrant = TenantInstitutionAccessPreview & {
  grantId: string;
  lifecycle: "active" | "revoked" | "expired" | "blocked" | "reverification_required";
  createdAt: string;
  updatedAt: string;
  events: Array<{
    eventType:
      | "tenant_institution_access_granted"
      | "tenant_institution_access_revoked"
      | "tenant_institution_access_expired"
      | "tenant_institution_access_blocked"
      | "recipient_trust_review_opened"
      | "recipient_trust_review_blocked"
      | "recipient_trust_review_expired"
      | "recipient_trust_review_revoked"
      | "recipient_review_session_started"
      | "recipient_review_session_expired"
      | "recipient_review_session_revoked"
      | "recipient_review_session_blocked"
      | "recipient_review_session_reauthenticated"
      | "institution_review_invite_created"
      | "institution_review_invite_sent"
      | "institution_review_invite_opened"
      | "institution_review_invite_authenticated"
      | "institution_review_invite_revoked"
      | "institution_review_invite_expired"
      | "institution_review_invite_blocked";
    occurredAt: string;
    actorType: "tenant" | "system" | "recipient";
    metadataOnly: true;
    outcome?:
      | "invite_created"
      | "invite_sent"
      | "invite_opened"
      | "invite_authenticated"
      | "granted"
      | "opened"
      | "blocked"
      | "revoked"
      | "expired"
      | "session_started"
      | "reauthenticated";
    reason?: string;
    status?: string;
  }>;
  auditSummary: TenantInstitutionAccessAuditSummary;
  auditTimeline: TenantInstitutionAccessAuditEvent[];
  institutionReviewInvite?: {
    schemaVersion: "institution_review_invite.v1";
    status: "not_created" | "invited" | "viewed" | "authenticated" | "expired" | "revoked" | "blocked" | "send_failed";
    recipientEmail: string;
    redactedRecipientEmail: string;
    organizationName: string | null;
    audience: TenantInstitutionAccessAudience;
    purpose: TenantInstitutionAccessPurpose;
    reviewUrl: string | null;
    createdAt: string | null;
    sentAt: string | null;
    openedAt: string | null;
    authenticatedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    recipientAuthenticationRequired: true;
    inviteTokenIssued: false;
    bearerAccessEnabled: false;
    publicAccessEnabled: false;
    downloadEnabled: false;
    metadataOnly: true;
    summary: string;
  };
};

export type TenantInstitutionAccessAuditEvent = {
  eventType:
    | "tenant_institution_access_granted"
    | "tenant_institution_access_revoked"
    | "tenant_institution_access_expired"
    | "tenant_institution_access_blocked"
    | "recipient_trust_review_opened"
    | "recipient_trust_review_blocked"
    | "recipient_trust_review_expired"
    | "recipient_trust_review_revoked"
    | "recipient_review_session_started"
    | "recipient_review_session_expired"
    | "recipient_review_session_revoked"
    | "recipient_review_session_blocked"
    | "recipient_review_session_reauthenticated"
    | "institution_review_invite_created"
    | "institution_review_invite_sent"
    | "institution_review_invite_opened"
    | "institution_review_invite_authenticated"
    | "institution_review_invite_revoked"
    | "institution_review_invite_expired"
    | "institution_review_invite_blocked";
  occurredAt: string;
  actorType: "tenant" | "system" | "recipient";
  outcome:
    | "invite_created"
    | "invite_sent"
    | "invite_opened"
    | "invite_authenticated"
    | "granted"
    | "opened"
    | "blocked"
    | "revoked"
    | "expired"
    | "session_started"
    | "reauthenticated";
  status: string;
  reason: string;
  metadataOnly: true;
};

export type TenantInstitutionAccessAuditSummary = {
  schemaVersion: "recipient_access_audit.v1";
  metadataOnly: true;
  totalEvents: number;
  openedReviewCount: number;
  blockedReviewCount: number;
  revokedAccessCount: number;
  expiredAccessCount: number;
  sessionStartedCount: number;
  sessionExpiredCount: number;
  lastActivityAt: string | null;
  lastOpenedAt: string | null;
  lastBlockedAt: string | null;
  lastOutcome:
    | "invite_created"
    | "invite_sent"
    | "invite_opened"
    | "invite_authenticated"
    | "granted"
    | "opened"
    | "blocked"
    | "revoked"
    | "expired"
    | "session_started"
    | "reauthenticated"
    | null;
  lastReason: string | null;
  recipientIdentifier: {
    email: string;
    redactedEmail: string;
    organizationName: string | null;
  };
  visibility: {
    tenantVisible: true;
    supportSafe: true;
    trustPayloadIncluded: false;
    supportMetadataIncluded: false;
    rawProviderPayloadIncluded: false;
    publicAccessEnabled: false;
    downloadEnabled: false;
  };
};

export type TenantInstitutionAccessRequest = {
  audience: TenantInstitutionAccessAudience;
  purpose?: TenantInstitutionAccessPurpose;
  recipient: {
    email: string;
    displayName?: string;
    organizationName?: string;
  };
  expiresInDays: number;
  consentAccepted?: boolean;
};

export async function listTenantInstitutionAccessGrants(): Promise<TenantInstitutionAccessGrant[]> {
  const res = await tenantApiFetch<{ ok: boolean; data: { items: TenantInstitutionAccessGrant[] } }>(
    "/tenant/institution-access/grants"
  );
  return Array.isArray(res?.data?.items) ? res.data.items : [];
}

export async function previewTenantInstitutionAccess(
  request: TenantInstitutionAccessRequest
): Promise<TenantInstitutionAccessPreview> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantInstitutionAccessPreview }>(
    "/tenant/institution-access/preview",
    {
      method: "POST",
      body: request,
    }
  );
  return res.data;
}

export async function createTenantInstitutionAccessGrant(
  request: TenantInstitutionAccessRequest
): Promise<TenantInstitutionAccessGrant> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantInstitutionAccessGrant }>(
    "/tenant/institution-access/grants",
    {
      method: "POST",
      body: request,
    }
  );
  return res.data;
}

export async function createInstitutionReviewInvite(
  request: TenantInstitutionAccessRequest
): Promise<TenantInstitutionAccessGrant> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantInstitutionAccessGrant }>(
    "/tenant/institution-access/invites",
    {
      method: "POST",
      body: request,
    }
  );
  return res.data;
}

export async function revokeTenantInstitutionAccessGrant(grantId: string): Promise<TenantInstitutionAccessGrant> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantInstitutionAccessGrant }>(
    `/tenant/institution-access/grants/${encodeURIComponent(grantId)}/revoke`,
    {
      method: "POST",
    }
  );
  return res.data;
}
