import crypto from "crypto";
import { db } from "../../config/firebase";
import {
  deriveInstitutionalTrustExportPackage,
  type InstitutionalTrustExportAudience,
  type InstitutionalTrustExportPackage,
  type InstitutionalTrustExportPurpose,
} from "../../lib/institutionTrustExports";
import type {
  PortableAttestation,
  PortableAttestationAudience,
  PortableAttestationClaimCategory,
  PortableAttestationPurpose,
} from "../../lib/portableAttestations";
import { deriveTenantCredibilitySignals } from "../tenantCredibility/deriveTenantCredibilitySignals";
import { deriveIdentityPortability, type PortableIdentity } from "../identityPortability/deriveIdentityPortability";
import { deriveIdentityTimeline } from "../identityTimeline/deriveIdentityTimeline";
import { derivePaymentReadiness, type PaymentReadiness } from "../paymentReadiness/derivePaymentReadiness";
import { resolveTenancyContext } from "./tenancyContextService";
import {
  loadTenantIdentityRecord,
  type TenantIdentityRecord,
} from "./tenantProfileService";

const COLLECTION = "tenantTrustExports";
const CONSENT_VERSION = "tenant_trust_export_consent.v1";
const DEFAULT_EXPIRES_DAYS = 14;
const MAX_EXPIRES_DAYS = 30;

export type TenantTrustExportAudience =
  | "tenant_portability"
  | "insurer"
  | "lender"
  | "institutional_landlord"
  | "auditor";

export type TenantTrustExportPurpose =
  | "tenant_controlled_portability"
  | "insurance_review"
  | "lender_review"
  | "institutional_landlord_review"
  | "auditor_review";

export type TenantTrustExportLifecycle =
  | "preview"
  | "prepared"
  | "revoked"
  | "expired"
  | "blocked"
  | "consent_required"
  | "superseded"
  | "archived"
  | "reverification_required"
  | "invalidated"
  | "replaced";

export type TrustExportLifecycleReason =
  | "export_active"
  | "export_expired"
  | "export_revoked"
  | "export_superseded"
  | "export_archived"
  | "export_replaced"
  | "export_blocked"
  | "source_attestation_revoked"
  | "source_attestation_expired"
  | "source_attestation_superseded"
  | "source_reverification_required"
  | "policy_gate_blocked";

export type TrustExportLifecycleControl = {
  schemaVersion: "trust_export_lifecycle_control.v1";
  state: Exclude<TenantTrustExportLifecycle, "preview" | "consent_required">;
  reason: TrustExportLifecycleReason;
  active: boolean;
  shareable: boolean;
  evaluatedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  supersededAt: string | null;
  supersededByExportId: string | null;
  archivedAt: string | null;
  replacedByExportId: string | null;
  invalidatedAt: string | null;
  sourceAttestationIds: string[];
  metadataOnly: true;
  publicAccessEnabled: false;
  downloadEnabled: false;
};

export type TrustExportLifecycleEvent = {
  eventType:
    | "trust_export_prepared"
    | "trust_export_expired"
    | "trust_export_revoked"
    | "trust_export_superseded"
    | "trust_export_archived"
    | "trust_export_replaced"
    | "trust_export_invalidation_detected"
    | "trust_export_reverification_required";
  occurredAt: string;
  actorType: "tenant" | "system";
  reason: TrustExportLifecycleReason;
  metadataOnly: true;
};

export type TenantTrustExportConsentState = {
  required: true;
  granted: boolean;
  consentId: string | null;
  consentVersion: typeof CONSENT_VERSION;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  claimCategories: PortableAttestationClaimCategory[];
  summary:
    "Tenant consent is required before RentChain prepares this non-public, metadata-only trust export package.";
};

