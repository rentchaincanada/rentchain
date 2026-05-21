import type { RequestAuthority, RequestAuthorityRole } from "../../auth/requestAuthority";

export const ADMIN_SUPPORT_ACCESS_GOVERNANCE_VERSION = "admin_support_access_governance_v1";

export type PrivilegedAccessMode =
  | "denied"
  | "landlord_operational"
  | "admin_global_review"
  | "admin_scoped_review"
  | "support_scoped_diagnostic";

export type PrivilegedAccessVisibilityClass = "landlord_operational" | "admin_support_internal";

export type PrivilegedAccessResourceType =
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
  | "admin_route"
  | "support_diagnostic";

export type PrivilegedAccessResourceRef = {
  resourceType: PrivilegedAccessResourceType;
  resourceId: string;
  label: string;
  landlordId: string | null;
  tenantId: string | null;
  internalReference: true;
};

export type PrivilegedAccessContext = {
  governanceVersion: typeof ADMIN_SUPPORT_ACCESS_GOVERNANCE_VERSION;
  actorId: string | null;
  actorRole: RequestAuthorityRole;
  accessMode: PrivilegedAccessMode;
  visibilityClass: PrivilegedAccessVisibilityClass;
  effectiveLandlordId: string | null;
  effectiveTenantId: string | null;
  requestedLandlordId: string | null;
  requestedTenantId: string | null;
  tenantVisible: false;
  crossLandlordVisibilityEnabled: false;
  impersonationEnabled: false;
  autonomousEscalationEnabled: false;
  financialMutationEnabled: false;
  requiresAuditEvent: true;
  warnings: string[];
  errors: string[];
};

export type PrivilegedAccessAuditRef = {
  governanceVersion: typeof ADMIN_SUPPORT_ACCESS_GOVERNANCE_VERSION;
  auditRefId: string;
  action: string;
  actorId: string | null;
  actorRole: RequestAuthorityRole;
  accessMode: PrivilegedAccessMode;
  visibilityClass: PrivilegedAccessVisibilityClass;
  resourceRefs: PrivilegedAccessResourceRef[];
  evidenceRefs: PrivilegedAccessResourceRef[];
  occurredAt: string;
  summary: string;
  tenantVisible: false;
  metadataOnly: true;
  supportSafe: true;
  sensitivePayloadIncluded: false;
  restrictedPayloadIncluded: false;
  autonomousEscalationEnabled: false;
};

