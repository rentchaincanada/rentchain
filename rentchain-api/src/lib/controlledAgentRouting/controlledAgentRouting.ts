export const CONTROLLED_AGENT_ROUTING_READINESS_VERSION = "controlled_agent_routing_readiness_v1";

export type AgentReadinessClass =
  | "not_agent_eligible"
  | "summarize_only"
  | "suggest_route"
  | "prepare_draft"
  | "requires_human_approval"
  | "blocked";

export type AgentActionRiskClass =
  | "informational"
  | "operational_metadata"
  | "tenant_visible"
  | "financial"
  | "legal_notice"
  | "evidence_export"
  | "consent_sensitive"
  | "credential_security"
  | "admin_support"
  | "prohibited_autonomous";

export type HumanApprovalRequirement =
  | "none_for_metadata_only"
  | "review_required"
  | "explicit_approval_required"
  | "admin_approval_required"
  | "prohibited";

export type ControlledRoutingSourceRef = {
  sourceCollection: string;
  sourceId: string;
  landlordId: string | null;
  tenantId: string | null;
  internalReference: true;
  tenantVisible: false;
};

export type ControlledRoutingContext = {
  controlledRoutingVersion: typeof CONTROLLED_AGENT_ROUTING_READINESS_VERSION;
  routingContextId: string;
  landlordId: string;
  tenantId: string | null;
  requestedAction: string;
  actionRiskClass: AgentActionRiskClass;
  readinessClass: AgentReadinessClass;
  humanApprovalRequirement: HumanApprovalRequirement;
  reviewWorkspaceCompatible: boolean;
  manualHandoffOnly: true;
  sourceRefs: ControlledRoutingSourceRef[];
  blockedReasons: string[];
  governanceSummary: string;
  metadataOnly: true;
  noExecution: true;
  autonomousExecutionEnabled: false;
  autoRouteEnabled: false;
  autoApprovalEnabled: false;
  autoResolutionEnabled: false;
  financialMutationEnabled: false;
  tenantVisibleAgentInternals: false;
  externalAiProviderEnabled: false;
  restrictedPayloadIncluded: false;
};

const VALID_RISK_CLASSES = new Set<AgentActionRiskClass>([
  "informational",
  "operational_metadata",
  "tenant_visible",
  "financial",
  "legal_notice",
  "evidence_export",
  "consent_sensitive",
  "credential_security",
  "admin_support",
  "prohibited_autonomous",
]);

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 160).toLowerCase().replace(/[\s.-]+/g, "_");
}