export type TenantTrustExportPreview = {
  exportId: string | null;
  schemaVersion: "tenant_trust_export.v1";
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  lifecycle: TenantTrustExportLifecycle;
  consent: TenantTrustExportConsentState;
  expiresAt: string | null;
  revokedAt: string | null;
  supersededAt: string | null;
  supersededByExportId: string | null;
  archivedAt: string | null;
  replacedByExportId: string | null;
  invalidatedAt: string | null;
  generatedAt: string;
  lifecycleControl: TrustExportLifecycleControl;
  lifecycleEvents: TrustExportLifecycleEvent[];
  metadataOnly: true;
  publicAccessEnabled: false;
  downloadEnabled: boolean;
  externalSubmissionEnabled: false;
  policyGated: true;
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

export type TenantTrustExportRecord = TenantTrustExportPreview & {
  exportId: string;
  lifecycle: Exclude<TenantTrustExportLifecycle, "preview" | "consent_required">;
  createdAt: string;
  updatedAt: string;
};

type TenantTrustContext = {
  tenantId: string;
  identity: TenantIdentityRecord;
  portableIdentity: PortableIdentity;
  paymentReadiness: PaymentReadiness | null;
  leaseSummary: {
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    monthlyRent: number | null;
  } | null;
};

type TenantTrustExportStoredRecord = TenantTrustExportRecord & {
  tenantId: string;
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

function timestampAtOrBefore(value: string | null | undefined, comparedAt: string) {
  if (!value) return false;
  const candidate = Date.parse(value);
  const now = Date.parse(comparedAt);
  return Number.isFinite(candidate) && Number.isFinite(now) && candidate <= now;
}

function clampExpiresInDays(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_EXPIRES_DAYS;
  return Math.min(Math.max(Math.round(numeric), 1), MAX_EXPIRES_DAYS);
}

function sanitizeAudience(value: unknown): TenantTrustExportAudience {
  return value === "insurer" ||
    value === "lender" ||
    value === "institutional_landlord" ||
    value === "auditor"
    ? value
    : "tenant_portability";
}

function purposeForAudience(audience: TenantTrustExportAudience): TenantTrustExportPurpose {
  if (audience === "insurer") return "insurance_review";
  if (audience === "lender") return "lender_review";
  if (audience === "institutional_landlord") return "institutional_landlord_review";
  if (audience === "auditor") return "auditor_review";
  return "tenant_controlled_portability";
}

function sanitizePurpose(value: unknown, audience: TenantTrustExportAudience): TenantTrustExportPurpose {
  void value;
  return purposeForAudience(audience);
}

function toPortableAudience(audience: TenantTrustExportAudience): PortableAttestationAudience {
  if (audience === "tenant_portability") return "tenant";
  return audience;
}

function toPortablePurpose(purpose: TenantTrustExportPurpose): PortableAttestationPurpose {
  if (purpose === "tenant_controlled_portability") return "tenant_controlled_sharing";
  if (purpose === "institutional_landlord_review") return "future_institution_review";
  return purpose;
}

function toInstitutionalAudience(audience: TenantTrustExportAudience): InstitutionalTrustExportAudience {
  return audience;
}

function toInstitutionalPurpose(purpose: TenantTrustExportPurpose): InstitutionalTrustExportPurpose {
  return purpose;
}

function consentIdFor(params: {
  tenantId: string;
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  generatedAt: string;
}) {
  const subjectRef = crypto.createHash("sha256").update(params.tenantId).digest("hex").slice(0, 16);
  return [
    "tenant_trust_export_consent",
    subjectRef,
    params.audience,
    params.purpose,
    Date.parse(params.generatedAt).toString(36),
  ]
    .join(":")
    .replace(/[^a-zA-Z0-9_.:-]+/g, "_");
}

function exportIdFor(params: {
  tenantId: string;
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  generatedAt: string;
}) {
  const subjectRef = crypto.createHash("sha256").update(params.tenantId).digest("hex").slice(0, 16);
  return [
    "tenant_trust_export",
    subjectRef,
    params.audience,
    params.purpose,
    Date.parse(params.generatedAt).toString(36),
  ]
    .join(":")
    .replace(/[^a-zA-Z0-9_.:-]+/g, "_");
}

function sourceAttestationIds(record: Pick<TenantTrustExportPreview, "package">) {
  return Array.from(
    new Set((record.package?.exportSummaries || []).map((summary: any) => asString(summary?.attestationId)).filter(Boolean) as string[])
  );
}

function lifecycleEvent(params: {
  eventType: TrustExportLifecycleEvent["eventType"];
  occurredAt: string;
  reason: TrustExportLifecycleReason;
  actorType?: TrustExportLifecycleEvent["actorType"];
}): TrustExportLifecycleEvent {
  return {
    eventType: params.eventType,
    occurredAt: params.occurredAt,
    actorType: params.actorType || "system",
    reason: params.reason,
    metadataOnly: true,
  };
}

function lifecycleControl(params: {
  state: TrustExportLifecycleControl["state"];
  reason: TrustExportLifecycleReason;
  evaluatedAt: string;
  record: Partial<TenantTrustExportPreview>;
  supersededByExportId?: string | null;
  replacedByExportId?: string | null;
  invalidatedAt?: string | null;
}): TrustExportLifecycleControl {
  const active = params.state === "prepared";
  return {
    schemaVersion: "trust_export_lifecycle_control.v1",
    state: params.state,
    reason: params.reason,
    active,
    shareable: active,
    evaluatedAt: params.evaluatedAt,
    expiresAt: params.record.expiresAt || null,
    revokedAt: params.record.revokedAt || null,
    supersededAt: params.record.supersededAt || null,
    supersededByExportId: params.supersededByExportId ?? params.record.supersededByExportId ?? null,
    archivedAt: params.record.archivedAt || null,
    replacedByExportId: params.replacedByExportId ?? params.record.replacedByExportId ?? null,
    invalidatedAt: params.invalidatedAt ?? params.record.invalidatedAt ?? null,
    sourceAttestationIds: params.record.package ? sourceAttestationIds(params.record as TenantTrustExportPreview) : [],
    metadataOnly: true,
    publicAccessEnabled: false,
    downloadEnabled: false,
  };
}

function evaluateStoredExportLifecycle(
  record: TenantTrustExportStoredRecord,
  evaluatedAt = nowIso()
): { state: TrustExportLifecycleControl["state"]; reason: TrustExportLifecycleReason; invalidatedAt: string | null } {
  if (record.lifecycle === "revoked" || record.revokedAt || record.consent?.revokedAt) {
    return { state: "revoked", reason: "export_revoked", invalidatedAt: record.revokedAt || record.consent?.revokedAt || evaluatedAt };
  }
  if (record.lifecycle === "archived" || record.archivedAt) {
    return { state: "archived", reason: "export_archived", invalidatedAt: record.archivedAt || evaluatedAt };
  }
  if (record.lifecycle === "superseded" || record.supersededAt) {
    return { state: "superseded", reason: "export_superseded", invalidatedAt: record.supersededAt || evaluatedAt };
  }
  if (record.lifecycle === "replaced" || record.replacedByExportId) {
    return { state: "replaced", reason: "export_replaced", invalidatedAt: evaluatedAt };
  }
  if (timestampAtOrBefore(record.expiresAt, evaluatedAt) || timestampAtOrBefore(record.consent?.expiresAt, evaluatedAt)) {
    return { state: "expired", reason: "export_expired", invalidatedAt: record.expiresAt || record.consent?.expiresAt || evaluatedAt };
  }

  for (const summary of record.package?.exportSummaries || []) {
    if (summary?.status === "revoked" || summary?.revokedAt) {
      return { state: "invalidated", reason: "source_attestation_revoked", invalidatedAt: summary.revokedAt || evaluatedAt };
    }
    if (summary?.status === "superseded" || summary?.supersededAt || summary?.lifecycleState === "superseded") {
      return { state: "superseded", reason: "source_attestation_superseded", invalidatedAt: summary.supersededAt || evaluatedAt };
    }
    if (
      summary?.status === "expired" ||
      summary?.lifecycleState === "expired" ||
      timestampAtOrBefore(summary?.expiresAt, evaluatedAt) ||
      timestampAtOrBefore(summary?.consentExpiresAt, evaluatedAt)
    ) {
      return { state: "expired", reason: "source_attestation_expired", invalidatedAt: summary?.expiresAt || summary?.consentExpiresAt || evaluatedAt };
    }
    if (
      summary?.status === "reverification_required" ||
      summary?.lifecycleState === "reverification_required" ||
      timestampAtOrBefore(summary?.nextReverificationAt, evaluatedAt)
    ) {
      return { state: "reverification_required", reason: "source_reverification_required", invalidatedAt: summary?.nextReverificationAt || evaluatedAt };
    }
  }

  if (record.package?.status !== "export_ready") {
    return { state: "blocked", reason: "policy_gate_blocked", invalidatedAt: evaluatedAt };
  }

  return { state: "prepared", reason: "export_active", invalidatedAt: null };
}

function lifecycleEventTypeForDecision(
  state: TrustExportLifecycleControl["state"],
  reason: TrustExportLifecycleReason
): TrustExportLifecycleEvent["eventType"] | null {
  if (state === "prepared") return null;
  if (state === "expired") return "trust_export_expired";
  if (state === "revoked") return "trust_export_revoked";
  if (state === "superseded") return "trust_export_superseded";
  if (state === "archived") return "trust_export_archived";
  if (state === "replaced") return "trust_export_replaced";
  if (state === "reverification_required" || reason === "source_reverification_required") {
    return "trust_export_reverification_required";
  }
  return "trust_export_invalidation_detected";
}

async function resolveTenantTrustContext(tenantId: string): Promise<TenantTrustContext | null> {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get().catch(() => null as any);
  const tenantData = tenantSnap?.exists ? ((tenantSnap.data() as any) || {}) : {};
  const email = asString(tenantData?.email);
  const context = await resolveTenancyContext({
    uid: tenantId,
    email,
    tenantId,
    leaseId: asString(tenantData?.leaseId) || asString(tenantData?.currentLeaseId),
  });
  if (!context?.ok) return null;

  const identity = await loadTenantIdentityRecord({
    context,
    userId: tenantId,
    userEmail: email,
  });
  if (!identity) return null;

  const leaseSnap = context.leaseId
    ? await db.collection("leases").doc(String(context.leaseId || "")).get().catch(() => null as any)
    : null;
  const lease = leaseSnap?.exists ? ((leaseSnap.data() as any) || {}) : null;
  const paymentReadiness = lease
    ? derivePaymentReadiness({
        leaseId: String(context.leaseId || ""),
        monthlyRent: lease?.monthlyRent,
        startDate: lease?.startDate,
        endDate: lease?.endDate,
        dueDay: lease?.dueDay,
        tenantId,
        propertyId: context.propertyId,
        unitId: context.unitId,
        leaseExecution: null,
      })
    : null;

  const { landlordSafeSummary } = deriveTenantCredibilitySignals({
    tenantIdentityRecord: identity,
    leaseExecution: null,
  });
  const identityTimeline = await deriveIdentityTimeline({
    tenantId,
    applicationId: context.applicationId,
    leaseId: context.leaseId,
  });
  const { portableIdentity } = deriveIdentityPortability({
    tenantIdentityRecord: identity,
    credibilitySummary: landlordSafeSummary,
    shareAvailability: { sharingEnabled: true },
    timelineAvailability: {
      hasIdentityTimeline: Array.isArray(identityTimeline?.events) && identityTimeline.events.length > 0,
    },
  });

  return {
    tenantId,
    identity,
    portableIdentity,
    paymentReadiness,
    leaseSummary: lease
      ? {
          status: asString(lease?.status),
          startDate: asString(lease?.startDate),
          endDate: asString(lease?.endDate),
          monthlyRent: Number.isFinite(Number(lease?.monthlyRent)) ? Number(lease?.monthlyRent) : null,
        }
      : null,
  };
}

function baseAttestation(params: {
  attestationId: string;
  claimCategory: PortableAttestationClaimCategory;
  claimLabel: string;
  claimDescription: string;
  sourceCategory: string;
  audience: PortableAttestationAudience;
  purpose: PortableAttestationPurpose;
  generatedAt: string;
  consentId: string | null;
  consentGrantedAt: string | null;
  consentExpiresAt: string | null;
  status?: PortableAttestation["status"];
  lifecycleState?: PortableAttestation["lifecycleState"];
  confidence?: PortableAttestation["confidence"];
}): PortableAttestation {
  return {
    attestationId: params.attestationId,
    attestationType: params.claimCategory === "identity_assurance" ? "identity_assurance" : "tenant_portability",
    subjectType: "tenant",
    subjectId: "tenant_controlled_subject",
    claimCategory: params.claimCategory,
    claimLabel: params.claimLabel,
    claimDescription: params.claimDescription,
    status: params.status || "active",
    lifecycleState: params.lifecycleState || "export_ready",
    issuerCategory: "rentchain",
    audience: params.audience,
    consentScope: {
      consentId: params.consentId,
      purpose: params.purpose,
      audience: params.audience,
      grantedAt: params.consentGrantedAt,
      expiresAt: params.consentExpiresAt,
      revokedAt: null,
      claimCategories: [params.claimCategory],
      attributeScopes: ["metadata_summary"],
    },
    retentionClass: "portable_metadata",
    evidenceSummary: {
      evidenceCategory: "metadata_only",
      sourceSystem: "tenant_share_package",
      sourceCategory: params.sourceCategory,
      sourceVersion: "tenant_trust_export.v1",
      auditEventRef: null,
      rawEvidenceIncluded: false,
    },
    sourceReference: {
      sourceSystem: "tenant_share_package",
      sourceId: "tenant_controlled_trust_export",
      sourceAttestationId: null,
      sourceVersion: "tenant_trust_export.v1",
    },
    confidence: params.confidence || "medium",
    issuedAt: params.generatedAt,
    effectiveAt: params.generatedAt,
    expiresAt: params.consentExpiresAt,
    revokedAt: null,
    supersededAt: null,
    nextReverificationAt: null,
    jurisdiction: null,
    redactionProfile: "strict",
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    rawProviderPayloadIncluded: false,
    supportMetadataIncluded: false,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
    unsupportedClaim: false,
    supportVisible: true,
    reviewRequired: true,
    nonAuthorityDisclaimers: [
      "This is a tenant-controlled metadata summary, not a public profile or automated approval.",
      "RentChain is not making a credit, insurance, subsidy, ownership, or identity-authority decision.",
    ],
    internalReferenceId: null,
    providerReferenceId: null,
  };
}

function deriveTenantPortableAttestations(params: {
  context: TenantTrustContext;
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  generatedAt: string;
  consentGranted: boolean;
  consentExpiresAt: string | null;
}): PortableAttestation[] {
  const portableAudience = toPortableAudience(params.audience);
  const portablePurpose = toPortablePurpose(params.purpose);
  const consentId = params.consentGranted
    ? consentIdFor({
        tenantId: params.context.tenantId,
        audience: params.audience,
        purpose: params.purpose,
        generatedAt: params.generatedAt,
      })
    : null;
  const consentGrantedAt = params.consentGranted ? params.generatedAt : null;
  const attestations: PortableAttestation[] = [
    baseAttestation({
      attestationId: "tenant_trust:identity_assurance",
      claimCategory: "identity_assurance",
      claimLabel: "Identity assurance metadata available",
      claimDescription: `Tenant identity profile status: ${params.context.identity.identityStatus}; verification level: ${params.context.identity.verification.level}.`,
      sourceCategory: "tenant_identity_record",
      audience: portableAudience,
      purpose: portablePurpose,
      generatedAt: params.generatedAt,
      consentId,
      consentGrantedAt,
      consentExpiresAt: params.consentExpiresAt,
      confidence: params.context.identity.verification.level === "strong" ? "high" : "medium",
    }),
    baseAttestation({
      attestationId: "tenant_trust:tenant_portability",
      claimCategory: "tenant_portability",
      claimLabel: "Tenant portability metadata available",
      claimDescription: `Portability status: ${params.context.portableIdentity.portabilityStatus}. Reusable across applications: ${
        params.context.portableIdentity.reusableAcrossApplications ? "yes" : "not yet"
      }.`,
      sourceCategory: "tenant_portability_summary",
      audience: portableAudience,
      purpose: portablePurpose,
      generatedAt: params.generatedAt,
      consentId,
      consentGrantedAt,
      consentExpiresAt: params.consentExpiresAt,
      confidence: params.context.portableIdentity.portabilityStatus === "ready" ? "high" : "medium",
    }),
  ];

  if (params.context.leaseSummary) {
    attestations.push(
      baseAttestation({
        attestationId: "tenant_trust:lease_participation",
        claimCategory: "lease_participation",
        claimLabel: "Lease participation metadata available",
        claimDescription: `Tenant lease summary status: ${params.context.leaseSummary.status || "not_available"}.`,
        sourceCategory: "tenant_lease_summary",
        audience: portableAudience,
        purpose: portablePurpose,
        generatedAt: params.generatedAt,
        consentId,
        consentGrantedAt,
        consentExpiresAt: params.consentExpiresAt,
      })
    );
  }

  if (params.context.paymentReadiness) {
    attestations.push(
      baseAttestation({
        attestationId: "tenant_trust:payment_readiness",
        claimCategory: "payment_readiness",
        claimLabel: "Payment readiness metadata available",
        claimDescription: `Payment readiness status: ${params.context.paymentReadiness.readinessStatus}.`,
        sourceCategory: "payment_readiness_summary",
        audience: portableAudience,
        purpose: portablePurpose,
        generatedAt: params.generatedAt,
        consentId,
        consentGrantedAt,
        consentExpiresAt: params.consentExpiresAt,
        confidence: "low",
      })
    );
  }

  return attestations;
}

function buildConsentState(params: {
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  generatedAt: string;
  expiresAt: string | null;
  consentGranted: boolean;
  tenantId: string;
  claimCategories: PortableAttestationClaimCategory[];
}): TenantTrustExportConsentState {
  return {
    required: true,
    granted: params.consentGranted,
    consentId: params.consentGranted
      ? consentIdFor({
          tenantId: params.tenantId,
          audience: params.audience,
          purpose: params.purpose,
          generatedAt: params.generatedAt,
        })
      : null,
    consentVersion: CONSENT_VERSION,
    grantedAt: params.consentGranted ? params.generatedAt : null,
    expiresAt: params.expiresAt,
    revokedAt: null,
    audience: params.audience,
    purpose: params.purpose,
    claimCategories: params.claimCategories,
    summary:
      "Tenant consent is required before RentChain prepares this non-public, metadata-only trust export package.",
  };
}

function tenantPreviewFromPackage(params: {
  exportId: string | null;
  tenantId: string;
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  generatedAt: string;
  expiresAt: string | null;
  consentGranted: boolean;
  package: InstitutionalTrustExportPackage;
}): TenantTrustExportPreview {
  const includedClaims = params.package.exportSummaries.map((summary) => ({
    attestationId: summary.attestationId,
    claimCategory: summary.claimCategory,
    claimLabel: summary.claimLabel,
    lifecycleState: summary.lifecycleState,
    consentExpiresAt: summary.consentExpiresAt,
  }));
  const summaryIds = new Set(includedClaims.map((claim) => claim.attestationId));
  const decisionsByAttestation = new Map(
    params.package.policyDecisions.map((decision) => [decision.attestationId, decision])
  );
  const excludedClaims = Array.from(decisionsByAttestation.entries())
    .filter(([attestationId]) => !summaryIds.has(attestationId))
    .map(([attestationId, decision]) => ({
      attestationId,
      claimCategory: "tenant_portability" as PortableAttestationClaimCategory,
      claimLabel: attestationId.replace(/^tenant_trust:/, "").replace(/_/g, " "),
      reasons: decision.reasons,
    }));
  const lifecycle: TenantTrustExportLifecycle =
    params.package.status === "export_ready"
      ? params.consentGranted
        ? "preview"
        : "consent_required"
      : params.consentGranted
      ? "blocked"
      : "consent_required";
  const claimCategories = Array.from(
    new Set([
      ...includedClaims.map((claim) => claim.claimCategory),
      ...excludedClaims.map((claim) => claim.claimCategory),
    ])
  );

  return {
    exportId: params.exportId,
    schemaVersion: "tenant_trust_export.v1",
    audience: params.audience,
    purpose: params.purpose,
    lifecycle,
    consent: buildConsentState({
      audience: params.audience,
      purpose: params.purpose,
      generatedAt: params.generatedAt,
      expiresAt: params.expiresAt,
      consentGranted: params.consentGranted,
      tenantId: params.tenantId,
      claimCategories,
    }),
    expiresAt: params.expiresAt,
    revokedAt: null,
    supersededAt: null,
    supersededByExportId: null,
    archivedAt: null,
    replacedByExportId: null,
    invalidatedAt: null,
    generatedAt: params.generatedAt,
    lifecycleControl: lifecycleControl({
      state: lifecycle === "preview" ? "prepared" : "blocked",
      reason: lifecycle === "preview" ? "export_active" : "policy_gate_blocked",
      evaluatedAt: params.generatedAt,
      record: {
        expiresAt: params.expiresAt,
        revokedAt: null,
        supersededAt: null,
        supersededByExportId: null,
        archivedAt: null,
        replacedByExportId: null,
        invalidatedAt: null,
        package: params.package,
      },
    }),
    lifecycleEvents: [],
    metadataOnly: true,
    publicAccessEnabled: false,
    downloadEnabled: lifecycle === "preview",
    externalSubmissionEnabled: false,
    policyGated: true,
    package: params.package,
    includedClaims,
    excludedClaims,
    redactions: [
      "Raw identity documents are excluded.",
      "Raw provider payloads are excluded.",
      "Support/internal metadata is excluded.",
      "Public exposure and external submission are disabled.",
    ],
    disclaimers: [
      "This export is prepared for tenant review and manual use only.",
      "No institution receives this package automatically.",
      "Revocation affects RentChain-controlled state and future preparation, not files already downloaded.",
      "Expired, revoked, superseded, archived, or reverification-required exports are not active or shareable.",
      "This package is not a credit, insurance, subsidy, ownership, or automated eligibility decision.",
    ],
  };
}

async function buildTenantTrustExportPreview(params: {
  tenantId: string;
  audience?: unknown;
  purpose?: unknown;
  expiresInDays?: unknown;
  consentAccepted?: boolean;
  exportId?: string | null;
}): Promise<TenantTrustExportPreview | null> {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return null;
  const context = await resolveTenantTrustContext(tenantId);
  if (!context) return null;

  const audience = sanitizeAudience(params.audience);
  const purpose = sanitizePurpose(params.purpose, audience);
  const generatedAt = nowIso();
  const expiresAt = addDaysIso(generatedAt, clampExpiresInDays(params.expiresInDays));
  const consentGranted = params.consentAccepted === true;
  const attestations = deriveTenantPortableAttestations({
    context,
    audience,
    purpose,
    generatedAt,
    consentGranted,
    consentExpiresAt: expiresAt,
  });
  const institutionalPackage = deriveInstitutionalTrustExportPackage({
    exportId:
      params.exportId ||
      exportIdFor({
        tenantId,
        audience,
        purpose,
        generatedAt,
      }),
    audience: toInstitutionalAudience(audience),
    purpose: toInstitutionalPurpose(purpose),
    generatedAt,
    attestations,
  });

  return tenantPreviewFromPackage({
    exportId: params.exportId || null,
    tenantId,
    audience,
    purpose,
    generatedAt,
    expiresAt,
    consentGranted,
    package: institutionalPackage,
  });
}

function asRecord(id: string, data: any): TenantTrustExportStoredRecord {
  const base = {
    ...(data || {}),
    exportId: id,
    supersededAt: asString(data?.supersededAt),
    supersededByExportId: asString(data?.supersededByExportId),
    archivedAt: asString(data?.archivedAt),
    replacedByExportId: asString(data?.replacedByExportId),
    invalidatedAt: asString(data?.invalidatedAt),
    lifecycleEvents: Array.isArray(data?.lifecycleEvents) ? data.lifecycleEvents : [],
    downloadEnabled: data?.downloadEnabled === true,
  } as TenantTrustExportStoredRecord;
  const decision = evaluateStoredExportLifecycle(base);
  const eventType = lifecycleEventTypeForDecision(decision.state, decision.reason);
  const lifecycleEvents =
    eventType && !(base.lifecycleEvents || []).some((event) => event.eventType === eventType && event.reason === decision.reason)
      ? [
          ...(base.lifecycleEvents || []),
          lifecycleEvent({
            eventType,
            occurredAt: decision.invalidatedAt || nowIso(),
            reason: decision.reason,
          }),
        ].slice(-50)
      : base.lifecycleEvents || [];
  return {
    ...base,
    lifecycle: decision.state,
    invalidatedAt: base.invalidatedAt || decision.invalidatedAt,
    lifecycleEvents,
    lifecycleControl: lifecycleControl({
      state: decision.state,
      reason: decision.reason,
      evaluatedAt: nowIso(),
      record: {
        ...base,
        invalidatedAt: base.invalidatedAt || decision.invalidatedAt,
      },
    }),
    downloadEnabled: decision.state === "prepared",
  } as TenantTrustExportStoredRecord;
}

function publicRecord(record: TenantTrustExportStoredRecord): TenantTrustExportRecord {
  const { tenantId: _tenantId, ...rest } = record;
  return rest;
}

async function supersedeActiveTenantTrustExports(params: {
  tenantId: string;
  audience: TenantTrustExportAudience;
  purpose: TenantTrustExportPurpose;
  replacementExportId: string;
  occurredAt: string;
}) {
  const snap = await db.collection(COLLECTION).where("tenantId", "==", params.tenantId).limit(50).get();
  await Promise.all(
    (snap.docs || []).map(async (doc: any) => {
      const current = asRecord(String(doc.id || ""), doc.data?.() || {});
      if (
        current.exportId === params.replacementExportId ||
        current.audience !== params.audience ||
        current.purpose !== params.purpose ||
        current.lifecycle !== "prepared"
      ) {
        return;
      }
      const events = [
        ...(Array.isArray(current.lifecycleEvents) ? current.lifecycleEvents : []),
        lifecycleEvent({
          eventType: "trust_export_superseded",
          occurredAt: params.occurredAt,
          reason: "export_superseded",
        }),
        lifecycleEvent({
          eventType: "trust_export_replaced",
          occurredAt: params.occurredAt,
          reason: "export_replaced",
        }),
      ].slice(-50);
      const nextControl = lifecycleControl({
        state: "superseded",
        reason: "export_superseded",
        evaluatedAt: params.occurredAt,
        record: {
          ...current,
          supersededAt: params.occurredAt,
          supersededByExportId: params.replacementExportId,
          replacedByExportId: params.replacementExportId,
        },
        supersededByExportId: params.replacementExportId,
        replacedByExportId: params.replacementExportId,
        invalidatedAt: params.occurredAt,
      });
      await db.collection(COLLECTION).doc(current.exportId).set(
        {
          lifecycle: "superseded",
          supersededAt: params.occurredAt,
          supersededByExportId: params.replacementExportId,
          replacedByExportId: params.replacementExportId,
          invalidatedAt: params.occurredAt,
          updatedAt: params.occurredAt,
          downloadEnabled: false,
          lifecycleControl: nextControl,
          lifecycleEvents: events,
        },
        { merge: true }
      );
    })
  );
}

export async function previewTenantTrustExport(params: {
  tenantId: string;
  audience?: unknown;
  purpose?: unknown;
  expiresInDays?: unknown;
  consentAccepted?: boolean;
}) {
  return buildTenantTrustExportPreview(params);
}

export async function prepareTenantTrustExport(params: {
  tenantId: string;
  audience?: unknown;
  purpose?: unknown;
  expiresInDays?: unknown;
  consentAccepted?: boolean;
}) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return null;
  if (params.consentAccepted !== true) {
    throw new Error("tenant_trust_export_consent_required");
  }
  const audience = sanitizeAudience(params.audience);
  const purpose = sanitizePurpose(params.purpose, audience);
  const generatedAt = nowIso();
  const exportId = exportIdFor({ tenantId, audience, purpose, generatedAt });
  const preview = await buildTenantTrustExportPreview({
    tenantId,
    audience,
    purpose,
    expiresInDays: params.expiresInDays,
    consentAccepted: true,
    exportId,
  });
  if (!preview) return null;

  await supersedeActiveTenantTrustExports({
    tenantId,
    audience,
    purpose,
    replacementExportId: exportId,
    occurredAt: generatedAt,
  });

  const initialLifecycle: TenantTrustExportRecord["lifecycle"] =
    preview.package.status === "export_ready" ? "prepared" : "blocked";
  const initialReason: TrustExportLifecycleReason =
    initialLifecycle === "prepared" ? "export_active" : "policy_gate_blocked";
  const record: TenantTrustExportStoredRecord = {
    ...preview,
    exportId,
    tenantId,
    lifecycle: initialLifecycle,
    lifecycleControl: lifecycleControl({
      state: initialLifecycle,
      reason: initialReason,
      evaluatedAt: generatedAt,
      record: {
        ...preview,
        exportId,
        lifecycle: initialLifecycle,
      },
    }),
    lifecycleEvents: [
      lifecycleEvent({
        eventType: "trust_export_prepared",
        occurredAt: generatedAt,
        reason: initialReason,
        actorType: "tenant",
      }),
    ],
    downloadEnabled: initialLifecycle === "prepared",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };
  await db.collection(COLLECTION).doc(exportId).set(record);
  return publicRecord(record);
}

export async function listTenantTrustExports(params: { tenantId: string }) {
  const tenantId = asString(params.tenantId);
  if (!tenantId) return [];
  const snap = await db.collection(COLLECTION).where("tenantId", "==", tenantId).limit(25).get();
  return (snap.docs || [])
    .map((doc: any) => asRecord(String(doc.id || ""), doc.data?.() || {}))
    .map(publicRecord)
    .sort((left, right) => Date.parse(right.createdAt || right.generatedAt) - Date.parse(left.createdAt || left.generatedAt));
}

export async function revokeTenantTrustExport(params: { tenantId: string; exportId: string }) {
  const tenantId = asString(params.tenantId);
  const exportId = asString(params.exportId);
  if (!tenantId || !exportId) return null;
  const ref = db.collection(COLLECTION).doc(exportId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = asRecord(exportId, snap.data?.() || {});
  if (current.tenantId !== tenantId) return false;
  const updatedAt = nowIso();
  const lifecycleEvents = [
    ...(Array.isArray(current.lifecycleEvents) ? current.lifecycleEvents : []),
    lifecycleEvent({
      eventType: "trust_export_revoked",
      occurredAt: updatedAt,
      reason: "export_revoked",
      actorType: "tenant",
    }),
  ].slice(-50);
  const nextControl = lifecycleControl({
    state: "revoked",
    reason: "export_revoked",
    evaluatedAt: updatedAt,
    record: {
      ...current,
      revokedAt: updatedAt,
      invalidatedAt: updatedAt,
    },
    invalidatedAt: updatedAt,
  });
  await ref.set(
    {
      lifecycle: "revoked",
      revokedAt: updatedAt,
      invalidatedAt: updatedAt,
      updatedAt,
      downloadEnabled: false,
      lifecycleControl: nextControl,
      lifecycleEvents,
      consent: {
        ...current.consent,
        granted: false,
        revokedAt: updatedAt,
      },
    },
    { merge: true }
  );
  return publicRecord({
    ...current,
    lifecycle: "revoked" as const,
    revokedAt: updatedAt,
    invalidatedAt: updatedAt,
    updatedAt,
    downloadEnabled: false,
    lifecycleControl: nextControl,
    lifecycleEvents,
    consent: {
      ...current.consent,
      granted: false,
      revokedAt: updatedAt,
    },
  });
}

export async function archiveTenantTrustExport(params: { tenantId: string; exportId: string }) {
  const tenantId = asString(params.tenantId);
  const exportId = asString(params.exportId);
  if (!tenantId || !exportId) return null;
  const ref = db.collection(COLLECTION).doc(exportId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const current = asRecord(exportId, snap.data?.() || {});
  if (current.tenantId !== tenantId) return false;
  const archivedAt = nowIso();
  const lifecycleEvents = [
    ...(Array.isArray(current.lifecycleEvents) ? current.lifecycleEvents : []),
    lifecycleEvent({
      eventType: "trust_export_archived",
      occurredAt: archivedAt,
      reason: "export_archived",
      actorType: "tenant",
    }),
  ].slice(-50);
  const nextControl = lifecycleControl({
    state: "archived",
    reason: "export_archived",
    evaluatedAt: archivedAt,
    record: {
      ...current,
      archivedAt,
      invalidatedAt: archivedAt,
    },
    invalidatedAt: archivedAt,
  });
  await ref.set(
    {
      lifecycle: "archived",
      archivedAt,
      invalidatedAt: archivedAt,
      updatedAt: archivedAt,
      downloadEnabled: false,
      lifecycleControl: nextControl,
      lifecycleEvents,
    },
    { merge: true }
  );
  return publicRecord({
    ...current,
    lifecycle: "archived" as const,
    archivedAt,
    invalidatedAt: archivedAt,
    updatedAt: archivedAt,
    downloadEnabled: false,
    lifecycleControl: nextControl,
    lifecycleEvents,
  });
}