const VALID_RESOURCE_TYPES = new Set<PrivilegedAccessResourceType>([
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
  "admin_route",
  "support_diagnostic",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function safeText(value: unknown, max = 500): string {
  return asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function cleanMode(value: unknown): PrivilegedAccessMode | null {
  const normalized = asString(value, 80).toLowerCase().replace(/[\s.-]+/g, "_");
  if (
    normalized === "denied" ||
    normalized === "landlord_operational" ||
    normalized === "admin_global_review" ||
    normalized === "admin_scoped_review" ||
    normalized === "support_scoped_diagnostic"
  ) {
    return normalized;
  }
  return null;
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const parsed = Date.parse(asString(value, 120));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
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

export function classifyAdminSupportScope(params: {
  authority: Pick<
    RequestAuthority,
    "actorId" | "actorRole" | "effectiveLandlordId" | "effectiveTenantId" | "isAdmin" | "isSupport" | "isLandlord" | "isTenant" | "warnings" | "errors"
  >;
  requestedLandlordId?: string | null;
  requestedTenantId?: string | null;
  requestedMode?: PrivilegedAccessMode | string | null;
  hasSystemAdminPermission?: boolean | null;
}): PrivilegedAccessContext {
  const authority = params.authority;
  const requestedLandlordId = asString(params.requestedLandlordId, 240) || null;
  const requestedTenantId = asString(params.requestedTenantId, 240) || null;
  const warnings = [...(authority.warnings || [])];
  const errors = [...(authority.errors || [])];
  const requestedMode = cleanMode(params.requestedMode);
  const effectiveLandlordId = authority.effectiveLandlordId || null;
  const effectiveTenantId = authority.effectiveTenantId || null;

  let accessMode: PrivilegedAccessMode = "denied";
  let visibilityClass: PrivilegedAccessVisibilityClass = "admin_support_internal";

  if (authority.isTenant) {
    errors.push("tenant_cannot_use_privileged_access");
  } else if (authority.isLandlord && effectiveLandlordId) {
    accessMode = "landlord_operational";
    visibilityClass = "landlord_operational";
    if (requestedLandlordId && requestedLandlordId !== effectiveLandlordId) errors.push("landlord_scope_mismatch");
  } else if (authority.isAdmin) {
    if (requestedLandlordId) accessMode = "admin_scoped_review";
    else if (params.hasSystemAdminPermission || requestedMode === "admin_global_review") accessMode = "admin_global_review";
    else {
      accessMode = "denied";
      errors.push("admin_scope_required");
    }
  } else if (authority.isSupport) {
    if (requestedLandlordId) accessMode = "support_scoped_diagnostic";
    else {
      accessMode = "denied";
      errors.push("support_scope_required");
    }
  } else {
    errors.push("privileged_role_required");
  }

  if (requestedTenantId && !requestedLandlordId && (authority.isAdmin || authority.isSupport)) {
    warnings.push("tenant_scope_without_landlord_scope");
  }

  return {
    governanceVersion: ADMIN_SUPPORT_ACCESS_GOVERNANCE_VERSION,
    actorId: authority.actorId || null,
    actorRole: authority.actorRole,
    accessMode: errors.length ? "denied" : accessMode,
    visibilityClass,
    effectiveLandlordId,
    effectiveTenantId,
    requestedLandlordId,
    requestedTenantId,
    tenantVisible: false,
    crossLandlordVisibilityEnabled: false,
    impersonationEnabled: false,
    autonomousEscalationEnabled: false,
    financialMutationEnabled: false,
    requiresAuditEvent: true,
    warnings: uniqueSorted(warnings, (value) => value),
    errors: uniqueSorted(errors, (value) => value),
  };
}

export function normalizePrivilegedAccessResourceRefs(
  raw: unknown,
  scope: { landlordId?: string | null; tenantId?: string | null } = {}
): PrivilegedAccessResourceRef[] {
  if (!Array.isArray(raw)) return [];
  const landlordScope = asString(scope.landlordId, 240) || null;
  const tenantScope = asString(scope.tenantId, 240) || null;
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const resourceType = asString(data.resourceType || data.type, 80).toLowerCase() as PrivilegedAccessResourceType;
      const resourceId = asString(data.resourceId || data.id, 240);
      const landlordId = asString(data.landlordId, 240) || null;
      const tenantId = asString(data.tenantId, 240) || null;
      if (!VALID_RESOURCE_TYPES.has(resourceType) || !resourceId) return null;
      if (landlordScope && landlordId && landlordId !== landlordScope) return null;
      if (tenantScope && tenantId && tenantId !== tenantScope) return null;
      return {
        resourceType,
        resourceId,
        label: safeText(data.label, 160) || `${resourceType.replace(/_/g, " ")} reference`,
        landlordId,
        tenantId,
        internalReference: true,
      };
    })
    .filter(Boolean) as PrivilegedAccessResourceRef[];
  return uniqueSorted(refs, (ref) => `${ref.resourceType}:${ref.resourceId}`).slice(0, 32);
}

export function buildPrivilegedAccessAuditRef(params: {
  context: PrivilegedAccessContext;
  action: string;
  occurredAt?: string | Date | null;
  resourceRefs?: Array<Record<string, unknown>> | null;
  evidenceRefs?: Array<Record<string, unknown>> | null;
  summary?: string | null;
}): PrivilegedAccessAuditRef {
  const occurredAt = toIsoDate(params.occurredAt);
  const action = asString(params.action, 120).toLowerCase().replace(/[\s.-]+/g, "_") || "privileged_access_review";
  const scope = {
    landlordId: params.context.requestedLandlordId || params.context.effectiveLandlordId,
    tenantId: params.context.requestedTenantId || params.context.effectiveTenantId,
  };
  return {
    governanceVersion: ADMIN_SUPPORT_ACCESS_GOVERNANCE_VERSION,
    auditRefId:
      idPart(["privileged_access", params.context.actorId || "unknown", action, occurredAt].join(":")) ||
      "privileged_access:unknown",
    action,
    actorId: params.context.actorId,
    actorRole: params.context.actorRole,
    accessMode: params.context.accessMode,
    visibilityClass: params.context.visibilityClass,
    resourceRefs: normalizePrivilegedAccessResourceRefs(params.resourceRefs, scope),
    evidenceRefs: normalizePrivilegedAccessResourceRefs(params.evidenceRefs, scope),
    occurredAt,
    summary: safeText(params.summary, 300) || "Privileged access metadata prepared for manual audit review.",
    tenantVisible: false,
    metadataOnly: true,
    supportSafe: true,
    sensitivePayloadIncluded: false,
    restrictedPayloadIncluded: false,
    autonomousEscalationEnabled: false,
  };
}
