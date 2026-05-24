import crypto from "crypto";
import type {
  AdminSecurityIncidentReviewRecord,
} from "../adminSecurityIncidents/adminSecurityIncidentReview";
import type {
  AdminSupportEscalationReviewRecord,
} from "../adminSupportEscalations/adminSupportEscalationReview";
import {
  buildSupportEscalationRunbookTemplate,
  type SupportEscalationApprovalRequirement,
} from "../supportEscalationRunbooks/supportEscalationRunbooks";
import type {
  SupportEscalationHistoryEntry,
  SupportEscalationReviewNote,
} from "../supportEscalationHistory/supportEscalationHistory";

export const ESCALATION_REVIEW_WORKSPACE_LINK_VERSION = "escalation_review_workspace_linking_v1";

export type EscalationReviewWorkspaceLinkType =
  | "incident_to_escalation"
  | "escalation_to_runbook"
  | "escalation_to_history"
  | "escalation_to_note"
  | "escalation_to_evidence"
  | "incident_to_evidence"
  | "incident_to_review_workspace";

export type EscalationReviewWorkspaceLinkSummary = {
  kind: "security_incident" | "support_escalation" | "runbook" | "history_entry" | "review_note" | "evidence_reference" | "review_workspace";
  label: string;
  category: string | null;
  severity: string | null;
  state: string | null;
  metadataOnly: true;
  rawIdsIncluded: false;
};

export type EscalationReviewWorkspaceLink = {
  escalationReviewWorkspaceLinkVersion: typeof ESCALATION_REVIEW_WORKSPACE_LINK_VERSION;
  linkId: string;
  linkType: EscalationReviewWorkspaceLinkType;
  sourceSummary: EscalationReviewWorkspaceLinkSummary;
  targetSummary: EscalationReviewWorkspaceLinkSummary;
  workflowFamily: string | null;
  createdAt: string;
  derivedAt: string;
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
  redactionSummary: string;
};

const LINK_TYPES = new Set<EscalationReviewWorkspaceLinkType>([
  "incident_to_escalation",
  "escalation_to_runbook",
  "escalation_to_history",
  "escalation_to_note",
  "escalation_to_evidence",
  "incident_to_evidence",
  "incident_to_review_workspace",
]);

type LinkInput = {
  linkType?: unknown;
  sourceSummary?: Partial<EscalationReviewWorkspaceLinkSummary> | null;
  targetSummary?: Partial<EscalationReviewWorkspaceLinkSummary> | null;
  workflowFamily?: unknown;
  createdAt?: unknown;
  derivedAt?: unknown;
};

function asString(value: unknown, max = 300): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeKey(value: unknown): string {
  return asString(value, 120).toLowerCase().replace(/[\s.-]+/g, "_");
}

function toIso(value: unknown): string {
  if (value && typeof (value as any).toDate === "function") return (value as any).toDate().toISOString();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const raw = asString(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function stableHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 16);
}

function safeLabel(value: unknown, fallback: string): string {
  const label = asString(value, 160).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!label) return fallback;
  if (/gs:\/\//i.test(label) || /storage\.googleapis\.com/i.test(label)) return fallback;
  if (/token|secret|credential|authorization|cookie|password|bearer/i.test(label)) return fallback;
  if (/^[a-zA-Z0-9_-]{16,}$/.test(label)) return fallback;
  return label;
}

function normalizeLinkType(value: unknown): EscalationReviewWorkspaceLinkType | null {
  const normalized = normalizeKey(value);
  return LINK_TYPES.has(normalized as EscalationReviewWorkspaceLinkType)
    ? (normalized as EscalationReviewWorkspaceLinkType)
    : null;
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
  };
}

function summary(input: Partial<EscalationReviewWorkspaceLinkSummary> | null | undefined): EscalationReviewWorkspaceLinkSummary {
  const kind = input?.kind || "evidence_reference";
  return {
    kind,
    label: safeLabel(input?.label, `${kind.split("_").join(" ")} reference`),
    category: asString(input?.category, 120) || null,
    severity: asString(input?.severity, 80) || null,
    state: asString(input?.state, 80) || null,
    metadataOnly: true,
    rawIdsIncluded: false,
  };
}

