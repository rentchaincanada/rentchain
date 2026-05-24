import crypto from "crypto";
import type {
  AdminSecurityIncidentReviewDetail,
  AdminSecurityIncidentReviewRecord,
} from "../adminSecurityIncidents/adminSecurityIncidentReview";
import type {
  AdminSupportEscalationReviewDetail,
  AdminSupportEscalationReviewRecord,
} from "../adminSupportEscalations/adminSupportEscalationReview";
import type { EscalationReviewWorkspaceLink } from "../escalationReviewWorkspaceLinks/escalationReviewWorkspaceLinks";
import type { SupportEscalationSafeRef } from "../supportEscalationRunbooks/supportEscalationRunbooks";

export const GOVERNED_REVIEW_WORKSPACE_VERSION = "governed_review_workspace_foundations_v1";

export type GovernedReviewWorkspaceType =
  | "security_review"
  | "support_escalation_review"
  | "export_governance_review"
  | "evidence_review"
  | "policy_failure_review"
  | "projection_safety_review"
  | "operational_readiness_review"
  | "other";

export type GovernedReviewWorkspaceSummary = {
  governedReviewWorkspaceVersion: typeof GOVERNED_REVIEW_WORKSPACE_VERSION;
  workspaceId: string;
  workspaceType: GovernedReviewWorkspaceType;
  title: string;
  summary: string;
  workflowFamily: string | null;
  severitySummary: string;
  reviewStateSummary: string;
  relatedIncidentCount: number;
  relatedEscalationCount: number;
  relatedEvidenceCount: number;
  relatedNoteCount: number;
  approvalExpectationSummary: string;
  safeEvidenceRefs: SupportEscalationSafeRef[];
  relatedWorkspaceLinks: EscalationReviewWorkspaceLink[];
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  appendCompatible: true;
  supportPowersGranted: false;
  impersonationEnabled: false;
  autonomousRemediationEnabled: false;
  autonomousEscalationEnabled: false;
  financialMutationEnabled: false;
  routeVisibilityChanged: false;
  mutationControlsEnabled: false;
  rawPayloadAccessEnabled: false;
  redactionSummary: string;
};

const WORKSPACE_TYPES = new Set<GovernedReviewWorkspaceType>([
  "security_review",
  "support_escalation_review",
  "export_governance_review",
  "evidence_review",
  "policy_failure_review",
  "projection_safety_review",
  "operational_readiness_review",
  "other",
]);

const SAFE_REF_TYPES = new Set<SupportEscalationSafeRef["referenceType"]>([
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

type BuildInput = {
  workspaceType?: unknown;
  title?: unknown;
  summary?: unknown;
  workflowFamily?: unknown;
  severity?: unknown;
  reviewState?: unknown;
  approvalExpectation?: unknown;
  relatedIncidentCount?: unknown;
  relatedEscalationCount?: unknown;
  relatedEvidenceCount?: unknown;
  relatedNoteCount?: unknown;
  safeEvidenceRefs?: Array<Partial<SupportEscalationSafeRef> | Record<string, unknown>> | null;
  relatedWorkspaceLinks?: EscalationReviewWorkspaceLink[] | null;
};

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 140).toLowerCase().replace(/[\s.-]+/g, "_");
}

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16);
}

function safeLabel(value: unknown, fallback: string, max = 160): string {
  const label = asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!label) return fallback;
  if (/gs:\/\//i.test(label) || /storage\.googleapis\.com/i.test(label)) return fallback;
  if (/token|secret|credential|authorization|cookie|password|bearer/i.test(label)) return fallback;
  if (/^[a-zA-Z0-9_-]{16,}$/.test(label)) return fallback;
  return label;
}

function count(value: unknown): number {
  const next = Number(value || 0);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
}

function safeFlags() {
  return {
    metadataOnly: true as const,
    visibilityClass: "admin_support_internal" as const,
    tenantVisible: false as const,
    landlordVisible: false as const,
    appendCompatible: true as const,
    supportPowersGranted: false as const,
    impersonationEnabled: false as const,
    autonomousRemediationEnabled: false as const,
    autonomousEscalationEnabled: false as const,
    financialMutationEnabled: false as const,
    routeVisibilityChanged: false as const,
    mutationControlsEnabled: false as const,
    rawPayloadAccessEnabled: false as const,
  };
}

export function normalizeGovernedReviewWorkspaceType(value: unknown): GovernedReviewWorkspaceType {
  const normalized = normalizeKey(value);
  return WORKSPACE_TYPES.has(normalized as GovernedReviewWorkspaceType)
    ? (normalized as GovernedReviewWorkspaceType)
    : "other";
}

