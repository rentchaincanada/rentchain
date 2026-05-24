import { db } from "../../config/firebase";
import {
  validateGovernedReviewWorkspacePersistenceCandidate,
  type GovernedReviewWorkspaceAppendEventRef,
  type GovernedReviewWorkspacePersistenceRecord,
} from "../../lib/governedReviewWorkspacePersistence/governedReviewWorkspacePersistence";

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
  safeEvidenceRefs: GovernedReviewWorkspacePersistenceRecord["safeEvidenceRefs"];
  relatedWorkspaceLinks: GovernedReviewWorkspacePersistenceRecord["relatedWorkspaceLinks"];
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

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
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
      ? (record.appendEventRefs as GovernedReviewWorkspaceAppendEventRef[]).map((event) => ({
          eventType: event.eventType,
          eventSummary: event.eventSummary,
          occurredAt: event.occurredAt,
          relatedEvidenceRefs: event.relatedEvidenceRefs,
          relatedWorkspaceLinks: event.relatedWorkspaceLinks,
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
    safeEvidenceRefs: record.safeEvidenceRefs,
    relatedWorkspaceLinks: record.relatedWorkspaceLinks,
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
