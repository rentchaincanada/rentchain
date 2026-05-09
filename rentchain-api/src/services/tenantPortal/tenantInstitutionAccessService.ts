import crypto from "crypto";
import { db } from "../../config/firebase";
import type { InstitutionalTrustExportPackage } from "../../lib/institutionTrustExports";
import type { PortableAttestationClaimCategory } from "../../lib/portableAttestations";
import { redactIdentifier } from "../../lib/governance/platformGovernance";
import {
  previewTenantTrustExport,
  type TenantTrustExportAudience,
  type TenantTrustExportPurpose,
} from "./tenantTrustExportService";

const COLLECTION = "tenantInstitutionAccessGrants";
const CONSENT_VERSION = "tenant_institution_access_consent.v1";
const DEFAULT_EXPIRES_DAYS = 14;
const MAX_EXPIRES_DAYS = 30;

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

export type TenantInstitutionAccessConsentState = {
  required: true;
  granted: boolean;
  consentId: string | null;
  consentVersion: typeof CONSENT_VERSION;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  audience: TenantInstitutionAccessAudience;
  purpose: TenantInstitutionAccessPurpose;
  recipientEmail: string | null;
  claimCategories: PortableAttestationClaimCategory[];
  summary:
    "Tenant consent is required before RentChain prepares this non-public, metadata-only institution access grant.";
};

export type TenantInstitutionAccessPreview = {
  grantId: string | null;
  schemaVersion: "tenant_institution_access.v1";
  audience: TenantInstitutionAccessAudience;
  purpose: TenantInstitutionAccessPurpose;
  lifecycle: TenantInstitutionAccessLifecycle;
  recipient: TenantInstitutionAccessRecipient;
  consent: TenantInstitutionAccessConsentState;
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
    enabled: false;
    accessUrl: null;
    accessTokenIssued: false;
    recipientAuthenticationRequired: true;
    sessionBound: true;
    downloadEnabled: false;
    summary:
      "Recipient access is modeled for controlled future review only; no public link or external delivery is created by this grant.";
  };
  package: InstitutionalTrustExportPackage;
  includedClaims: Array<{
    attestationId: string;
    claimCategory: PortableAttestationClaimCategory;
    claimLabel: string;
    lifecycleState: string;
    consentExpiresAt: string | null;
  }>;
  excludedClaims: Array<{
    attestationId: string;
    claimCategory: PortableAttestationClaimCategory;
    claimLabel: string;
    reasons: string[];
  }>;
  redactions: string[];
  disclaimers: string[];
};

export type TenantInstitutionAccessGrantEvent = {
  eventType:
    | "tenant_institution_access_granted"
    | "tenant_institution_access_revoked"
    | "tenant_institution_access_expired"
    | "tenant_institution_access_blocked"
    | "recipient_trust_review_opened"
    | "recipient_trust_review_blocked"
    | "recipient_trust_review_expired"
    | "recipient_trust_review_revoked";
  occurredAt: string;
  actorType: "tenant" | "system" | "recipient";
  metadataOnly: true;
  outcome?: "granted" | "opened" | "blocked" | "revoked" | "expired";
  reason?: RecipientTrustReviewAccessDecision["reason"] | "access_granted" | "access_revoked";
  status?: RecipientTrustReviewStatus | "granted";
};

type TenantInstitutionAccessStoredGrant = TenantInstitutionAccessPreview & {
  grantId: string;
  lifecycle: "active" | "revoked" | "expired" | "blocked" | "reverification_required";
  createdAt: string;
  updatedAt: string;
  events: TenantInstitutionAccessGrantEvent[];
  tenantId: string;
};

export type TenantInstitutionAccessGrant = Omit<TenantInstitutionAccessStoredGrant, "tenantId"> & {
  auditSummary: TenantInstitutionAccessAuditSummary;
  auditTimeline: TenantInstitutionAccessAuditEvent[];
};

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

export type RecipientTrustReviewAccessDecision = {
  allowed: boolean;
  status: RecipientTrustReviewStatus;
  reason:
    | "review_available"
    | "recipient_authentication_required"
    | "grant_not_found"
    | "recipient_email_mismatch"
    | "grant_expired"
    | "grant_revoked"
    | "grant_blocked"
    | "tenant_consent_missing"
    | "trust_reverification_required"
    | "policy_gated_summary_unavailable";
  metadataOnly: true;
  publicAccessEnabled: false;
  downloadEnabled: false;
};

