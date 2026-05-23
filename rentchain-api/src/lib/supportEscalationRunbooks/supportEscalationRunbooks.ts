export const SUPPORT_ESCALATION_RUNBOOK_VERSION = "support_escalation_runbooks_v1";

export type SupportEscalationCategory =
  | "security_incident"
  | "impersonation_review"
  | "policy_failure"
  | "projection_safety"
  | "document_access"
  | "export_governance"
  | "credential_secret"
  | "api_abuse"
  | "tenant_data_exposure"
  | "screening_provider"
  | "billing_support"
  | "technical_diagnostics"
  | "compliance_review"
  | "other";

export type SupportEscalationSeverity = "informational" | "low" | "medium" | "high" | "critical";

export type SupportEscalationState =
  | "draft"
  | "queued"
  | "triage_required"
  | "reviewing"
  | "awaiting_approval"
  | "approved_for_manual_action"
  | "resolved"
  | "dismissed";

export type SupportEscalationApprovalRequirement =
  | "none_for_metadata_review"
  | "support_lead_review"
  | "admin_review"
  | "security_review"
  | "executive_review"
  | "prohibited";

export type SupportEscalationReferenceType =
  | "incident"
  | "support_session"
  | "impersonation_session"
  | "evidence_pack"
  | "export_package"
  | "review_workspace"
  | "api_route"
  | "document"
  | "screening_order"
  | "landlord"
  | "tenant"
  | "lease"
  | "property"
  | "unit"
  | "support_diagnostic";

export type SupportEscalationSafeRef = {
  referenceType: SupportEscalationReferenceType;
  referenceId: string;
  label: string;
  landlordId: string | null;
  tenantId: string | null;
  internalReference: true;
  metadataOnly: true;
};

export type SupportEscalationRunbookTemplate = {
  runbookTemplateId: string;
  category: SupportEscalationCategory;
  title: string;
  severity: SupportEscalationSeverity;
  manualSteps: string[];
  approvalRequirement: SupportEscalationApprovalRequirement;
  prohibitedActions: string[];
  metadataOnly: true;
  autonomousActionEnabled: false;
};

export type SupportEscalationRunbookRef = {
  supportEscalationRunbookVersion: typeof SUPPORT_ESCALATION_RUNBOOK_VERSION;
  escalationId: string;
  category: SupportEscalationCategory;
  severity: SupportEscalationSeverity;
  state: SupportEscalationState;
  title: string;
  summary: string;
  runbookTemplate: SupportEscalationRunbookTemplate;
  approvalRequirement: SupportEscalationApprovalRequirement;
  requestedBy: string | null;
  assignedTo: string | null;
  landlordId: string | null;
  tenantId: string | null;
  occurredAt: string;
  resourceRefs: SupportEscalationSafeRef[];
  evidenceRefs: SupportEscalationSafeRef[];
  incidentRefs: SupportEscalationSafeRef[];
  exportRefs: SupportEscalationSafeRef[];
  reviewRefs: SupportEscalationSafeRef[];
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  metadataOnly: true;
  appendCompatible: true;
  supportPowersGranted: false;
  impersonationEnabled: false;
  autonomousRemediationEnabled: false;
  autonomousEscalationEnabled: false;
  financialMutationEnabled: false;
  routeVisibilityChanged: false;
  payloadSafety: {
    rawPayloads: "excluded";
    providerData: "reference_only";
    evidenceData: "reference_only";
    exportData: "reference_only";
    documentData: "reference_only";
    credentialData: "excluded";
    diagnosticData: "metadata_only";
    internalPolicyData: "summary_only";
  };
};

const CATEGORIES = new Set<SupportEscalationCategory>([
  "security_incident",
  "impersonation_review",
  "policy_failure",
  "projection_safety",
  "document_access",
  "export_governance",
  "credential_secret",
  "api_abuse",
  "tenant_data_exposure",
  "screening_provider",
  "billing_support",
  "technical_diagnostics",
  "compliance_review",
  "other",
]);

const SEVERITIES = new Set<SupportEscalationSeverity>([
  "informational",
  "low",
  "medium",
  "high",
  "critical",
]);

const STATES = new Set<SupportEscalationState>([
  "draft",
  "queued",
  "triage_required",
  "reviewing",
  "awaiting_approval",
  "approved_for_manual_action",
  "resolved",
  "dismissed",
]);

const REF_TYPES = new Set<SupportEscalationReferenceType>([
  "incident",
  "support_session",
  "impersonation_session",
  "evidence_pack",
  "export_package",
  "review_workspace",
  "api_route",
  "document",
  "screening_order",
  "landlord",
  "tenant",
  "lease",
  "property",
  "unit",
  "support_diagnostic",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 140).toLowerCase().replace(/[\s.-]+/g, "_");
}