export function buildEscalationReviewWorkspaceLink(input: LinkInput): EscalationReviewWorkspaceLink | null {
  const linkType = normalizeLinkType(input.linkType);
  if (!linkType) return null;
  const sourceSummary = summary(input.sourceSummary);
  const targetSummary = summary(input.targetSummary);
  const createdAt = toIso(input.createdAt);
  const derivedAt = toIso(input.derivedAt || input.createdAt);
  return {
    escalationReviewWorkspaceLinkVersion: ESCALATION_REVIEW_WORKSPACE_LINK_VERSION,
    linkId: `workspace_link:${stableHash([linkType, sourceSummary, targetSummary, createdAt])}`,
    linkType,
    sourceSummary,
    targetSummary,
    workflowFamily: asString(input.workflowFamily, 120) || null,
    createdAt,
    derivedAt,
    redactionSummary:
      "Workspace link is metadata-only; raw notes, documents, provider payloads, reports, storage paths, tokens, secrets, request/response bodies, debug payloads, and policy internals are excluded.",
    ...safeFlags(),
  };
}

function uniqueLinks(links: Array<EscalationReviewWorkspaceLink | null>): EscalationReviewWorkspaceLink[] {
  const byKey = new Map<string, EscalationReviewWorkspaceLink>();
  for (const link of links) {
    if (link && !byKey.has(link.linkId)) byKey.set(link.linkId, link);
  }
  return Array.from(byKey.values()).sort((a, b) => a.linkId.localeCompare(b.linkId));
}

function incidentSummary(incident: AdminSecurityIncidentReviewRecord): EscalationReviewWorkspaceLinkSummary {
  return summary({
    kind: "security_incident",
    label: incident.title,
    category: incident.category,
    severity: incident.severity,
    state: incident.status,
  });
}

function escalationSummary(escalation: AdminSupportEscalationReviewRecord): EscalationReviewWorkspaceLinkSummary {
  return summary({
    kind: "support_escalation",
    label: escalation.title,
    category: escalation.category,
    severity: escalation.severity,
    state: escalation.state,
  });
}

function refSummary(ref: { referenceType?: string; label?: string }): EscalationReviewWorkspaceLinkSummary {
  return summary({
    kind: ref.referenceType === "review_workspace" ? "review_workspace" : "evidence_reference",
    label: ref.label || `${ref.referenceType || "evidence"} reference`,
    category: ref.referenceType || null,
  });
}

function refMatchesIncident(ref: { referenceId?: string; referenceType?: string }, incident: AdminSecurityIncidentReviewRecord): boolean {
  const refId = asString(ref.referenceId, 260).toLowerCase();
  if (!refId || ref.referenceType !== "incident") return false;
  return refId === incident.incidentId.toLowerCase() || incident.incidentId.toLowerCase().endsWith(refId);
}

export function buildIncidentWorkspaceLinks(input: {
  incident: AdminSecurityIncidentReviewRecord;
  escalations?: AdminSupportEscalationReviewRecord[];
  derivedAt?: unknown;
}): EscalationReviewWorkspaceLink[] {
  const incident = input.incident;
  const source = incidentSummary(incident);
  const evidenceLinks = (incident.safeEvidenceReferences || []).map((ref) =>
    buildEscalationReviewWorkspaceLink({
      linkType: ref.referenceType === "evidence" || ref.referenceType === "export" ? "incident_to_evidence" : "incident_to_review_workspace",
      sourceSummary: source,
      targetSummary: refSummary(ref),
      workflowFamily: incident.workflowFamily || "admin_security_incident_review",
      createdAt: incident.occurredAt,
      derivedAt: input.derivedAt,
    })
  );
  const escalationLinks = (input.escalations || [])
    .filter((escalation) => escalation.safeEvidenceRefs.some((ref) => refMatchesIncident(ref, incident)))
    .map((escalation) =>
      buildEscalationReviewWorkspaceLink({
        linkType: "incident_to_escalation",
        sourceSummary: source,
        targetSummary: escalationSummary(escalation),
        workflowFamily: incident.workflowFamily || "admin_security_incident_review",
        createdAt: escalation.createdAt || incident.occurredAt,
        derivedAt: input.derivedAt,
      })
    );
  return uniqueLinks([...evidenceLinks, ...escalationLinks]);
}

