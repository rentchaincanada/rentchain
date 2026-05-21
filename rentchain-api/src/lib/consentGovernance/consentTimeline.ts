export const CONSENT_TIMELINE_VERSION = "consent_governance_timeline_v1";

export type ConsentTimelineType =
  | "screening_consent"
  | "reporting_consent"
  | "evidence_sharing_consent"
  | "tenant_trust_export_consent"
  | "institutional_export_consent"
  | "future_subsidy_coordination_consent"
  | "future_caseworker_coordination_consent";

export type ConsentTimelineState =
  | "requested"
  | "granted"
  | "active"
  | "expiring"
  | "expired"
  | "revoked"
  | "superseded"
  | "denied";

export type ConsentTimelineSensitivityClass = "sensitive" | "restricted";

export type ConsentTimelineAuthorityScope = {
  landlordId: string | null;
  tenantId: string | null;
  scopeType: "tenant" | "lease" | "application" | "screening_order" | "export" | "evidence" | "review" | "future_institution";
  scopeId: string | null;
  authorityBasis: string;
};

export type ConsentTimelineRef = {
  refType: "evidence" | "export" | "review" | "source";
  sourceCollection: string;
  sourceId: string;
  landlordId: string | null;
  tenantId: string | null;
  internalReference: true;
  tenantVisible: false;
};

export type ConsentTimeline = {
  consentTimelineVersion: typeof CONSENT_TIMELINE_VERSION;
  consentId: string;
  consentType: ConsentTimelineType;
  consentState: ConsentTimelineState;
  landlordId: string;
  tenantId: string | null;
  grantedAt: string | null;
  requestedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  supersededAt: string | null;
  deniedAt: string | null;
  grantedBy: string | null;
  requestedBy: string | null;
  authorityScope: ConsentTimelineAuthorityScope;
  evidenceRefs: ConsentTimelineRef[];
  exportRefs: ConsentTimelineRef[];
  reviewRefs: ConsentTimelineRef[];
  sourceRefs: ConsentTimelineRef[];
  revocationReason: string | null;
  timelineSummary: {
    lifecycleLabel: string;
    refCounts: {
      evidence: number;
      export: number;
      review: number;
      source: number;
    };
    expirationKnown: boolean;
    revocationKnown: boolean;
  };
  tenantVisible: boolean;
  metadataOnly: true;
  sensitivityClass: ConsentTimelineSensitivityClass;
  rawProviderPayloadIncluded: false;
  rawExportPayloadIncluded: false;
  rawEvidencePayloadIncluded: false;
  privilegedReviewInternalsIncluded: false;
  publicSharingEnabled: false;
  externalSubmissionEnabled: false;
  autonomousConsentActionsEnabled: false;
  legalSignatureEngineEnabled: false;
};

type RefInput = Record<string, unknown>;

const VALID_CONSENT_TYPES = new Set<ConsentTimelineType>([
  "screening_consent",
  "reporting_consent",
  "evidence_sharing_consent",
  "tenant_trust_export_consent",
  "institutional_export_consent",
  "future_subsidy_coordination_consent",
  "future_caseworker_coordination_consent",
]);

const VALID_CONSENT_STATES = new Set<ConsentTimelineState>([
  "requested",
  "granted",
  "active",
  "expiring",
  "expired",
  "revoked",
  "superseded",
  "denied",
]);

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 120).toLowerCase().replace(/[\s.-]+/g, "_");
}

function toIsoOrNull(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function toIso(value: unknown): string {
  return toIsoOrNull(value) || new Date(0).toISOString();
}

function timestampAtOrBefore(value: string | null, generatedAt: string) {
  if (!value) return false;
  const candidate = Date.parse(value);
  const now = Date.parse(generatedAt);
  return Number.isFinite(candidate) && Number.isFinite(now) && candidate <= now;
}

function timestampWithinDays(value: string | null, generatedAt: string, days: number) {
  if (!value) return false;
  const candidate = Date.parse(value);
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(candidate) || !Number.isFinite(now) || candidate <= now) return false;
  return candidate - now <= days * 24 * 60 * 60 * 1000;
}

