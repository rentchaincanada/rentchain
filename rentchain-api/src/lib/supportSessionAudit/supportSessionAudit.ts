import type { RequestAuthorityRole } from "../../auth/requestAuthority";

export const SUPPORT_SESSION_AUDIT_VERSION = "support_session_audit_v1";

export type SupportSessionState =
  | "requested"
  | "active"
  | "paused"
  | "ended"
  | "expired"
  | "revoked"
  | "denied";

export type SupportAccessReason =
  | "customer_support"
  | "incident_review"
  | "evidence_review"
  | "export_review"
  | "screening_review"
  | "billing_support"
  | "technical_diagnostics"
  | "security_investigation"
  | "compliance_review"
  | "other";

export type SupportSessionResourceType =
  | "landlord"
  | "tenant"
  | "lease"
  | "property"
  | "unit"
  | "payment"
  | "ledger_entry"
  | "evidence_pack"
  | "export_package"
  | "review_workspace"
  | "incident"
  | "api_route"
  | "document"
  | "screening_order"
  | "support_diagnostic";

export type SupportSessionResourceRef = {
  resourceType: SupportSessionResourceType;
  resourceId: string;
  label: string;
  landlordId: string | null;
  tenantId: string | null;
  internalReference: true;
};

export type SupportSessionAuditRef = {
  supportSessionAuditVersion: typeof SUPPORT_SESSION_AUDIT_VERSION;
  supportSessionAuditId: string;
  sessionId: string;
  sessionState: SupportSessionState;
  accessReason: SupportAccessReason;
  actorId: string | null;
  actorRole: RequestAuthorityRole;
  requestedBy: string | null;
  approvedBy: string | null;
  landlordId: string;
  tenantId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  occurredAt: string;
  resourceRefs: SupportSessionResourceRef[];
  evidenceRefs: SupportSessionResourceRef[];
  exportRefs: SupportSessionResourceRef[];
  incidentRefs: SupportSessionResourceRef[];
  reviewRefs: SupportSessionResourceRef[];
  summary: string;
  auditExpectation: "manual_append_only";
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  metadataOnly: true;
  appendCompatible: true;
  supportPowersGranted: false;
  impersonationEnabled: false;
  autonomousEscalationEnabled: false;
  financialMutationEnabled: false;
  payloadSafety: {
    sensitiveData: "excluded";
    restrictedData: "excluded";
    providerData: "reference_only";
    evidenceData: "reference_only";
    exportData: "reference_only";
    credentialData: "excluded";
    diagnosticData: "metadata_only";
  };
};

const VALID_STATES = new Set<SupportSessionState>([
  "requested",
  "active",
  "paused",
  "ended",
  "expired",
  "revoked",
  "denied",
]);

const VALID_REASONS = new Set<SupportAccessReason>([
  "customer_support",
  "incident_review",
  "evidence_review",
  "export_review",
  "screening_review",
  "billing_support",
  "technical_diagnostics",
  "security_investigation",
  "compliance_review",
  "other",
]);

const VALID_RESOURCE_TYPES = new Set<SupportSessionResourceType>([
  "landlord",
  "tenant",
  "lease",
  "property",
  "unit",
  "payment",
  "ledger_entry",
  "evidence_pack",
  "export_package",
  "review_workspace",
  "incident",
  "api_route",
  "document",
  "screening_order",
  "support_diagnostic",
]);