export function buildEscalationWorkspaceLinks(input: {
  escalation: AdminSupportEscalationReviewRecord & {
    historyEntries?: SupportEscalationHistoryEntry[];
    reviewNotes?: SupportEscalationReviewNote[];
  };
  incidents?: AdminSecurityIncidentReviewRecord[];
  derivedAt?: unknown;
}): EscalationReviewWorkspaceLink[] {
  const escalation = input.escalation;
  const incidents = input.incidents || [];
  const source = escalationSummary(escalation);
  const template = buildSupportEscalationRunbookTemplate({ category: escalation.category, severity: escalation.severity });
  const links: Array<EscalationReviewWorkspaceLink | null> = [
    buildEscalationReviewWorkspaceLink({
      linkType: "escalation_to_runbook",
      sourceSummary: source,
      targetSummary: summary({
        kind: "runbook",
        label: template.title,
        category: escalation.category,
        severity: template.severity,
        state: template.approvalRequirement as SupportEscalationApprovalRequirement,
      }),
      workflowFamily: "admin_support_escalation_review",
      createdAt: escalation.createdAt,
      derivedAt: input.derivedAt,
    }),
    ...(escalation.safeEvidenceRefs || []).map((ref) =>
      ref.referenceType === "incident" && incidents.some((incident) => refMatchesIncident(ref, incident))
        ? null
        : buildEscalationReviewWorkspaceLink({
            linkType: ref.referenceType === "incident" ? "incident_to_escalation" : "escalation_to_evidence",
            sourceSummary: ref.referenceType === "incident"
              ? summary({ kind: "security_incident", label: ref.label, category: "incident" })
              : source,
            targetSummary: ref.referenceType === "incident" ? source : refSummary(ref),
            workflowFamily: "admin_support_escalation_review",
            createdAt: escalation.createdAt,
            derivedAt: input.derivedAt,
          })
    ),
  ];

  if (escalation.historyEntries && escalation.reviewNotes) {
    links.push(
      ...escalation.historyEntries.map((entry) =>
        buildEscalationReviewWorkspaceLink({
          linkType: "escalation_to_history",
          sourceSummary: source,
          targetSummary: summary({
            kind: "history_entry",
            label: `${entry.actionType.split("_").join(" ")} history`,
            category: entry.category,
            severity: entry.severity,
            state: entry.state,
          }),
          workflowFamily: "admin_support_escalation_review",
          createdAt: entry.occurredAt,
          derivedAt: input.derivedAt,
        })
      ),
      ...escalation.reviewNotes.map((note) =>
        buildEscalationReviewWorkspaceLink({
          linkType: "escalation_to_note",
          sourceSummary: source,
          targetSummary: summary({
            kind: "review_note",
            label: `${note.noteType.split("_").join(" ")} metadata`,
          }),
          workflowFamily: "admin_support_escalation_review",
          createdAt: note.createdAt,
          derivedAt: input.derivedAt,
        })
      )
    );
  }

  for (const incident of incidents) {
    if (escalation.safeEvidenceRefs.some((ref) => refMatchesIncident(ref, incident))) {
      links.push(
        buildEscalationReviewWorkspaceLink({
          linkType: "incident_to_escalation",
          sourceSummary: incidentSummary(incident),
          targetSummary: source,
          workflowFamily: incident.workflowFamily || "admin_support_escalation_review",
          createdAt: escalation.createdAt,
          derivedAt: input.derivedAt,
        })
      );
    }
  }

  return uniqueLinks(links);
}
