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
  | "reauthentication_required";

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
  recipientSessionId?: string | null
): Promise<RecipientTrustReviewResponse> {
  const headers = recipientSessionId ? { "x-recipient-review-session-id": recipientSessionId } : undefined;
  const res = await apiFetch<{ ok: boolean; data: RecipientTrustReviewResponse }>(
    `/recipient/trust-reviews/${encodeURIComponent(grantId)}`,
    headers ? { headers } : undefined
  );
  return res.data;
}
