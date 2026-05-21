export const SECURITY_INCIDENT_GOVERNANCE_VERSION = "security_incident_governance_v1";

export type SecurityIncidentCategory =
  | "auth_session"
  | "credential_secret"
  | "api_abuse"
  | "document_upload"
  | "malware_suspected"
  | "export_projection"
  | "evidence_access"
  | "tenant_data_exposure"
  | "admin_support_access"
  | "webhook_provider"
  | "dependency_supply_chain"
  | "infrastructure_deployment"
  | "suspicious_activity";

export type SecurityIncidentSeverity = "informational" | "low" | "medium" | "high" | "critical";

export type SecurityIncidentResponseState =
  | "observed"
  | "triaged"
  | "investigating"
  | "contained"
  | "remediated"
  | "closed"
  | "false_positive";

export type SecurityIncidentResourceType =
  | "landlord"
  | "tenant"
  | "lease"
  | "property"
  | "unit"
  | "payment"
  | "ledger_entry"
  | "evidence_pack"
  | "document"
  | "export_package"
  | "webhook"
  | "api_route"
  | "credential"
  | "deployment"
  | "dependency"
  | "review_workspace";

export type SecurityIncidentAffectedResourceRef = {
  resourceType: SecurityIncidentResourceType;
  resourceId: string;
  label: string;
  landlordId: string | null;
  tenantId: string | null;
  internalReference: true;
};

export type SecurityIncidentEvidenceLink = {
  evidenceId: string;
  label: string;
  sourceCollection: string | null;
  sourceId: string | null;
  sensitivityClass: "sensitive" | "restricted" | "critical";
  internalReference: true;
};

export type SecurityIncidentReference = {
  incidentGovernanceVersion: typeof SECURITY_INCIDENT_GOVERNANCE_VERSION;
  incidentId: string;
  category: SecurityIncidentCategory;
  severity: SecurityIncidentSeverity;
  responseState: SecurityIncidentResponseState;
  title: string;
  summary: string;
  detectedAt: string;
  updatedAt: string;
  affectedResources: SecurityIncidentAffectedResourceRef[];
  evidenceLinks: SecurityIncidentEvidenceLink[];
  auditExpectation: "manual_append_only";
  visibilityClass: "internal_security" | "admin_support";
  sensitivityClass: "sensitive" | "restricted" | "critical";
  manualOnly: true;
  autonomousRemediationEnabled: false;
  tokenRevocationAutomated: false;
  credentialRotationAutomated: false;
  accountLockAutomated: false;
  tenantVisible: false;
  externalAlertingEnabled: false;
  redactionSummary: string;
};

const VALID_CATEGORIES = new Set<SecurityIncidentCategory>([
  "auth_session",
  "credential_secret",
  "api_abuse",
  "document_upload",
  "malware_suspected",
  "export_projection",
  "evidence_access",
  "tenant_data_exposure",
  "admin_support_access",
  "webhook_provider",
  "dependency_supply_chain",
  "infrastructure_deployment",
  "suspicious_activity",
]);

const VALID_SEVERITIES = new Set<SecurityIncidentSeverity>(["informational", "low", "medium", "high", "critical"]);
const VALID_STATES = new Set<SecurityIncidentResponseState>([
  "observed",
  "triaged",
  "investigating",
  "contained",
  "remediated",
  "closed",
  "false_positive",
]);
const VALID_RESOURCE_TYPES = new Set<SecurityIncidentResourceType>([
  "landlord",
  "tenant",
  "lease",
  "property",
  "unit",
  "payment",
  "ledger_entry",
  "evidence_pack",
  "document",
  "export_package",
  "webhook",
  "api_route",
  "credential",
  "deployment",
  "dependency",
  "review_workspace",
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

function toIsoDate(value: unknown, fallback: Date): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const raw = asString(value, 120);
  if (!raw) return fallback.toISOString();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback.toISOString();
}

function safeIdPart(value: unknown): string {
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

export function normalizeSecurityIncidentCategory(value: unknown): SecurityIncidentCategory {
  const normalized = normalizeKey(value);
  return VALID_CATEGORIES.has(normalized as SecurityIncidentCategory)
    ? (normalized as SecurityIncidentCategory)
    : "suspicious_activity";
}

export function normalizeSecurityIncidentSeverity(value: unknown): SecurityIncidentSeverity {
  const normalized = normalizeKey(value);
  return VALID_SEVERITIES.has(normalized as SecurityIncidentSeverity)
    ? (normalized as SecurityIncidentSeverity)
    : "medium";
}

export function normalizeSecurityIncidentResponseState(value: unknown): SecurityIncidentResponseState {
  const normalized = normalizeKey(value);
  return VALID_STATES.has(normalized as SecurityIncidentResponseState)
    ? (normalized as SecurityIncidentResponseState)
    : "observed";
}

export function classifySecurityIncidentSeverity(input: {
  category: SecurityIncidentCategory | string;
  confirmedExposure?: boolean | null;
  productionImpact?: boolean | null;
  tenantDataInvolved?: boolean | null;
}): SecurityIncidentSeverity {
  const category = normalizeSecurityIncidentCategory(input.category);
  if (input.confirmedExposure && (category === "credential_secret" || category === "tenant_data_exposure")) {
    return "critical";
  }
  if (input.productionImpact && (category === "infrastructure_deployment" || category === "api_abuse")) {
    return "high";
  }
  if (input.tenantDataInvolved && (category === "export_projection" || category === "evidence_access")) {
    return "high";
  }

  if (category === "credential_secret" || category === "malware_suspected" || category === "tenant_data_exposure") {
    return "high";
  }
  if (category === "api_abuse" || category === "webhook_provider" || category === "admin_support_access") {
    return "medium";
  }
  if (category === "document_upload" || category === "dependency_supply_chain") {
    return "medium";
  }
  if (category === "infrastructure_deployment" || category === "suspicious_activity") {
    return "low";
  }
  return "low";
}

export function normalizeSecurityIncidentAffectedResources(
  raw: unknown,
  scope: { landlordId?: string | null; tenantId?: string | null } = {}
): SecurityIncidentAffectedResourceRef[] {
  if (!Array.isArray(raw)) return [];
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const resourceType = normalizeKey(data.resourceType || data.type) as SecurityIncidentResourceType;
      const resourceId = asString(data.resourceId || data.id, 240);
      const landlordId = asString(data.landlordId, 240) || null;
      const tenantId = asString(data.tenantId, 240) || null;
      if (!VALID_RESOURCE_TYPES.has(resourceType) || !resourceId) return null;
      if (scope.landlordId && landlordId && landlordId !== scope.landlordId) return null;
      if (scope.tenantId && tenantId && tenantId !== scope.tenantId) return null;
      return {
        resourceType,
        resourceId,
        label: safeText(data.label, 160) || `${resourceType.replace(/_/g, " ")} reference`,
        landlordId,
        tenantId,
        internalReference: true,
      };
    })
    .filter(Boolean) as SecurityIncidentAffectedResourceRef[];
  return uniqueSorted(refs, (ref) => `${ref.resourceType}:${ref.resourceId}`).slice(0, 32);
}