export type RecipientTrustReviewSummary = {
  schemaVersion: "recipient_trust_review.v1";
  grantId: string;
  audience: TenantInstitutionAccessAudience;
  purpose: TenantInstitutionAccessPurpose;
  lifecycle: "active";
  recipient: Pick<TenantInstitutionAccessRecipient, "email" | "displayName" | "organizationName">;
  consent: Pick<
    TenantInstitutionAccessConsentState,
    "granted" | "consentVersion" | "grantedAt" | "expiresAt" | "audience" | "purpose"
  >;
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
    claimCategory: PortableAttestationClaimCategory;
    claimLabel: string;
    lifecycleState: string;
    consentExpiresAt: string | null;
  }>;
  excludedClaims: Array<{
    claimCategory: PortableAttestationClaimCategory;
    claimLabel: string;
    reasons: string[];
  }>;
  redactions: string[];
  disclaimers: string[];
};

export type RecipientTrustReviewResult = {
  decision: RecipientTrustReviewAccessDecision;
  summary: RecipientTrustReviewSummary | null;
};

export type TenantInstitutionAccessAuditOutcome = "granted" | "opened" | "blocked" | "revoked" | "expired";

export type TenantInstitutionAccessAuditEvent = {
  eventType: TenantInstitutionAccessGrantEvent["eventType"];
  occurredAt: string;
  actorType: "tenant" | "system" | "recipient";
  outcome: TenantInstitutionAccessAuditOutcome;
  status: RecipientTrustReviewStatus | "granted" | "revoked" | "expired" | "blocked";
  reason:
    | RecipientTrustReviewAccessDecision["reason"]
    | "access_granted"
    | "access_revoked"
    | "access_expired"
    | "access_blocked";
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
  lastActivityAt: string | null;
  lastOpenedAt: string | null;
  lastBlockedAt: string | null;
  lastOutcome: TenantInstitutionAccessAuditOutcome | null;
  lastReason:
    | RecipientTrustReviewAccessDecision["reason"]
    | "access_granted"
    | "access_revoked"
    | "access_expired"
    | "access_blocked"
    | null;
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

export type SupportInstitutionAccessDiagnosticEvent = {
  eventType: TenantInstitutionAccessAuditEvent["eventType"];
  occurredAt: string;
  actorType: TenantInstitutionAccessAuditEvent["actorType"];
  outcome: TenantInstitutionAccessAuditEvent["outcome"];
  status: TenantInstitutionAccessAuditEvent["status"];
  reason: TenantInstitutionAccessAuditEvent["reason"];
  metadataOnly: true;
  visibility: {
    supportVisible: true;
    trustPayloadIncluded: false;
    rawProviderPayloadIncluded: false;
    supportMetadataIncluded: false;
  };
};

export type SupportInstitutionAccessDiagnosticSummary = {
  schemaVersion: "support_institution_access_diagnostics.v1";
  grantId: string;
  lifecycle: TenantInstitutionAccessLifecycle;
  audience: TenantInstitutionAccessAudience;
  purpose: TenantInstitutionAccessPurpose;
  recipient: {
    redactedEmail: string;
    organizationName: string | null;
    authenticationRequirement: TenantInstitutionAccessRecipient["authenticationRequirement"];
  };
  tenant: {
    redactedTenantId: string | null;
  };
  consent: {
    granted: boolean;
    consentVersion: typeof CONSENT_VERSION;
    grantedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
  };
  access: {
    recipientAuthenticationRequired: true;
    sessionBound: true;
    publicAccessEnabled: false;
    publicProfileEnabled: false;
    externalSubmissionEnabled: false;
    downloadEnabled: false;
  };
  package: {
    status: string;
    blockedReasonCount: number;
    exportSummaryCount: number;
  };
  audit: {
    totalEvents: number;
    openedReviewCount: number;
    blockedReviewCount: number;
    revokedAccessCount: number;
    expiredAccessCount: number;
    lastActivityAt: string | null;
    lastOpenedAt: string | null;
    lastBlockedAt: string | null;
    lastOutcome: TenantInstitutionAccessAuditSummary["lastOutcome"];
    lastReason: TenantInstitutionAccessAuditSummary["lastReason"];
    reasonCategories: string[];
  };
  payloadSafety: {
    metadataOnly: true;
    supportSafe: true;
    trustPayloadIncluded: false;
    portableAttestationContentsIncluded: false;
    rawProviderPayloadIncluded: false;
    rawIdentityPayloadIncluded: false;
    rawPropertyPayloadIncluded: false;
    supportMetadataIncluded: false;
    unsafePortablePayloadDetected: boolean;
  };
  timeline: SupportInstitutionAccessDiagnosticEvent[];
};

function asString(value: unknown, max = 240): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(start: string, days: number) {
  return new Date(Date.parse(start) + days * 24 * 60 * 60 * 1000).toISOString();
}

function clampExpiresInDays(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(Math.max(Math.round(numeric), 1), MAX_EXPIRES_DAYS);
}

function sanitizeAudience(value: unknown): TenantInstitutionAccessAudience {
  if (value === "lender" || value === "institutional_landlord" || value === "auditor") return value;
  return "insurer";
}

function purposeForAudience(audience: TenantInstitutionAccessAudience): TenantInstitutionAccessPurpose {
  if (audience === "lender") return "lender_review";
  if (audience === "institutional_landlord") return "institutional_landlord_review";
  if (audience === "auditor") return "auditor_review";
  return "insurance_review";
}

function toTrustExportAudience(audience: TenantInstitutionAccessAudience): TenantTrustExportAudience {
  return audience;
}

function toTrustExportPurpose(purpose: TenantInstitutionAccessPurpose): TenantTrustExportPurpose {
  return purpose;
}

function normalizeEmail(value: unknown) {
  const email = asString(value, 320)?.toLowerCase() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeRecipient(input: unknown): TenantInstitutionAccessRecipient | null {
  const data = (input || {}) as any;
  const email = normalizeEmail(data?.email);
  if (!email) return null;
  return {
    email,
    displayName: asString(data?.displayName, 120),
    organizationName: asString(data?.organizationName, 160),
    authenticationRequirement: "recipient_email_session_required",
  };
}

function redactEmail(value: string | null | undefined) {
  const email = normalizeEmail(value);
  if (!email) return "not available";
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local.slice(0, 1) : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function grantIdFor(params: {
  tenantId: string;
  audience: TenantInstitutionAccessAudience;
  purpose: TenantInstitutionAccessPurpose;
  recipientEmail: string;
  generatedAt: string;
}) {
  const subjectRef = crypto.createHash("sha256").update(params.tenantId).digest("hex").slice(0, 16);
  const recipientRef = crypto.createHash("sha256").update(params.recipientEmail).digest("hex").slice(0, 12);
  return [
    "tenant_institution_access",
    subjectRef,
    recipientRef,
    params.audience,
    params.purpose,
    Date.parse(params.generatedAt).toString(36),
  ]
    .join(":")
    .replace(/[^a-zA-Z0-9_.:-]+/g, "_");
}

function consentIdFor(params: {
  tenantId: string;
  grantId: string;
  audience: TenantInstitutionAccessAudience;
  purpose: TenantInstitutionAccessPurpose;
}) {
  const subjectRef = crypto.createHash("sha256").update(params.tenantId).digest("hex").slice(0, 16);
  return ["tenant_institution_access_consent", subjectRef, params.grantId, params.audience, params.purpose]
    .join(":")
    .replace(/[^a-zA-Z0-9_.:-]+/g, "_");
}

function lifecycleForPackage(params: {
  package: InstitutionalTrustExportPackage;
  consentAccepted: boolean;
  expiresAt: string | null;
  revokedAt?: string | null;
}) {
  if (params.revokedAt) return "revoked" as const;
  if (params.expiresAt && Date.parse(params.expiresAt) <= Date.now()) return "expired" as const;
  if (!params.consentAccepted) return "consent_required" as const;
  if (params.package.blockedReasons.some((reason) => reason.includes("reverification_required"))) {
    return "reverification_required" as const;
  }
  return params.package.status === "export_ready" ? ("preview" as const) : ("blocked" as const);
}

function accessPreviewFromTrustPackage(params: {
  grantId: string | null;
  tenantId: string;
  audience: TenantInstitutionAccessAudience;
  purpose: TenantInstitutionAccessPurpose;
  recipient: TenantInstitutionAccessRecipient;
  generatedAt: string;
  expiresAt: string;
  consentAccepted: boolean;
  package: InstitutionalTrustExportPackage;
  includedClaims: TenantInstitutionAccessPreview["includedClaims"];
  excludedClaims: TenantInstitutionAccessPreview["excludedClaims"];
}): TenantInstitutionAccessPreview {
  const lifecycle = lifecycleForPackage({
    package: params.package,
    consentAccepted: params.consentAccepted,
    expiresAt: params.expiresAt,
  });
  const claimCategories = Array.from(
    new Set([
      ...params.includedClaims.map((claim) => claim.claimCategory),
      ...params.excludedClaims.map((claim) => claim.claimCategory),
    ])
  );
  const consentId =
    params.consentAccepted && params.grantId
      ? consentIdFor({
          tenantId: params.tenantId,
          grantId: params.grantId,
          audience: params.audience,
          purpose: params.purpose,
        })
      : null;

  return {
    grantId: params.grantId,
    schemaVersion: "tenant_institution_access.v1",
    audience: params.audience,
    purpose: params.purpose,
    lifecycle,
    recipient: params.recipient,
    consent: {
      required: true,
      granted: params.consentAccepted,
      consentId,
      consentVersion: CONSENT_VERSION,
      grantedAt: params.consentAccepted ? params.generatedAt : null,
      expiresAt: params.expiresAt,
      revokedAt: null,
      audience: params.audience,
      purpose: params.purpose,
      recipientEmail: params.recipient.email,
      claimCategories,
      summary:
        "Tenant consent is required before RentChain prepares this non-public, metadata-only institution access grant.",
    },
    expiresAt: params.expiresAt,
    revokedAt: null,
    generatedAt: params.generatedAt,
    metadataOnly: true,
    policyGated: true,
    publicAccessEnabled: false,
    publicProfileEnabled: false,
    externalSubmissionEnabled: false,
    providerIntegrationEnabled: false,
    automatedDecisioningEnabled: false,
    recipientAccess: {
      enabled: false,
      accessUrl: null,
      accessTokenIssued: false,
      recipientAuthenticationRequired: true,
      sessionBound: true,
      downloadEnabled: false,
      summary:
        "Recipient access is modeled for controlled future review only; no public link or external delivery is created by this grant.",
    },
    package: params.package,
    includedClaims: params.includedClaims,
    excludedClaims: params.excludedClaims,
    redactions: [
      "Raw identity documents are excluded.",
      "Raw provider payloads are excluded.",
      "Support/internal metadata is excluded.",
      "Public trust profiles and public links are not created.",
      "External institution delivery is disabled.",
    ],
    disclaimers: [
      "This access grant is tenant-mediated and metadata-only.",
      "Recipient access requires a future authenticated session before any controlled view can be served.",
      "This grant is not a credit, insurance, subsidy, ownership, or automated eligibility decision.",
      "Revoked or expired grants must not expose active trust data in RentChain-controlled surfaces.",
    ],
  };
}

function outcomeForEventType(eventType: TenantInstitutionAccessAuditEvent["eventType"]): TenantInstitutionAccessAuditOutcome {
  if (eventType === "tenant_institution_access_granted") return "granted";
  if (eventType === "tenant_institution_access_revoked" || eventType === "recipient_trust_review_revoked") return "revoked";
  if (eventType === "tenant_institution_access_expired" || eventType === "recipient_trust_review_expired") return "expired";
  if (eventType === "recipient_trust_review_opened") return "opened";
  return "blocked";
}

function statusForAuditEvent(event: TenantInstitutionAccessStoredGrant["events"][number]): TenantInstitutionAccessAuditEvent["status"] {
  if (event.status) return event.status as TenantInstitutionAccessAuditEvent["status"];
  if (event.eventType === "tenant_institution_access_granted") return "granted";
  if (event.eventType === "tenant_institution_access_revoked" || event.eventType === "recipient_trust_review_revoked") return "revoked";
  if (event.eventType === "tenant_institution_access_expired" || event.eventType === "recipient_trust_review_expired") return "expired";
  if (event.eventType === "recipient_trust_review_opened") return "available";
  return "blocked";
}

function reasonForAuditEvent(event: TenantInstitutionAccessStoredGrant["events"][number]): TenantInstitutionAccessAuditEvent["reason"] {
  if (event.reason) return event.reason as TenantInstitutionAccessAuditEvent["reason"];
  if (event.eventType === "tenant_institution_access_granted") return "access_granted";
  if (event.eventType === "tenant_institution_access_revoked" || event.eventType === "recipient_trust_review_revoked") {
    return "access_revoked";
  }
  if (event.eventType === "tenant_institution_access_expired" || event.eventType === "recipient_trust_review_expired") {
    return "access_expired";
  }
  if (event.eventType === "recipient_trust_review_opened") return "review_available";
  return "grant_blocked";
}

function auditEventFromGrantEvent(event: TenantInstitutionAccessStoredGrant["events"][number]): TenantInstitutionAccessAuditEvent | null {
  const occurredAt = asString(event?.occurredAt, 80);
  if (!occurredAt || event?.metadataOnly !== true) return null;
  const eventType = event.eventType;
  return {
    eventType,
    occurredAt,
    actorType: event.actorType === "tenant" || event.actorType === "system" ? event.actorType : "recipient",
    outcome: outcomeForEventType(eventType),
    status: statusForAuditEvent(event),
    reason: reasonForAuditEvent(event),
    metadataOnly: true,
  };
}

function buildAccessAudit(record: TenantInstitutionAccessStoredGrant): {
  auditSummary: TenantInstitutionAccessAuditSummary;
  auditTimeline: TenantInstitutionAccessAuditEvent[];
} {
  const auditTimeline = (Array.isArray(record.events) ? record.events : [])
    .map(auditEventFromGrantEvent)
    .filter(Boolean) as TenantInstitutionAccessAuditEvent[];
  auditTimeline.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  const last = auditTimeline[0] || null;
  const lastOpened = auditTimeline.find((event) => event.outcome === "opened") || null;
  const lastBlocked = auditTimeline.find((event) => event.outcome === "blocked") || null;
  return {
    auditTimeline,
    auditSummary: {
      schemaVersion: "recipient_access_audit.v1",
      metadataOnly: true,
      totalEvents: auditTimeline.length,
      openedReviewCount: auditTimeline.filter((event) => event.outcome === "opened").length,
      blockedReviewCount: auditTimeline.filter((event) => event.outcome === "blocked").length,
      revokedAccessCount: auditTimeline.filter((event) => event.outcome === "revoked").length,
      expiredAccessCount: auditTimeline.filter((event) => event.outcome === "expired").length,
      lastActivityAt: last?.occurredAt || null,
      lastOpenedAt: lastOpened?.occurredAt || null,
      lastBlockedAt: lastBlocked?.occurredAt || null,
      lastOutcome: last?.outcome || null,
      lastReason: last?.reason || null,
      recipientIdentifier: {
        email: record.recipient?.email || "",
        redactedEmail: redactEmail(record.recipient?.email),
        organizationName: record.recipient?.organizationName || null,
      },
      visibility: {
        tenantVisible: true,
        supportSafe: true,
        trustPayloadIncluded: false,
        supportMetadataIncluded: false,
        rawProviderPayloadIncluded: false,
        publicAccessEnabled: false,
        downloadEnabled: false,
      },
    },
  };
}

function publicGrant(record: TenantInstitutionAccessStoredGrant): TenantInstitutionAccessGrant {
  const { tenantId: _tenantId, ...rest } = record;
  const { auditSummary, auditTimeline } = buildAccessAudit(record);
  return { ...rest, auditSummary, auditTimeline };
}

function supportDiagnosticFromGrant(record: TenantInstitutionAccessStoredGrant): SupportInstitutionAccessDiagnosticSummary {
  const { auditSummary, auditTimeline } = buildAccessAudit(record);
  const reasonCategories = Array.from(new Set(auditTimeline.map((event) => event.reason).filter(Boolean))).sort();
  const timeline = auditTimeline.map((event) => ({
    ...event,
    visibility: {
      supportVisible: true as const,
      trustPayloadIncluded: false as const,
      rawProviderPayloadIncluded: false as const,
      supportMetadataIncluded: false as const,
    },
  }));

  return {
    schemaVersion: "support_institution_access_diagnostics.v1",
    grantId: record.grantId,
    lifecycle: record.lifecycle,
    audience: record.audience,
    purpose: record.purpose,
    recipient: {
      redactedEmail: redactEmail(record.recipient?.email),
      organizationName: record.recipient?.organizationName || null,
      authenticationRequirement: "recipient_email_session_required",
    },
    tenant: {
      redactedTenantId: redactIdentifier(record.tenantId),
    },
    consent: {
      granted: record.consent?.granted === true,
      consentVersion: CONSENT_VERSION,
      grantedAt: record.consent?.grantedAt || null,
      expiresAt: record.consent?.expiresAt || null,
      revokedAt: record.consent?.revokedAt || null,
    },
    access: {
      recipientAuthenticationRequired: true,
      sessionBound: true,
      publicAccessEnabled: false,
      publicProfileEnabled: false,
      externalSubmissionEnabled: false,
      downloadEnabled: false,
    },
    package: {
      status: String(record.package?.status || "unknown").slice(0, 120),
      blockedReasonCount: Array.isArray(record.package?.blockedReasons) ? record.package.blockedReasons.length : 0,
      exportSummaryCount: Array.isArray(record.package?.exportSummaries) ? record.package.exportSummaries.length : 0,
    },
    audit: {
      totalEvents: auditSummary.totalEvents,
      openedReviewCount: auditSummary.openedReviewCount,
      blockedReviewCount: auditSummary.blockedReviewCount,
      revokedAccessCount: auditSummary.revokedAccessCount,
      expiredAccessCount: auditSummary.expiredAccessCount,
      lastActivityAt: auditSummary.lastActivityAt,
      lastOpenedAt: auditSummary.lastOpenedAt,
      lastBlockedAt: auditSummary.lastBlockedAt,
      lastOutcome: auditSummary.lastOutcome,
      lastReason: auditSummary.lastReason,
      reasonCategories,
    },
    payloadSafety: {
      metadataOnly: true,
      supportSafe: true,
      trustPayloadIncluded: false,
      portableAttestationContentsIncluded: false,
      rawProviderPayloadIncluded: false,
      rawIdentityPayloadIncluded: false,
      rawPropertyPayloadIncluded: false,
      supportMetadataIncluded: false,
      unsafePortablePayloadDetected: hasUnsafeRecipientPayload(record),
    },
    timeline,
  };
}

function asGrant(id: string, data: any): TenantInstitutionAccessStoredGrant {
  const expiresAt = asString(data?.expiresAt);
  const lifecycle =
    data?.lifecycle === "revoked"
      ? "revoked"
      : expiresAt && Date.parse(expiresAt) <= Date.now()
      ? "expired"
      : data?.lifecycle === "blocked" || data?.package?.status !== "export_ready"
      ? "blocked"
      : "active";
  return {
    ...(data || {}),
    grantId: id,
    lifecycle,
  } as TenantInstitutionAccessStoredGrant;
}

function normalizeRecipientEmailForReview(value: unknown) {
  return normalizeEmail(value);
}

function denyRecipientReview(
  status: RecipientTrustReviewStatus,
  reason: RecipientTrustReviewAccessDecision["reason"]
): RecipientTrustReviewResult {
  return {
    decision: {
      allowed: false,
      status,
      reason,
      metadataOnly: true,
      publicAccessEnabled: false,
      downloadEnabled: false,
    },
    summary: null,
  };
}

function hasUnsafeRecipientPayload(grant: TenantInstitutionAccessStoredGrant) {
  const payload = JSON.stringify({
    package: grant.package,
    includedClaims: grant.includedClaims,
    excludedClaims: grant.excludedClaims,
    recipientAccess: grant.recipientAccess,
  });
  return (
    payload.includes("rawProviderPayloadIncluded\":true") ||
    payload.includes("rawEvidenceIncluded\":true") ||
    payload.includes("supportMetadataIncluded\":true") ||
    payload.includes("rawSensitivePayloadStored\":true") ||
    payload.includes("publicAccessEnabled\":true") ||
    payload.includes("externalSubmissionEnabled\":true") ||
    payload.includes("accessTokenIssued\":true") ||
    payload.includes("downloadEnabled\":true")
  );
}

function recipientSummaryFromGrant(
  grant: TenantInstitutionAccessStoredGrant,
  reviewedAt: string
): RecipientTrustReviewSummary {
  return {
    schemaVersion: "recipient_trust_review.v1",
    grantId: grant.grantId,
    audience: grant.audience,
    purpose: grant.purpose,
    lifecycle: "active",
    recipient: {
      email: grant.recipient.email,
      displayName: grant.recipient.displayName,
      organizationName: grant.recipient.organizationName,
    },
    consent: {
      granted: true,
      consentVersion: grant.consent.consentVersion,
      grantedAt: grant.consent.grantedAt,
      expiresAt: grant.consent.expiresAt,
      audience: grant.consent.audience,
      purpose: grant.consent.purpose,
    },
    access: {
      authenticated: true,
      sessionBound: true,
      viewOnly: true,
      downloadEnabled: false,
      publicAccessEnabled: false,
      publicProfileEnabled: false,
      externalSubmissionEnabled: false,
      providerIntegrationEnabled: false,
      automatedDecisioningEnabled: false,
    },
    generatedAt: grant.generatedAt,
    expiresAt: grant.expiresAt,
    reviewedAt,
    metadataOnly: true,
    policyGated: true,
    includedClaims: (grant.includedClaims || []).map((claim) => ({
      claimCategory: claim.claimCategory,
      claimLabel: claim.claimLabel,
      lifecycleState: claim.lifecycleState,
      consentExpiresAt: claim.consentExpiresAt,
    })),
    excludedClaims: (grant.excludedClaims || []).map((claim) => ({
      claimCategory: claim.claimCategory,
      claimLabel: claim.claimLabel,
      reasons: Array.isArray(claim.reasons) ? claim.reasons : [],
    })),
    redactions: grant.redactions || [],
    disclaimers: [
      "This review is tenant-authorized, metadata-only, and view-only.",
      "This review is not a credit, insurance, subsidy, ownership, government, or automated eligibility decision.",
      "Raw identity documents, raw provider payloads, support/internal metadata, public profiles, and downloads are excluded.",
      ...(grant.disclaimers || []),
    ],
  };
}

async function appendRecipientReviewEvent(params: {
  grant: TenantInstitutionAccessStoredGrant;
  eventType:
    | "recipient_trust_review_opened"
    | "recipient_trust_review_blocked"
    | "recipient_trust_review_expired"
    | "recipient_trust_review_revoked";
  occurredAt: string;
  status: RecipientTrustReviewStatus;
  reason: RecipientTrustReviewAccessDecision["reason"];
}) {
  const ref = db.collection(COLLECTION).doc(params.grant.grantId);
  const events = [
    ...(Array.isArray(params.grant.events) ? params.grant.events : []),
    {
      eventType: params.eventType,
      occurredAt: params.occurredAt,
      actorType: "recipient" as const,
      metadataOnly: true as const,
      outcome: outcomeForEventType(params.eventType),
      status: params.status,
      reason: params.reason,
    },
  ].slice(-50);
  await ref.set({ events, updatedAt: params.occurredAt }, { merge: true });
}

export async function getRecipientTrustReview(params: {
  grantId: string;
  recipientEmail?: unknown;
}): Promise<RecipientTrustReviewResult> {
  const grantId = asString(params.grantId);
  const recipientEmail = normalizeRecipientEmailForReview(params.recipientEmail);
  if (!recipientEmail) {
    return denyRecipientReview("unauthenticated", "recipient_authentication_required");
  }
  if (!grantId) return denyRecipientReview("not_found", "grant_not_found");

  const snap = await db.collection(COLLECTION).doc(grantId).get();
  if (!snap.exists) return denyRecipientReview("not_found", "grant_not_found");

  const grant = asGrant(grantId, snap.data?.() || {});
  const reviewedAt = nowIso();
  if (normalizeRecipientEmailForReview(grant.recipient?.email) !== recipientEmail) {
    await appendRecipientReviewEvent({
      grant,
      eventType: "recipient_trust_review_blocked",
      occurredAt: reviewedAt,
      status: "recipient_mismatch",
      reason: "recipient_email_mismatch",
    });
    return denyRecipientReview("recipient_mismatch", "recipient_email_mismatch");
  }

  const denyWithEvent = async (
    status: RecipientTrustReviewStatus,
    reason: RecipientTrustReviewAccessDecision["reason"],
    eventType:
      | "recipient_trust_review_blocked"
      | "recipient_trust_review_expired"
      | "recipient_trust_review_revoked" = "recipient_trust_review_blocked"
  ) => {
    await appendRecipientReviewEvent({ grant, eventType, occurredAt: reviewedAt, status, reason });
    return denyRecipientReview(status, reason);
  };

  if (grant.lifecycle === "revoked" || grant.revokedAt || grant.consent?.revokedAt) {
    return denyWithEvent("revoked", "grant_revoked", "recipient_trust_review_revoked");
  }
  if (grant.lifecycle === "expired" || (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.now())) {
    return denyWithEvent("expired", "grant_expired", "recipient_trust_review_expired");
  }
  if (grant.lifecycle === "blocked") return denyWithEvent("blocked", "grant_blocked");
  if (grant.lifecycle === "reverification_required") {
    return denyWithEvent("reverification_required", "trust_reverification_required");
  }
  if (grant.consent?.granted !== true || !grant.consent?.consentId) {
    return denyWithEvent("consent_required", "tenant_consent_missing");
  }
  if (grant.package?.status !== "export_ready" || !Array.isArray(grant.package?.exportSummaries) || !grant.package.exportSummaries.length) {
    return denyWithEvent("policy_denied", "policy_gated_summary_unavailable");
  }
  if (hasUnsafeRecipientPayload(grant)) {
    return denyWithEvent("policy_denied", "policy_gated_summary_unavailable");
  }

  await appendRecipientReviewEvent({
    grant,
    eventType: "recipient_trust_review_opened",
    occurredAt: reviewedAt,
    status: "available",
    reason: "review_available",
  });

  return {
    decision: {
      allowed: true,
      status: "available",
      reason: "review_available",
      metadataOnly: true,
      publicAccessEnabled: false,
      downloadEnabled: false,
    },
    summary: recipientSummaryFromGrant(grant, reviewedAt),
  };
}

export async function getSupportInstitutionAccessDiagnostic(params: { grantId: string }) {
  const grantId = asString(params.grantId);
  if (!grantId) return null;
  const snap = await db.collection(COLLECTION).doc(grantId).get();
  if (!snap.exists) return null;
  const grant = asGrant(grantId, snap.data?.() || {});
  return supportDiagnosticFromGrant(grant);
}

export async function previewTenantInstitutionAccess(params: {
  tenantId: string;
  audience?: unknown;
  purpose?: unknown;
  recipient?: unknown;
  expiresInDays?: unknown;
  consentAccepted?: boolean;
}) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return null;
  const recipient = normalizeRecipient(params.recipient);
  if (!recipient) throw new Error("tenant_institution_access_recipient_required");
  const expiresInDays = clampExpiresInDays(params.expiresInDays);
  if (!expiresInDays) throw new Error("tenant_institution_access_expiration_required");

  const audience = sanitizeAudience(params.audience);
  const purpose = purposeForAudience(audience);
  const generatedAt = nowIso();
  const expiresAt = addDaysIso(generatedAt, expiresInDays);
  const grantId = params.consentAccepted
    ? grantIdFor({ tenantId, audience, purpose, recipientEmail: recipient.email, generatedAt })
    : null;
  const trustPreview = await previewTenantTrustExport({
    tenantId,
    audience: toTrustExportAudience(audience),
    purpose: toTrustExportPurpose(purpose),
    expiresInDays,
    consentAccepted: params.consentAccepted === true,
  });
  if (!trustPreview) return null;

  return accessPreviewFromTrustPackage({
    grantId,
    tenantId,
    audience,
    purpose,
    recipient,
    generatedAt,
    expiresAt,
    consentAccepted: params.consentAccepted === true,
    package: trustPreview.package,
    includedClaims: trustPreview.includedClaims,
    excludedClaims: trustPreview.excludedClaims,
  });
}

export async function createTenantInstitutionAccessGrant(params: {
  tenantId: string;
  audience?: unknown;
  purpose?: unknown;
  recipient?: unknown;
  expiresInDays?: unknown;
  consentAccepted?: boolean;
}) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return null;
  if (params.consentAccepted !== true) throw new Error("tenant_institution_access_consent_required");
  const preview = await previewTenantInstitutionAccess({ ...params, tenantId, consentAccepted: true });
  if (!preview) return null;
  if (preview.lifecycle === "blocked" || preview.lifecycle === "reverification_required" || preview.package.status !== "export_ready") {
    throw new Error("tenant_institution_access_policy_blocked");
  }
  if (!preview.grantId) throw new Error("tenant_institution_access_invalid");
  const createdAt = preview.generatedAt;
  const record: TenantInstitutionAccessStoredGrant = {
    ...preview,
    grantId: preview.grantId,
    tenantId,
    lifecycle: "active",
    createdAt,
    updatedAt: createdAt,
    events: [
      {
        eventType: "tenant_institution_access_granted",
        occurredAt: createdAt,
        actorType: "tenant",
        metadataOnly: true,
        outcome: "granted",
        status: "granted",
        reason: "access_granted",
      },
    ],
  };
  await db.collection(COLLECTION).doc(record.grantId).set(record);
  return publicGrant(record);
}

export async function listTenantInstitutionAccessGrants(params: { tenantId: string }) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return [];
  const snap = await db.collection(COLLECTION).where("tenantId", "==", tenantId).limit(25).get();
  return (snap.docs || [])
    .map((doc: any) => asGrant(String(doc.id || ""), doc.data?.() || {}))
    .map(publicGrant)
    .sort((left, right) => Date.parse(right.createdAt || right.generatedAt) - Date.parse(left.createdAt || left.generatedAt));
}