function normalizeSafeRefs(refs: BuildInput["safeEvidenceRefs"]): SupportEscalationSafeRef[] {
  const output: SupportEscalationSafeRef[] = [];
  const seen = new Set<string>();
  for (const ref of refs || []) {
    const rawReferenceType = normalizeKey((ref as any).referenceType) as SupportEscalationSafeRef["referenceType"];
    const referenceType = SAFE_REF_TYPES.has(rawReferenceType) ? rawReferenceType : "support_diagnostic";
    const referenceId = asString((ref as any).referenceId, 220).toLowerCase().replace(/[^a-z0-9_.:-]+/g, "_");
    if (!referenceId) continue;
    const key = `${referenceType}:${referenceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      referenceType,
      referenceId,
      label: safeLabel((ref as any).label, `${referenceType.split("_").join(" ")} reference`),
      landlordId: null,
      tenantId: null,
      internalReference: true,
      metadataOnly: true,
    });
  }
  return output.sort((a, b) => `${a.referenceType}:${a.referenceId}`.localeCompare(`${b.referenceType}:${b.referenceId}`)).slice(0, 20);
}

export function buildGovernedReviewWorkspaceSummary(input: BuildInput = {}): GovernedReviewWorkspaceSummary {
  const workspaceType = normalizeGovernedReviewWorkspaceType(input.workspaceType);
  const title = safeLabel(input.title, "Governed review workspace");
  const workflowFamily = safeLabel(input.workflowFamily, "", 120) || null;
  const severitySummary = safeLabel(input.severity, "metadata_only_review", 80);
  const reviewStateSummary = safeLabel(input.reviewState, "metadata_review_ready", 80);
  const approvalExpectationSummary = safeLabel(input.approvalExpectation, "none_for_metadata_review", 120);
  const safeEvidenceRefs = normalizeSafeRefs(input.safeEvidenceRefs);
  const relatedWorkspaceLinks = (input.relatedWorkspaceLinks || []).filter((link) => link?.metadataOnly === true).slice(0, 30);
  return {
    governedReviewWorkspaceVersion: GOVERNED_REVIEW_WORKSPACE_VERSION,
    workspaceId: `governed_workspace:${stableHash([workspaceType, title, workflowFamily, severitySummary, reviewStateSummary])}`,
    workspaceType,
    title,
    summary:
      safeLabel(input.summary, "Metadata-only review workspace summary. Raw payloads and tenant/landlord-facing details are excluded.", 320),
    workflowFamily,
    severitySummary,
    reviewStateSummary,
    relatedIncidentCount: count(input.relatedIncidentCount),
    relatedEscalationCount: count(input.relatedEscalationCount),
    relatedEvidenceCount: count(input.relatedEvidenceCount || safeEvidenceRefs.length),
    relatedNoteCount: count(input.relatedNoteCount),
    approvalExpectationSummary,
    safeEvidenceRefs,
    relatedWorkspaceLinks,
    redactionSummary:
      "Governed review workspace summaries are metadata-only; raw notes, documents, provider payloads, screening reports, storage paths, tokens, secrets, request/response bodies, debug payloads, raw actor IDs, and policy internals are excluded.",
    ...safeFlags(),
  };
}

function incidentWorkspaceType(category: string): GovernedReviewWorkspaceType {
  if (category === "projection_safety_redaction" || category === "support_metadata_redacted") return "projection_safety_review";
  if (category === "policy_denied" || category === "admin_access_denied" || category === "automation_blocked") return "policy_failure_review";
  if (category === "export_blocked" || category === "export_prepared") return "export_governance_review";
  return "security_review";
}

export function buildIncidentGovernedReviewWorkspaceSummary(
  incident: AdminSecurityIncidentReviewDetail | AdminSecurityIncidentReviewRecord
): GovernedReviewWorkspaceSummary {
  const links = "relatedWorkspaceLinks" in incident ? incident.relatedWorkspaceLinks : [];
  return buildGovernedReviewWorkspaceSummary({
    workspaceType: incidentWorkspaceType(incident.category),
    title: `${incident.title} workspace`,
    summary: incident.summary,
    workflowFamily: incident.workflowFamily || "admin_security_incident_review",
    severity: incident.severity,
    reviewState: incident.status,
    approvalExpectation: incident.recommendedReviewAction,
    relatedIncidentCount: 1,
    relatedEscalationCount: links.filter((link) => link.linkType === "incident_to_escalation").length,
    relatedEvidenceCount: incident.safeEvidenceReferences.length,
    relatedNoteCount: "relatedEventSummaries" in incident ? incident.relatedEventSummaries.length : 0,
    safeEvidenceRefs: incident.safeEvidenceReferences.map((ref) => ({
      referenceType: ref.referenceType === "export" ? "export_package" : ref.referenceType === "evidence" ? "evidence_pack" : "support_diagnostic",
      referenceId: ref.referenceId,
      label: ref.label,
    })),
    relatedWorkspaceLinks: links,
  });
}

export function buildEscalationGovernedReviewWorkspaceSummary(
  escalation: AdminSupportEscalationReviewDetail | AdminSupportEscalationReviewRecord
): GovernedReviewWorkspaceSummary {
  const links = "relatedWorkspaceLinks" in escalation ? escalation.relatedWorkspaceLinks : [];
  return buildGovernedReviewWorkspaceSummary({
    workspaceType: escalation.category === "projection_safety" ? "projection_safety_review" : "support_escalation_review",
    title: `${escalation.title} workspace`,
    summary: escalation.summary,
    workflowFamily: "admin_support_escalation_review",
    severity: escalation.severity,
    reviewState: escalation.state,
    approvalExpectation: escalation.approvalExpectation,
    relatedIncidentCount: links.filter((link) => link.linkType === "incident_to_escalation").length,
    relatedEscalationCount: 1,
    relatedEvidenceCount: escalation.safeEvidenceRefs.length,
    relatedNoteCount: escalation.noteCount,
    safeEvidenceRefs: escalation.safeEvidenceRefs,
    relatedWorkspaceLinks: links,
  });
}