export function normalizeSecurityIncidentEvidenceLinks(raw: unknown): SecurityIncidentEvidenceLink[] {
  if (!Array.isArray(raw)) return [];
  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const evidenceId = asString(data.evidenceId || data.evidencePackId || data.id, 240);
      if (!evidenceId) return null;
      const sensitivityClass = normalizeKey(data.sensitivityClass) as SecurityIncidentEvidenceLink["sensitivityClass"];
      return {
        evidenceId,
        label: safeText(data.label, 160) || "Evidence reference",
        sourceCollection: asString(data.sourceCollection, 120) || null,
        sourceId: asString(data.sourceId, 240) || null,
        sensitivityClass:
          sensitivityClass === "critical" || sensitivityClass === "restricted" || sensitivityClass === "sensitive"
            ? sensitivityClass
            : "sensitive",
        internalReference: true,
      };
    })
    .filter(Boolean) as SecurityIncidentEvidenceLink[];
  return uniqueSorted(refs, (ref) => `${ref.evidenceId}:${ref.sourceCollection || ""}:${ref.sourceId || ""}`).slice(0, 24);
}

export function buildSecurityIncidentReference(input: {
  incidentId?: string | null;
  category: SecurityIncidentCategory | string;
  severity?: SecurityIncidentSeverity | string | null;
  responseState?: SecurityIncidentResponseState | string | null;
  title?: string | null;
  summary?: string | null;
  detectedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  affectedResources?: Array<Record<string, unknown>> | null;
  evidenceLinks?: Array<Record<string, unknown>> | null;
  landlordId?: string | null;
  tenantId?: string | null;
  confirmedExposure?: boolean | null;
  productionImpact?: boolean | null;
  tenantDataInvolved?: boolean | null;
}): SecurityIncidentReference {
  const now = new Date();
  const category = normalizeSecurityIncidentCategory(input.category);
  const detectedAt = toIsoDate(input.detectedAt, now);
  const incidentId =
    asString(input.incidentId, 240) ||
    safeIdPart(["security_incident", category, detectedAt].join(":")) ||
    "security_incident:unknown";
  const affectedResources = normalizeSecurityIncidentAffectedResources(input.affectedResources, {
    landlordId: asString(input.landlordId, 240) || null,
    tenantId: asString(input.tenantId, 240) || null,
  });
  const evidenceLinks = normalizeSecurityIncidentEvidenceLinks(input.evidenceLinks);
  const severity = input.severity
    ? normalizeSecurityIncidentSeverity(input.severity)
    : classifySecurityIncidentSeverity({
        category,
        confirmedExposure: input.confirmedExposure,
        productionImpact: input.productionImpact,
        tenantDataInvolved: input.tenantDataInvolved,
      });
  const sensitivityClass =
    severity === "critical" ? "critical" : severity === "high" || evidenceLinks.some((link) => link.sensitivityClass === "restricted") ? "restricted" : "sensitive";

  return {
    incidentGovernanceVersion: SECURITY_INCIDENT_GOVERNANCE_VERSION,
    incidentId,
    category,
    severity,
    responseState: normalizeSecurityIncidentResponseState(input.responseState),
    title: safeText(input.title, 160) || `${category.replace(/_/g, " ")} review`,
    summary: safeText(input.summary, 500) || "Security incident metadata prepared for manual review.",
    detectedAt,
    updatedAt: toIsoDate(input.updatedAt, new Date(detectedAt)),
    affectedResources,
    evidenceLinks,
    auditExpectation: "manual_append_only",
    visibilityClass: severity === "critical" ? "admin_support" : "internal_security",
    sensitivityClass,
    manualOnly: true,
    autonomousRemediationEnabled: false,
    tokenRevocationAutomated: false,
    credentialRotationAutomated: false,
    accountLockAutomated: false,
    tenantVisible: false,
    externalAlertingEnabled: false,
    redactionSummary:
      "Incident metadata excludes raw credentials, provider payloads, documents, exports, message bodies, stack traces, and debug payloads.",
  };
}