const VALID_ACTOR_ROLES = new Set<RequestAuthorityRole>([
  "admin",
  "landlord",
  "tenant",
  "operator",
  "contractor",
  "support",
  "unknown",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function safeText(value: unknown, max = 500): string {
  return asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value: unknown): string {
  return asString(value, 120).toLowerCase().replace(/[\s.-]+/g, "_");
}

function normalizeActorRole(value: unknown): RequestAuthorityRole {
  const normalized = normalizeKey(value) as RequestAuthorityRole;
  return VALID_ACTOR_ROLES.has(normalized) ? normalized : "unknown";
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

function idPart(value: unknown): string {
  return asString(value, 240)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueSorted<T>(values: T[], key: (value: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const value of values) {
    const nextKey = key(value);
    if (nextKey && !byKey.has(nextKey)) byKey.set(nextKey, value);
  }
  return Array.from(byKey.values()).sort((a, b) => key(a).localeCompare(key(b)));
}

export function normalizeSupportSessionState(value: unknown): SupportSessionState {
  const normalized = normalizeKey(value);
  return VALID_STATES.has(normalized as SupportSessionState)
    ? (normalized as SupportSessionState)
    : "requested";
}

export function normalizeSupportAccessReason(value: unknown): SupportAccessReason {
  const normalized = normalizeKey(value);
  return VALID_REASONS.has(normalized as SupportAccessReason)
    ? (normalized as SupportAccessReason)
    : "other";
}

export function normalizeSupportSessionResourceRefs(
  raw: unknown,
  scope: { landlordId: string; tenantId?: string | null }
): SupportSessionResourceRef[] {
  if (!Array.isArray(raw)) return [];
  const landlordScope = asString(scope.landlordId, 240);
  const tenantScope = asString(scope.tenantId, 240) || null;
  if (!landlordScope) return [];

  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const resourceType = normalizeKey(data.resourceType || data.type) as SupportSessionResourceType;
      const resourceId = asString(data.resourceId || data.id || data.sourceId, 240);
      const landlordId = asString(data.landlordId, 240) || null;
      const tenantId = asString(data.tenantId, 240) || null;
      if (!VALID_RESOURCE_TYPES.has(resourceType) || !resourceId) return null;
      if (landlordId && landlordId !== landlordScope) return null;
      if (tenantScope && tenantId && tenantId !== tenantScope) return null;
      return {
        resourceType,
        resourceId,
        label: safeText(data.label, 160) || `${resourceType.replace(/_/g, " ")} reference`,
        landlordId: landlordId || landlordScope,
        tenantId,
        internalReference: true,
      };
    })
    .filter(Boolean) as SupportSessionResourceRef[];
  return uniqueSorted(refs, (ref) => `${ref.resourceType}:${ref.resourceId}`).slice(0, 32);
}

export function buildSupportSessionAuditRef(input: {
  sessionId: string;
  sessionState?: unknown;
  accessReason?: unknown;
  actorId?: string | null;
  actorRole?: RequestAuthorityRole | string | null;
  requestedBy?: string | null;
  approvedBy?: string | null;
  landlordId: string;
  tenantId?: string | null;
  startedAt?: unknown;
  endedAt?: unknown;
  occurredAt?: unknown;
  resourceRefs?: Array<Record<string, unknown>> | null;
  evidenceRefs?: Array<Record<string, unknown>> | null;
  exportRefs?: Array<Record<string, unknown>> | null;
  incidentRefs?: Array<Record<string, unknown>> | null;
  reviewRefs?: Array<Record<string, unknown>> | null;
  summary?: string | null;
}): SupportSessionAuditRef {
  const landlordId = asString(input.landlordId, 240);
  const tenantId = asString(input.tenantId, 240) || null;
  const sessionId = idPart(input.sessionId) || "support_session_unknown";
  const sessionState = normalizeSupportSessionState(input.sessionState);
  const accessReason = normalizeSupportAccessReason(input.accessReason);
  const occurredAt = toIso(input.occurredAt);
  const scope = { landlordId, tenantId };

  return {
    supportSessionAuditVersion: SUPPORT_SESSION_AUDIT_VERSION,
    supportSessionAuditId:
      idPart(["support_session_audit", sessionId, sessionState, accessReason, occurredAt].join(":")) ||
      "support_session_audit:unknown",
    sessionId,
    sessionState,
    accessReason,
    actorId: asString(input.actorId, 240) || null,
    actorRole: normalizeActorRole(input.actorRole),
    requestedBy: asString(input.requestedBy, 240) || null,
    approvedBy: asString(input.approvedBy, 240) || null,
    landlordId,
    tenantId,
    startedAt: toIsoOrNull(input.startedAt),
    endedAt: toIsoOrNull(input.endedAt),
    occurredAt,
    resourceRefs: normalizeSupportSessionResourceRefs(input.resourceRefs, scope),
    evidenceRefs: normalizeSupportSessionResourceRefs(input.evidenceRefs, scope),
    exportRefs: normalizeSupportSessionResourceRefs(input.exportRefs, scope),
    incidentRefs: normalizeSupportSessionResourceRefs(input.incidentRefs, scope),
    reviewRefs: normalizeSupportSessionResourceRefs(input.reviewRefs, scope),
    summary:
      safeText(input.summary, 300) ||
      "Support session audit metadata prepared for manual append-only review.",
    auditExpectation: "manual_append_only",
    visibilityClass: "admin_support_internal",
    tenantVisible: false,
    metadataOnly: true,
    appendCompatible: true,
    supportPowersGranted: false,
    impersonationEnabled: false,
    autonomousEscalationEnabled: false,
    financialMutationEnabled: false,
    payloadSafety: {
      sensitiveData: "excluded",
      restrictedData: "excluded",
      providerData: "reference_only",
      evidenceData: "reference_only",
      exportData: "reference_only",
      credentialData: "excluded",
      diagnosticData: "metadata_only",
    },
  };
}
