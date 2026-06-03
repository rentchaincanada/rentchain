import { db } from "../../firebase";
import {
  validateGovernedReviewWorkspacePersistenceCandidate,
  type GovernedReviewWorkspacePersistenceRecord,
} from "../../lib/governedReviewWorkspacePersistence/governedReviewWorkspacePersistence";
import type { EscalationReviewWorkspaceLink } from "../../lib/escalationReviewWorkspaceLinks/escalationReviewWorkspaceLinks";

const COLLECTION = "governedReviewWorkspaceAppendLog";

type LoadParams = {
  workspaceType?: string | null;
  q?: string | null;
  limit?: number | null;
};

export type GovernedReviewWorkspaceReadSummary = {
  workspaceId: string;
  workspaceType: string;
  title: string;
  summary: string;
  workflowFamily: string | null;
  severitySummary: string;
  reviewStateSummary: string;
  approvalExpectationSummary: string;
  relatedIncidentCount: number;
  relatedEscalationCount: number;
  relatedEvidenceCount: number;
  relatedNoteCount: number;
  appendEventCount: number;
  retentionClass: string;
  retentionReviewAt: string | null;
  lastAppendedAt: string;
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  appendOnly: true;
  mutationControlsEnabled: false;
  rawPayloadAccessEnabled: false;
};

export type GovernedReviewWorkspaceReadDetail = GovernedReviewWorkspaceReadSummary & {
  safeEvidenceRefs: GovernedReviewWorkspaceSafeEvidenceRef[];
  relatedWorkspaceLinks: GovernedReviewWorkspaceSafeLink[];
  appendEventSummaries: Array<{
    eventRefId: string;
    eventType: string;
    eventSummary: string;
    occurredAt: string;
    metadataOnly: true;
    visibilityClass: "admin_support_internal";
    tenantVisible: false;
    landlordVisible: false;
    appendOnly: true;
  }>;
  redactionSummary: string;
  payloadSafety: GovernedReviewWorkspacePersistenceRecord["payloadSafety"];
  persistenceDecision: GovernedReviewWorkspacePersistenceRecord["persistenceDecision"];
};

type GovernedReviewWorkspaceSafeEvidenceRef = {
  referenceType: string;
  referenceId: string;
  label: string;
};

type GovernedReviewWorkspaceSafeLinkSummary = {
  kind: string;
  label: string;
  category: string | null;
  severity: string | null;
  state: string | null;
  metadataOnly: true;
  rawIdsIncluded: false;
};

type GovernedReviewWorkspaceSafeLink = {
  linkId: string;
  linkType: EscalationReviewWorkspaceLink["linkType"];
  sourceSummary: GovernedReviewWorkspaceSafeLinkSummary;
  targetSummary: GovernedReviewWorkspaceSafeLinkSummary;
  workflowFamily: string | null;
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
  appendCompatible: true;
  mutationControlsEnabled: false;
};

const SENSITIVE_TEXT_PATTERN =
  /(?:gs:\/\/|storage\.googleapis\.com|https?:\/\/|bucket|token|secret|credential|authorization|cookie|password|bearer|request\s*body|response\s*body|requestbody|responsebody|stacktrace|debugpayload|rawproviderpayload|rawscreeningreport|tenant[-_\s]?(?:id|raw)|landlord[-_\s]?(?:id|raw)|lease[-_\s]?id|unit[-_\s]?id)/i;