function safeText(value: unknown, max = 500): string {
  return asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function safeReferenceLabel(value: unknown, fallback: string): string {
  const label = safeText(value, 160);
  if (!label) return fallback;
  if (/gs:\/\//i.test(label) || /storage\.googleapis\.com/i.test(label)) return fallback;
  if (/token|secret|credential|authorization|cookie|password/i.test(label)) return fallback;
  return label;
}

function idPart(value: unknown): string {
  return asString(value, 240)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toIso(value: unknown): string {
  if (value && typeof (value as any).toDate === "function") {
    return (value as any).toDate().toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = asString(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function uniqueSorted<T>(values: T[], key: (value: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const value of values) {
    const nextKey = key(value);
    if (nextKey && !byKey.has(nextKey)) byKey.set(nextKey, value);
  }
  return Array.from(byKey.values()).sort((a, b) => key(a).localeCompare(key(b)));
}

export function normalizeSupportEscalationCategory(value: unknown): SupportEscalationCategory {
  const normalized = normalizeKey(value);
  return CATEGORIES.has(normalized as SupportEscalationCategory)
    ? (normalized as SupportEscalationCategory)
    : "other";
}

export function normalizeSupportEscalationSeverity(value: unknown): SupportEscalationSeverity {
  const normalized = normalizeKey(value);
  return SEVERITIES.has(normalized as SupportEscalationSeverity)
    ? (normalized as SupportEscalationSeverity)
    : "low";
}

export function normalizeSupportEscalationState(value: unknown): SupportEscalationState {
  const normalized = normalizeKey(value);
  return STATES.has(normalized as SupportEscalationState)
    ? (normalized as SupportEscalationState)
    : "triage_required";
}

export function approvalRequirementForEscalation(input: {
  category?: unknown;
  severity?: unknown;
}): SupportEscalationApprovalRequirement {
  const category = normalizeSupportEscalationCategory(input.category);
  const severity = normalizeSupportEscalationSeverity(input.severity);
  if (category === "tenant_data_exposure" || category === "credential_secret") return "security_review";
  if (severity === "critical") return "security_review";
  if (severity === "high") return "admin_review";
  if (category === "impersonation_review" || category === "policy_failure" || category === "projection_safety") {
    return "admin_review";
  }
  if (category === "security_incident" || category === "api_abuse" || category === "export_governance") {
    return "support_lead_review";
  }
  return "none_for_metadata_review";
}

function templateTitle(category: SupportEscalationCategory): string {
  return category
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function defaultSteps(category: SupportEscalationCategory): string[] {
  const baseline = [
    "Confirm the scoped context and authority boundary before review.",
    "Review metadata-only incident, support-session, evidence, or export references.",
    "Record manual review outcome in the approved audit path when available.",
  ];
  if (category === "credential_secret") {
    return [
      "Confirm no secret value is copied into the runbook or audit notes.",
      "Identify affected credential family and owner from metadata-only references.",
      "Use the approved manual credential rotation runbook if live rotation is required.",
    ];
  }
  if (category === "tenant_data_exposure" || category === "projection_safety") {
    return [
      "Confirm affected audience and projection boundary from metadata-only references.",
      "Review whether any user-safe surface received internal support/admin metadata.",
      "Escalate to security review before any tenant, landlord, or institution communication.",
    ];
  }
  if (category === "impersonation_review") {
    return [
      "Confirm support/admin actor attribution and effective target role summary.",
      "Review impersonation lifecycle metadata and reason category.",
      "Confirm no write action or permission grant is implied by the escalation record.",
    ];
  }
  return baseline;
}

export function buildSupportEscalationRunbookTemplate(input: {
  category?: unknown;
  severity?: unknown;
}): SupportEscalationRunbookTemplate {
  const category = normalizeSupportEscalationCategory(input.category);
  const severity = normalizeSupportEscalationSeverity(input.severity);
  return {
    runbookTemplateId: idPart(["support_escalation_runbook", category, severity].join(":")),
    category,
    title: `${templateTitle(category)} runbook`,
    severity,
    manualSteps: defaultSteps(category),
    approvalRequirement: approvalRequirementForEscalation({ category, severity }),
    prohibitedActions: [
      "Do not perform autonomous remediation.",
      "Do not change permissions, auth, Firestore rules, or route visibility from this runbook.",
      "Do not copy raw documents, provider payloads, tokens, secrets, credentials, or debug payloads.",
      "Do not mutate financial records.",
    ],
    metadataOnly: true,
    autonomousActionEnabled: false,
  };
}

export function normalizeSupportEscalationRefs(
  raw: unknown,
  scope: { landlordId?: string | null; tenantId?: string | null } = {}
): SupportEscalationSafeRef[] {
  if (!Array.isArray(raw)) return [];
  const landlordScope = asString(scope.landlordId, 240) || null;
  const tenantScope = asString(scope.tenantId, 240) || null;

  const refs = raw
    .map((item) => {
      const data = (item || {}) as Record<string, unknown>;
      const referenceType = normalizeKey(data.referenceType || data.resourceType || data.type) as SupportEscalationReferenceType;
      const referenceId = asString(data.referenceId || data.resourceId || data.id || data.sourceId, 240);
      const landlordId = asString(data.landlordId, 240) || null;
      const tenantId = asString(data.tenantId, 240) || null;
      if (!REF_TYPES.has(referenceType) || !referenceId) return null;
      if (landlordScope && landlordId && landlordId !== landlordScope) return null;
      if (tenantScope && tenantId && tenantId !== tenantScope) return null;
      return {
        referenceType,
        referenceId,
        label: safeReferenceLabel(data.label, `${referenceType.replace(/_/g, " ")} reference`),
        landlordId: landlordId || landlordScope,
        tenantId,
        internalReference: true,
        metadataOnly: true,
      };
    })
    .filter(Boolean) as SupportEscalationSafeRef[];

  return uniqueSorted(refs, (ref) => `${ref.referenceType}:${ref.referenceId}`).slice(0, 32);
}

export function buildSupportEscalationRunbookRef(input: {
  escalationId?: string | null;
  category?: unknown;
  severity?: unknown;
  state?: unknown;
  title?: string | null;
  summary?: string | null;
  requestedBy?: string | null;
  assignedTo?: string | null;
  landlordId?: string | null;
  tenantId?: string | null;
  occurredAt?: unknown;
  resourceRefs?: Array<Record<string, unknown>> | null;
  evidenceRefs?: Array<Record<string, unknown>> | null;
  incidentRefs?: Array<Record<string, unknown>> | null;
  exportRefs?: Array<Record<string, unknown>> | null;
  reviewRefs?: Array<Record<string, unknown>> | null;
}): SupportEscalationRunbookRef {
  const category = normalizeSupportEscalationCategory(input.category);
  const severity = normalizeSupportEscalationSeverity(input.severity);
  const state = normalizeSupportEscalationState(input.state);
  const occurredAt = toIso(input.occurredAt);
  const landlordId = asString(input.landlordId, 240) || null;
  const tenantId = asString(input.tenantId, 240) || null;
  const escalationId =
    idPart(input.escalationId) ||
    idPart(["support_escalation", category, severity, state, occurredAt].join(":")) ||
    "support_escalation_unknown";
  const scope = { landlordId, tenantId };
  const template = buildSupportEscalationRunbookTemplate({ category, severity });

  return {
    supportEscalationRunbookVersion: SUPPORT_ESCALATION_RUNBOOK_VERSION,
    escalationId,
    category,
    severity,
    state,
    title: safeText(input.title, 180) || template.title,
    summary:
      safeText(input.summary, 360) ||
      "Support escalation runbook metadata prepared for manual review.",
    runbookTemplate: template,
    approvalRequirement: template.approvalRequirement,
    requestedBy: asString(input.requestedBy, 240) || null,
    assignedTo: asString(input.assignedTo, 240) || null,
    landlordId,
    tenantId,
    occurredAt,
    resourceRefs: normalizeSupportEscalationRefs(input.resourceRefs, scope),
    evidenceRefs: normalizeSupportEscalationRefs(input.evidenceRefs, scope),
    incidentRefs: normalizeSupportEscalationRefs(input.incidentRefs, scope),
    exportRefs: normalizeSupportEscalationRefs(input.exportRefs, scope),
    reviewRefs: normalizeSupportEscalationRefs(input.reviewRefs, scope),
    visibilityClass: "admin_support_internal",
    tenantVisible: false,
    landlordVisible: false,
    metadataOnly: true,
    appendCompatible: true,
    supportPowersGranted: false,
    impersonationEnabled: false,
    autonomousRemediationEnabled: false,
    autonomousEscalationEnabled: false,
    financialMutationEnabled: false,
    routeVisibilityChanged: false,
    payloadSafety: {
      rawPayloads: "excluded",
      providerData: "reference_only",
      evidenceData: "reference_only",
      exportData: "reference_only",
      documentData: "reference_only",
      credentialData: "excluded",
      diagnosticData: "metadata_only",
      internalPolicyData: "summary_only",
    },
  };
}