export async function revokeTenantInstitutionAccessGrant(params: { tenantId: string; grantId: string }) {
  const tenantId = asString(params.tenantId);
  const grantId = asString(params.grantId);
  if (!tenantId || !grantId) return null;
  const ref = db.collection(COLLECTION).doc(grantId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = asGrant(grantId, snap.data?.() || {});
  if (current.tenantId !== tenantId) return false;
  const updatedAt = nowIso();
  const events = [
    ...(Array.isArray(current.events) ? current.events : []),
    {
      eventType: "tenant_institution_access_revoked" as const,
      occurredAt: updatedAt,
      actorType: "tenant" as const,
      metadataOnly: true as const,
      outcome: "revoked" as const,
      status: "revoked" as const,
      reason: "access_revoked" as const,
    },
  ];
  await ref.set(
    {
      lifecycle: "revoked",
      revokedAt: updatedAt,
      updatedAt,
      events,
      consent: {
        ...current.consent,
        granted: false,
        revokedAt: updatedAt,
      },
      recipientAccess: {
        ...current.recipientAccess,
        enabled: false,
        accessUrl: null,
        accessTokenIssued: false,
        downloadEnabled: false,
      },
    },
    { merge: true }
  );
  return publicGrant({
    ...current,
    lifecycle: "revoked",
    revokedAt: updatedAt,
    updatedAt,
    events,
    consent: {
      ...current.consent,
      granted: false,
      revokedAt: updatedAt,
    },
    recipientAccess: {
      ...current.recipientAccess,
      enabled: false,
      accessUrl: null,
      accessTokenIssued: false,
      downloadEnabled: false,
    },
  });
}