const RAW_IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]{16,}$/;
const SAFE_LINK_TYPES = new Set<EscalationReviewWorkspaceLink["linkType"]>([
  "incident_to_escalation",
  "escalation_to_runbook",
  "escalation_to_history",
  "escalation_to_note",
  "escalation_to_evidence",
  "incident_to_evidence",
  "incident_to_review_workspace",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function safeText(value: unknown, fallback: string, max = 160): string {
  const label = asString(value, max).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!label) return fallback;
  if (SENSITIVE_TEXT_PATTERN.test(label)) return fallback;
  if (RAW_IDENTIFIER_PATTERN.test(label)) return fallback;
  return label;
}

function safeNullableText(value: unknown, max = 120): string | null {
  const label = safeText(value, "", max);
  return label || null;
}

function safeKey(value: unknown, fallback: string, max = 120): string {
  const key = asString(value, max).toLowerCase().replace(/[^a-z0-9_.:-]+/g, "_");
  if (!key || SENSITIVE_TEXT_PATTERN.test(String(value ?? ""))) return fallback;
  return key;
}

function safeReferenceId(value: unknown, fallback: string, max = 180): string {
  const key = safeKey(value, fallback, max);
  if (RAW_IDENTIFIER_PATTERN.test(key)) return fallback;
  return key;
}

function safeLinkType(value: unknown): EscalationReviewWorkspaceLink["linkType"] {
  const key = safeKey(value, "incident_to_evidence", 80) as EscalationReviewWorkspaceLink["linkType"];
  return SAFE_LINK_TYPES.has(key) ? key : "incident_to_evidence";
}

function safeEvidenceRefs(
  refs: GovernedReviewWorkspacePersistenceRecord["safeEvidenceRefs"]
): GovernedReviewWorkspaceSafeEvidenceRef[] {
  return refs.slice(0, 20).map((ref, index) => {
    const referenceType = safeKey(ref.referenceType, "support_diagnostic", 80);
    return {
      referenceType,
      referenceId: safeReferenceId(ref.referenceId, `redacted_reference_${index + 1}`, 180),
      label: safeText(ref.label, `${referenceType.split("_").join(" ")} reference`, 160),
    };
  });
}

function safeLinkSummary(
  summary: EscalationReviewWorkspaceLink["sourceSummary"] | EscalationReviewWorkspaceLink["targetSummary"] | undefined,
  fallbackKind: string
): GovernedReviewWorkspaceSafeLinkSummary {
  const kind = safeKey(summary?.kind, fallbackKind, 80);
  return {
    kind,
    label: safeText(summary?.label, `${kind.split("_").join(" ")} reference`, 160),
    category: safeNullableText(summary?.category, 120),
    severity: safeNullableText(summary?.severity, 80),
    state: safeNullableText(summary?.state, 80),
    metadataOnly: true,
    rawIdsIncluded: false,
  };
}

function safeWorkspaceLinks(
  links: GovernedReviewWorkspacePersistenceRecord["relatedWorkspaceLinks"]
): GovernedReviewWorkspaceSafeLink[] {
  return links
    .filter((link) => link?.metadataOnly === true)
    .slice(0, 30)
    .map((link, index) => ({
      linkId: `metadata_link_${index + 1}`,
      linkType: safeLinkType(link.linkType),
      sourceSummary: safeLinkSummary(link.sourceSummary, "governed_review_source"),
      targetSummary: safeLinkSummary(link.targetSummary, "governed_review_workspace"),
      workflowFamily: safeNullableText(link.workflowFamily, 120),
      metadataOnly: true,
      visibilityClass: "admin_support_internal",
      tenantVisible: false,
      landlordVisible: false,
      appendCompatible: true,
      mutationControlsEnabled: false,
    }));
}

function sourceRecord(raw: Record<string, unknown>): GovernedReviewWorkspacePersistenceRecord {
  const record = (raw.record && typeof raw.record === "object" ? raw.record : raw) as Record<string, unknown>;
  const validation = validateGovernedReviewWorkspacePersistenceCandidate({
    workspaceSummary: (record.workspaceSummary as any) || null,
    workspaceType: record.workspaceType,
    title: record.title,
    summary: record.summary,
    workflowFamily: record.workflowFamily,
    retentionClass: record.retentionClass,
    retentionReason: record.retentionReason,
    retentionReviewAt: record.retentionReviewAt,
    createdAt: record.createdAt,
    lastAppendedAt: record.lastAppendedAt,
    safeEvidenceRefs: (record.safeEvidenceRefs as any) || [],
    relatedWorkspaceLinks: (record.relatedWorkspaceLinks as any) || [],
    appendEvents: Array.isArray(record.appendEventRefs)
      ? (record.appendEventRefs as Array<Record<string, unknown>>).map((event) => ({
          eventType: event.eventType,
          eventSummary: event.eventSummary,
          occurredAt: event.occurredAt,
          relatedEvidenceRefs: Array.isArray(event.relatedEvidenceRefs) ? event.relatedEvidenceRefs : [],
          relatedWorkspaceLinks: Array.isArray(event.relatedWorkspaceLinks)
            ? (event.relatedWorkspaceLinks as EscalationReviewWorkspaceLink[])
            : [],
        }))
      : [],
  });
  return validation.record;
}

function toSummary(record: GovernedReviewWorkspacePersistenceRecord): GovernedReviewWorkspaceReadSummary {
  return {
    workspaceId: record.workspaceId,
    workspaceType: record.workspaceType,
    title: record.title,
    summary: record.summary,
    workflowFamily: record.workflowFamily,
    severitySummary: record.workspaceSummary.severitySummary,
    reviewStateSummary: record.workspaceSummary.reviewStateSummary,
    approvalExpectationSummary: record.workspaceSummary.approvalExpectationSummary,
    relatedIncidentCount: record.workspaceSummary.relatedIncidentCount,
    relatedEscalationCount: record.workspaceSummary.relatedEscalationCount,
    relatedEvidenceCount: record.workspaceSummary.relatedEvidenceCount,
    relatedNoteCount: record.workspaceSummary.relatedNoteCount,
    appendEventCount: record.appendEventRefs.length,
    retentionClass: record.retentionClass,
    retentionReviewAt: record.retentionReviewAt,
    lastAppendedAt: record.lastAppendedAt,
    metadataOnly: true,
    visibilityClass: "admin_support_internal",
    tenantVisible: false,
    landlordVisible: false,
    appendOnly: true,
    mutationControlsEnabled: false,
    rawPayloadAccessEnabled: false,
  };
}

function toDetail(record: GovernedReviewWorkspacePersistenceRecord): GovernedReviewWorkspaceReadDetail {
  return {
    ...toSummary(record),
    safeEvidenceRefs: safeEvidenceRefs(record.safeEvidenceRefs),
    relatedWorkspaceLinks: safeWorkspaceLinks(record.relatedWorkspaceLinks),
    appendEventSummaries: record.appendEventRefs.map((event) => ({
      eventRefId: event.eventRefId,
      eventType: event.eventType,
      eventSummary: event.eventSummary,
      occurredAt: event.occurredAt,
      metadataOnly: true,
      visibilityClass: "admin_support_internal",
      tenantVisible: false,
      landlordVisible: false,
      appendOnly: true,
    })),
    redactionSummary: record.redactionSummary,
    payloadSafety: record.payloadSafety,
    persistenceDecision: record.persistenceDecision,
  };
}

async function loadRawRecords(limit = 100): Promise<GovernedReviewWorkspacePersistenceRecord[]> {
  const snap = await db.collection(COLLECTION).get().catch(() => null);
  return (snap?.docs || []).slice(0, limit).map((doc: any) => sourceRecord({ id: String(doc.id || ""), ...(doc.data() || {}) }));
}

function filterRecords(records: GovernedReviewWorkspacePersistenceRecord[], params: LoadParams) {
  const workspaceType = asString(params.workspaceType, 120);
  const q = asString(params.q, 160).toLowerCase();
  return records.filter((record) => {
    if (workspaceType && record.workspaceType !== workspaceType) return false;
    if (q) {
      const haystack = [record.title, record.summary, record.workspaceType, record.workflowFamily]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function schema() {
  return {
    metadataOnly: true as const,
    visibilityClass: "admin_support_internal" as const,
    tenantVisible: false as const,
    landlordVisible: false as const,
    appendOnly: true as const,
    persistence: "read_only_if_present" as const,
    mutationControlsEnabled: false as const,
    rawPayloadAccessEnabled: false as const,
    createRouteEnabled: false as const,
    updateRouteEnabled: false as const,
    deleteRouteEnabled: false as const,
  };
}

export async function loadGovernedReviewWorkspaces(params: LoadParams = {}) {
  const requestedLimit = Number(params.limit || 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const records = filterRecords(await loadRawRecords(100), params)
    .sort((a, b) => Date.parse(b.lastAppendedAt) - Date.parse(a.lastAppendedAt) || a.workspaceId.localeCompare(b.workspaceId))
    .slice(0, limit);

  return {
    workspaces: records.map(toSummary),
    summary: {
      total: records.length,
      metadataOnly: true as const,
      emptyState: records.length
        ? null
        : "No governed review workspace append records are available yet. The read surface is ready and returns metadata-only records when the approved append store is populated.",
    },
    schema: schema(),
  };
}

export async function loadGovernedReviewWorkspaceDetail(workspaceId: string): Promise<GovernedReviewWorkspaceReadDetail | null> {
  const target = asString(workspaceId, 260);
  if (!target) return null;
  const records = await loadRawRecords(100);
  const record = records.find((item) => item.workspaceId === target || item.persistenceContractId === target);
  return record ? toDetail(record) : null;
}