function uniqueSortedRefs(refs: ConsentTimelineRef[]): ConsentTimelineRef[] {
  const byKey = new Map<string, ConsentTimelineRef>();
  for (const ref of refs) {
    byKey.set(`${ref.refType}:${ref.sourceCollection}:${ref.sourceId}`, ref);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.refType}:${a.sourceCollection}:${a.sourceId}`.localeCompare(
      `${b.refType}:${b.sourceCollection}:${b.sourceId}`,
    ),
  );
}

export function normalizeConsentType(value: unknown): ConsentTimelineType {
  const normalized = normalizeKey(value);
  return VALID_CONSENT_TYPES.has(normalized as ConsentTimelineType)
    ? (normalized as ConsentTimelineType)
    : "evidence_sharing_consent";
}

export function classifyConsentState(input: {
  consentState?: unknown;
  requestedAt?: unknown;
  grantedAt?: unknown;
  expiresAt?: unknown;
  revokedAt?: unknown;
  supersededAt?: unknown;
  deniedAt?: unknown;
  generatedAt?: unknown;
}): ConsentTimelineState {
  const generatedAt = toIso(input.generatedAt);
  const requestedAt = toIsoOrNull(input.requestedAt);
  const grantedAt = toIsoOrNull(input.grantedAt);
  const expiresAt = toIsoOrNull(input.expiresAt);
  const revokedAt = toIsoOrNull(input.revokedAt);
  const supersededAt = toIsoOrNull(input.supersededAt);
  const deniedAt = toIsoOrNull(input.deniedAt);
  const explicitState = normalizeKey(input.consentState);

  if (revokedAt || explicitState === "revoked") return "revoked";
  if (supersededAt || explicitState === "superseded") return "superseded";
  if (deniedAt || explicitState === "denied") return "denied";
  if (timestampAtOrBefore(expiresAt, generatedAt) || explicitState === "expired") return "expired";
  if (timestampWithinDays(expiresAt, generatedAt, 14) || explicitState === "expiring") return "expiring";
  if (grantedAt && (explicitState === "granted" || explicitState === "active" || !explicitState)) return "active";
  if (VALID_CONSENT_STATES.has(explicitState as ConsentTimelineState)) return explicitState as ConsentTimelineState;
  if (requestedAt) return "requested";
  return "requested";
}

export function normalizeConsentRefs(input: {
  refs?: RefInput[] | null;
  refType: ConsentTimelineRef["refType"];
  landlordId: string;
  tenantId?: string | null;
}): ConsentTimelineRef[] {
  const tenantScope = asString(input.tenantId) || null;
  const refs = (input.refs || [])
    .map((item) => {
      const sourceCollection = asString(item.sourceCollection || item.collection, 120);
      const sourceId = asString(item.sourceId || item.id || item.resourceId, 240);
      const landlordId = asString(item.landlordId) || input.landlordId;
      const tenantId = asString(item.tenantId) || null;
      if (!sourceCollection || !sourceId || landlordId !== input.landlordId) return null;
      if (tenantScope && tenantId && tenantId !== tenantScope) return null;
      return {
        refType: input.refType,
        sourceCollection,
        sourceId,
        landlordId,
        tenantId,
        internalReference: true,
        tenantVisible: false,
      };
    })
    .filter(Boolean) as ConsentTimelineRef[];
  return uniqueSortedRefs(refs);
}

export function buildConsentAuditRef(input: {
  sourceCollection: string;
  sourceId: string;
  landlordId: string;
  tenantId?: string | null;
  refType?: ConsentTimelineRef["refType"] | null;
}): ConsentTimelineRef {
  return {
    refType: input.refType || "source",
    sourceCollection: asString(input.sourceCollection, 120) || "unknown",
    sourceId: asString(input.sourceId, 240) || "unknown",
    landlordId: asString(input.landlordId, 240) || "unknown",
    tenantId: asString(input.tenantId, 240) || null,
    internalReference: true,
    tenantVisible: false,
  };
}

export function normalizeConsentTimeline(input: {
  consentId: string;
  consentType?: unknown;
  consentState?: unknown;
  landlordId: string;
  tenantId?: string | null;
  requestedAt?: unknown;
  grantedAt?: unknown;
  expiresAt?: unknown;
  revokedAt?: unknown;
  supersededAt?: unknown;
  deniedAt?: unknown;
  grantedBy?: string | null;
  requestedBy?: string | null;
  authorityScope?: Partial<ConsentTimelineAuthorityScope> | null;
  evidenceRefs?: RefInput[] | null;
  exportRefs?: RefInput[] | null;
  reviewRefs?: RefInput[] | null;
  sourceRefs?: RefInput[] | null;
  revocationReason?: string | null;
  tenantVisible?: boolean | null;
  sensitivityClass?: ConsentTimelineSensitivityClass | string | null;
  generatedAt?: unknown;
}): ConsentTimeline {
  const landlordId = asString(input.landlordId, 240);
  const tenantId = asString(input.tenantId, 240) || null;
  const consentType = normalizeConsentType(input.consentType);
  const consentState = classifyConsentState(input);
  const tenantVisible = input.tenantVisible === true;
  const evidenceRefs = normalizeConsentRefs({ refs: input.evidenceRefs, refType: "evidence", landlordId, tenantId });
  const exportRefs = normalizeConsentRefs({ refs: input.exportRefs, refType: "export", landlordId, tenantId });
  const reviewRefs = tenantVisible
    ? []
    : normalizeConsentRefs({ refs: input.reviewRefs, refType: "review", landlordId, tenantId });
  const sourceRefs = normalizeConsentRefs({ refs: input.sourceRefs, refType: "source", landlordId, tenantId });
  const authorityScope = input.authorityScope || {};
  const sensitivityClass = input.sensitivityClass === "sensitive" ? "sensitive" : "restricted";

  return {
    consentTimelineVersion: CONSENT_TIMELINE_VERSION,
    consentId: asString(input.consentId, 240) || "consent_unknown",
    consentType,
    consentState,
    landlordId,
    tenantId,
    grantedAt: toIsoOrNull(input.grantedAt),
    requestedAt: toIsoOrNull(input.requestedAt),
    expiresAt: toIsoOrNull(input.expiresAt),
    revokedAt: toIsoOrNull(input.revokedAt),
    supersededAt: toIsoOrNull(input.supersededAt),
    deniedAt: toIsoOrNull(input.deniedAt),
    grantedBy: asString(input.grantedBy, 240) || null,
    requestedBy: asString(input.requestedBy, 240) || null,
    authorityScope: {
      landlordId,
      tenantId,
      scopeType: authorityScope.scopeType || "tenant",
      scopeId: asString(authorityScope.scopeId, 240) || tenantId,
      authorityBasis: asString(authorityScope.authorityBasis, 240) || "server_resolved_scope",
    },
    evidenceRefs,
    exportRefs,
    reviewRefs,
    sourceRefs,
    revocationReason: asString(input.revocationReason, 500) || null,
    timelineSummary: {
      lifecycleLabel: consentState.replace(/_/g, " "),
      refCounts: {
        evidence: evidenceRefs.length,
        export: exportRefs.length,
        review: reviewRefs.length,
        source: sourceRefs.length,
      },
      expirationKnown: Boolean(toIsoOrNull(input.expiresAt)),
      revocationKnown: Boolean(toIsoOrNull(input.revokedAt)),
    },
    tenantVisible,
    metadataOnly: true,
    sensitivityClass,
    rawProviderPayloadIncluded: false,
    rawExportPayloadIncluded: false,
    rawEvidencePayloadIncluded: false,
    privilegedReviewInternalsIncluded: false,
    publicSharingEnabled: false,
    externalSubmissionEnabled: false,
    autonomousConsentActionsEnabled: false,
    legalSignatureEngineEnabled: false,
  };
}
