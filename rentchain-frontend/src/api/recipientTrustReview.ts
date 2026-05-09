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
  | "policy_denied";

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

export async function getRecipientTrustReview(grantId: string): Promise<RecipientTrustReviewResponse> {
  const res = await apiFetch<{ ok: boolean; data: RecipientTrustReviewResponse }>(
    `/recipient/trust-reviews/${encodeURIComponent(grantId)}`
  );
  return res.data;
}
