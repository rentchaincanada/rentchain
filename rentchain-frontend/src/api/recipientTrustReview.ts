import { apiFetch } from "./apiFetch";

export type RecipientTrustReviewStatus =
  | "available"
  | "unauthenticated"
  | "not_found"
  | "recipient_mismatch"
  | "expired"
  | "revoked"
  | "blocked"
  | "consent_required"
  | "reverification_required"
  | "policy_denied"
  | "session_expired"
  | "session_revoked"
  | "reauthentication_required"
  | "onboarding_required";

export type RecipientTrustReviewDecision = {
  allowed: boolean;
  status: RecipientTrustReviewStatus;
  reason: string;
  metadataOnly: true;
  publicAccessEnabled: false;
  downloadEnabled: false;
};

export type RecipientTrustReviewSummary = {
  schemaVersion: "recipient_trust_review.v1";
  grantId: string;
  audience: string;
  purpose: string;
  lifecycle: "active";
  recipient: {
    email: string;
    displayName: string | null;
    organizationName: string | null;
  };
  consent: {
    granted: boolean;
    consentVersion: string;
    grantedAt: string | null;
    expiresAt: string | null;
    audience: string;
    purpose: string;
  };
  access: {
    authenticated: true;
    sessionBound: true;
    viewOnly: true;
    downloadEnabled: false;
    publicAccessEnabled: false;
    publicProfileEnabled: false;
    externalSubmissionEnabled: false;
    providerIntegrationEnabled: false;
    automatedDecisioningEnabled: false;
  };
  generatedAt: string;
  expiresAt: string | null;
  reviewedAt: string;
  session: {
    schemaVersion: "recipient_review_session.v1";
    sessionId: string;
    lifecycle: "active" | "expired" | "revoked" | "blocked";
    issuedAt: string;
    expiresAt: string;
    lastValidatedAt: string;
    grantId: string;
    audience: string;
    purpose: string;
    metadataOnly: true;
    authenticated: true;
    viewOnly: true;
    downloadEnabled: false;
    publicAccessEnabled: false;
    reauthenticationRequiredAt: string;
    continuity: {
      schemaVersion: "institution_review_session_continuity.v1";
      state: "active" | "stale" | "invalidated";
      replayProtected: true;
      staleAfter: string;
      reauthenticationRequired: boolean;
      invalidationReason: string | null;
    };
  };
  institutionReviewSession?: {
    schemaVersion: "institution_review_session.v1";
    sessionId: string;
    accessGrantId: string;
    recipientReviewSessionId: string | null;
    audience: string;
    purpose: string;
    recipientRole: string;
    lifecycle: string;
    tenantMediated: true;
    consentScoped: true;
    policyGated: true;
    metadataOnly: true;
    viewOnly: true;
    publicAccessEnabled: false;
    publicProfileEnabled: false;
    externalSubmissionEnabled: false;
    providerIntegrationEnabled: false;
    automatedDecisioningEnabled: false;
    downloadEnabled: false;
  };
  onboarding: {
    schemaVersion: "institution_review_onboarding.v1";
    status: "required" | "acknowledged";
    acknowledgementRequired: true;
    acknowledged: boolean;
    tenantMediated: true;
    authenticatedRecipientRequired: true;
    metadataOnly: true;
    viewOnly: true;
    timeBound: true;
    revocable: true;
    policyGated: true;
    publicAccessEnabled: false;
    downloadEnabled: false;
    institutionAccountCreated: false;
    automatedDecisioningEnabled: false;
    copy: {
      title: string;
      intro: string;
      bullets: string[];
      acknowledgement: string;
      supportGuidance: string[];
    };
  };
  metadataOnly: true;
  policyGated: true;
  includedClaims: Array<{
    claimCategory: string;
    claimLabel: string;
    lifecycleState: string;
    consentExpiresAt: string | null;
  }>;
  excludedClaims: Array<{
    claimCategory: string;
    claimLabel: string;
    reasons: string[];
  }>;
  redactions: string[];
  disclaimers: string[];
};

export type RecipientTrustReviewResponse = {
  decision: RecipientTrustReviewDecision;
  summary: RecipientTrustReviewSummary | null;
};

export async function getRecipientTrustReview(
  grantId: string,
  recipientSessionId?: string | null,
  onboardingAcknowledged = false
): Promise<RecipientTrustReviewResponse> {
  const headers: Record<string, string> = {};
  if (recipientSessionId) headers["x-recipient-review-session-id"] = recipientSessionId;
  if (onboardingAcknowledged) headers["x-institution-review-onboarding-acknowledged"] = "true";
  const res = await apiFetch<{ ok: boolean; data: RecipientTrustReviewResponse }>(
    `/recipient/trust-reviews/${encodeURIComponent(grantId)}`,
    Object.keys(headers).length ? { headers } : undefined
  );
  return res.data;
}