function cleanId(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueSortedRefs(refs: ControlledRoutingSourceRef[]): ControlledRoutingSourceRef[] {
  const byKey = new Map<string, ControlledRoutingSourceRef>();
  for (const ref of refs) byKey.set(`${ref.sourceCollection}:${ref.sourceId}`, ref);
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.sourceCollection}:${a.sourceId}`.localeCompare(`${b.sourceCollection}:${b.sourceId}`),
  );
}

export function classifyActionRisk(value: unknown): AgentActionRiskClass {
  const normalized = normalizeKey(value);
  if (VALID_RISK_CLASSES.has(normalized as AgentActionRiskClass)) return normalized as AgentActionRiskClass;
  if (normalized.includes("payment") || normalized.includes("ledger") || normalized.includes("financial")) return "financial";
  if (normalized.includes("lease_notice") || normalized.includes("legal")) return "legal_notice";
  if (normalized.includes("evidence") || normalized.includes("export")) return "evidence_export";
  if (normalized.includes("consent")) return "consent_sensitive";
  if (normalized.includes("credential") || normalized.includes("secret") || normalized.includes("token")) return "credential_security";
  if (normalized.includes("admin") || normalized.includes("support")) return "admin_support";
  if (normalized.includes("tenant_visible") || normalized.includes("tenant")) return "tenant_visible";
  if (normalized.includes("route") || normalized.includes("workflow") || normalized.includes("assignment")) {
    return "operational_metadata";
  }
  return "informational";
}

export function determineHumanApprovalRequirement(riskClass: AgentActionRiskClass): HumanApprovalRequirement {
  if (riskClass === "informational") return "none_for_metadata_only";
  if (riskClass === "operational_metadata") return "review_required";
  if (riskClass === "tenant_visible" || riskClass === "financial" || riskClass === "legal_notice") {
    return "explicit_approval_required";
  }
  if (riskClass === "admin_support" || riskClass === "credential_security") return "admin_approval_required";
  if (riskClass === "prohibited_autonomous") return "prohibited";
  return "explicit_approval_required";
}

export function classifyAgentReadiness(input: {
  actionRiskClass: AgentActionRiskClass;
  metadataOnly?: boolean | null;
  hasScopedSourceRefs?: boolean | null;
  reviewWorkspaceCompatible?: boolean | null;
  explicitHumanApprovalAvailable?: boolean | null;
  requestedAutonomousExecution?: boolean | null;
}): AgentReadinessClass {
  if (input.requestedAutonomousExecution) return "blocked";
  if (input.actionRiskClass === "prohibited_autonomous") return "blocked";
  if (input.actionRiskClass === "credential_security" || input.actionRiskClass === "admin_support") {
    return "requires_human_approval";
  }
  if (!input.metadataOnly) return "not_agent_eligible";
  if (input.actionRiskClass === "informational") return "summarize_only";
  if (input.actionRiskClass === "operational_metadata" && input.hasScopedSourceRefs) return "suggest_route";
  if (
    (input.actionRiskClass === "tenant_visible" ||
      input.actionRiskClass === "financial" ||
      input.actionRiskClass === "legal_notice" ||
      input.actionRiskClass === "evidence_export" ||
      input.actionRiskClass === "consent_sensitive") &&
    input.reviewWorkspaceCompatible &&
    input.explicitHumanApprovalAvailable
  ) {
    return "prepare_draft";
  }
  return "requires_human_approval";
}

export function normalizeControlledRoutingSourceRefs(input: {
  refs?: Array<Record<string, unknown>> | null;
  landlordId: string;
  tenantId?: string | null;
}): ControlledRoutingSourceRef[] {
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
        sourceCollection,
        sourceId,
        landlordId,
        tenantId,
        internalReference: true,
        tenantVisible: false,
      };
    })
    .filter(Boolean) as ControlledRoutingSourceRef[];
  return uniqueSortedRefs(refs);
}

export function buildControlledRoutingReadinessRef(input: {
  sourceCollection: string;
  sourceId: string;
  landlordId: string;
  tenantId?: string | null;
}): ControlledRoutingSourceRef {
  return {
    sourceCollection: asString(input.sourceCollection, 120) || "unknown",
    sourceId: asString(input.sourceId, 240) || "unknown",
    landlordId: asString(input.landlordId, 240) || "unknown",
    tenantId: asString(input.tenantId, 240) || null,
    internalReference: true,
    tenantVisible: false,
  };
}

export function normalizeControlledRoutingContext(input: {
  routingContextId?: string | null;
  landlordId: string;
  tenantId?: string | null;
  requestedAction: string;
  actionRiskClass?: unknown;
  metadataOnly?: boolean | null;
  reviewWorkspaceCompatible?: boolean | null;
  explicitHumanApprovalAvailable?: boolean | null;
  requestedAutonomousExecution?: boolean | null;
  sourceRefs?: Array<Record<string, unknown>> | null;
}): ControlledRoutingContext {
  const landlordId = asString(input.landlordId, 240);
  const tenantId = asString(input.tenantId, 240) || null;
  const requestedAction = asString(input.requestedAction, 160) || "summarize_context";
  const actionRiskClass = classifyActionRisk(input.actionRiskClass || requestedAction);
  const sourceRefs = normalizeControlledRoutingSourceRefs({ refs: input.sourceRefs, landlordId, tenantId });
  const approval = determineHumanApprovalRequirement(actionRiskClass);
  const reviewWorkspaceCompatible = input.reviewWorkspaceCompatible !== false;
  const metadataOnly = input.metadataOnly !== false;
  const readinessClass = classifyAgentReadiness({
    actionRiskClass,
    metadataOnly,
    hasScopedSourceRefs: sourceRefs.length > 0,
    reviewWorkspaceCompatible,
    explicitHumanApprovalAvailable: input.explicitHumanApprovalAvailable === true,
    requestedAutonomousExecution: input.requestedAutonomousExecution === true,
  });
  const blockedReasons: string[] = [];
  if (input.requestedAutonomousExecution) blockedReasons.push("autonomous_execution_requested");
  if (!metadataOnly) blockedReasons.push("non_metadata_payload_requested");
  if (approval === "prohibited") blockedReasons.push("prohibited_action_risk");
  if (actionRiskClass === "credential_security") blockedReasons.push("credential_security_requires_admin_review");
  if (actionRiskClass === "admin_support") blockedReasons.push("admin_support_requires_privileged_review");

  return {
    controlledRoutingVersion: CONTROLLED_AGENT_ROUTING_READINESS_VERSION,
    routingContextId: cleanId(input.routingContextId || `controlled_agent_routing:${landlordId}:${requestedAction}`) || "controlled_agent_routing",
    landlordId,
    tenantId,
    requestedAction,
    actionRiskClass,
    readinessClass,
    humanApprovalRequirement: approval,
    reviewWorkspaceCompatible,
    manualHandoffOnly: true,
    sourceRefs,
    blockedReasons,
    governanceSummary: `${requestedAction.replace(/_/g, " ")} is classified as ${readinessClass.replace(/_/g, " ")} with ${approval.replace(/_/g, " ")}.`,
    metadataOnly: true,
    noExecution: true,
    autonomousExecutionEnabled: false,
    autoRouteEnabled: false,
    autoApprovalEnabled: false,
    autoResolutionEnabled: false,
    financialMutationEnabled: false,
    tenantVisibleAgentInternals: false,
    externalAiProviderEnabled: false,
    restrictedPayloadIncluded: false,
  };
}
