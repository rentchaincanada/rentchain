import {
  buildSupportEscalationRunbookTemplate,
  type SupportEscalationApprovalRequirement,
  type SupportEscalationCategory,
  type SupportEscalationSafeRef,
  type SupportEscalationSeverity,
  type SupportEscalationState,
} from "../supportEscalationRunbooks/supportEscalationRunbooks";
import {
  buildSupportEscalationHistoryEntry,
  buildSupportEscalationReviewNote,
  type SupportEscalationHistoryEntry,
  type SupportEscalationReviewNote,
} from "../supportEscalationHistory/supportEscalationHistory";
import {
  buildEscalationWorkspaceLinks,
  type EscalationReviewWorkspaceLink,
} from "../escalationReviewWorkspaceLinks/escalationReviewWorkspaceLinks";

export const ADMIN_SUPPORT_ESCALATION_REVIEW_VERSION = "admin_support_escalation_review_v1";

export type AdminSupportEscalationReviewRecord = {
  escalationReviewVersion: typeof ADMIN_SUPPORT_ESCALATION_REVIEW_VERSION;
  escalationId: string;
  category: SupportEscalationCategory;
  severity: SupportEscalationSeverity;
  state: SupportEscalationState;
  approvalExpectation: SupportEscalationApprovalRequirement;
  title: string;
  summary: string;
  createdAt: string;
  lastUpdatedAt: string;
  actorSummary: SupportEscalationHistoryEntry["actorSummary"] | null;
  safeEvidenceRefs: SupportEscalationSafeRef[];
  historyCount: number;
  noteCount: number;
  metadataOnly: true;
  visibilityClass: "admin_support_internal";
  tenantVisible: false;
  landlordVisible: false;
};

export type AdminSupportEscalationReviewDetail = AdminSupportEscalationReviewRecord & {
  historyEntries: SupportEscalationHistoryEntry[];
  reviewNotes: SupportEscalationReviewNote[];
  redactionSummary: string;
  prohibitedActions: string[];
  relatedWorkspaceLinks: EscalationReviewWorkspaceLink[];
  emptyState: boolean;
};

export type AdminSupportEscalationReviewInput = {
  history?: Array<Record<string, unknown>>;
  notes?: Array<Record<string, unknown>>;
};

type Filters = {
  category?: string | null;
  severity?: string | null;
  state?: string | null;
  approvalExpectation?: string | null;
  q?: string | null;
};

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function label(value: string): string {
  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function minIso(values: string[]): string {
  const valid = values.filter((value) => Number.isFinite(Date.parse(value))).sort();
  return valid[0] || new Date(0).toISOString();
}

function maxIso(values: string[]): string {
  const valid = values.filter((value) => Number.isFinite(Date.parse(value))).sort();
  return valid[valid.length - 1] || new Date(0).toISOString();
}

function safeFlags() {
  return {
    metadataOnly: true as const,
    visibilityClass: "admin_support_internal" as const,
    tenantVisible: false as const,
    landlordVisible: false as const,
  };
}

function uniqueRefs(refs: SupportEscalationSafeRef[]): SupportEscalationSafeRef[] {
  const byKey = new Map<string, SupportEscalationSafeRef>();
  for (const ref of refs) {
    const key = `${ref.referenceType}:${ref.referenceId}`;
    if (!byKey.has(key)) byKey.set(key, ref);
  }
  return Array.from(byKey.values()).sort((a, b) => `${a.referenceType}:${a.referenceId}`.localeCompare(`${b.referenceType}:${b.referenceId}`));
}

function buildGroupRecord(
  escalationId: string,
  historyEntries: SupportEscalationHistoryEntry[],
  reviewNotes: SupportEscalationReviewNote[]
): AdminSupportEscalationReviewRecord | null {
  const latestHistory = [...historyEntries].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] || null;
  const latestNote = [...reviewNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
  if (!latestHistory && !latestNote) return null;
  const category = latestHistory?.category || "other";
  const severity = latestHistory?.severity || "low";
  const state = latestHistory?.state || "triage_required";
  const template = buildSupportEscalationRunbookTemplate({ category, severity });
  const times = [
    ...historyEntries.map((entry) => entry.occurredAt),
    ...reviewNotes.map((note) => note.createdAt),
  ];
  return {
    escalationReviewVersion: ADMIN_SUPPORT_ESCALATION_REVIEW_VERSION,
    escalationId,
    category,
    severity,
    state,
    approvalExpectation: latestHistory?.approvalExpectation || template.approvalRequirement,
    title: `${label(category)} escalation`,
    summary:
      latestNote?.noteSummary ||
      latestHistory?.noteSummary ||
      "Support escalation metadata is available for admin/support review.",
    createdAt: minIso(times),
    lastUpdatedAt: maxIso(times),
    actorSummary: latestHistory?.actorSummary || latestNote?.authorSummary || null,
    safeEvidenceRefs: uniqueRefs([
      ...historyEntries.flatMap((entry) => entry.safeEvidenceRefs),
      ...reviewNotes.flatMap((note) => note.safeEvidenceRefs),
    ]).slice(0, 20),
    historyCount: historyEntries.length,
    noteCount: reviewNotes.length,
    ...safeFlags(),
  };
}

export function buildAdminSupportEscalationReviewRecords(input: AdminSupportEscalationReviewInput = {}) {
  const historyEntries = (input.history || []).map((item) => buildSupportEscalationHistoryEntry(item));
  const reviewNotes = (input.notes || []).map((item) => buildSupportEscalationReviewNote(item));
  const ids = new Set<string>([
    ...historyEntries.map((entry) => entry.escalationRefId),
    ...reviewNotes.map((note) => note.escalationRefId),
  ]);

  return Array.from(ids)
    .sort()
    .map((id) =>
      buildGroupRecord(
        id,
        historyEntries.filter((entry) => entry.escalationRefId === id),
        reviewNotes.filter((note) => note.escalationRefId === id)
      )
    )
    .filter(Boolean) as AdminSupportEscalationReviewRecord[];
}

export function buildAdminSupportEscalationReviewDetail(
  escalationId: string,
  input: AdminSupportEscalationReviewInput = {}
): AdminSupportEscalationReviewDetail | null {
  const safeEscalationId = asString(escalationId, 240).toLowerCase().replace(/[^a-z0-9_.:-]+/g, "_");
  if (!safeEscalationId) return null;
  const historyEntries = (input.history || [])
    .map((item) => buildSupportEscalationHistoryEntry(item))
    .filter((entry) => entry.escalationRefId === safeEscalationId);
  const reviewNotes = (input.notes || [])
    .map((item) => buildSupportEscalationReviewNote(item))
    .filter((note) => note.escalationRefId === safeEscalationId);
  const record = buildGroupRecord(safeEscalationId, historyEntries, reviewNotes);
  if (!record) return null;
  const template = buildSupportEscalationRunbookTemplate({ category: record.category, severity: record.severity });
  return {
    ...record,
    historyEntries: historyEntries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    reviewNotes: reviewNotes.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    redactionSummary:
      "Escalation details are metadata-only; raw notes, payloads, provider data, documents, storage paths, credentials, debug data, request/response bodies, and policy internals are excluded.",
    prohibitedActions: template.prohibitedActions,
    relatedWorkspaceLinks: buildEscalationWorkspaceLinks({
      escalation: {
        ...record,
        historyEntries,
        reviewNotes,
        redactionSummary: "",
        prohibitedActions: template.prohibitedActions,
        relatedWorkspaceLinks: [],
        emptyState: false,
      },
    }),
    emptyState: false,
  };
}

export function filterAdminSupportEscalationReviewRecords(
  records: AdminSupportEscalationReviewRecord[],
  filters: Filters = {}
) {
  const q = asString(filters.q, 160).toLowerCase();
  return records.filter((record) => {
    if (filters.category && record.category !== filters.category) return false;
    if (filters.severity && record.severity !== filters.severity) return false;
    if (filters.state && record.state !== filters.state) return false;
    if (filters.approvalExpectation && record.approvalExpectation !== filters.approvalExpectation) return false;
    if (q) {
      const haystack = [record.title, record.summary, record.category, record.severity, record.state, record.approvalExpectation]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function emptyAdminSupportEscalationReviewSummary() {
  return {
    total: 0,
    highOrCritical: 0,
    awaitingApproval: 0,
    notes: 0,
    metadataOnly: true as const,
    emptyState:
      "No persisted support escalation history or review note metadata is available yet. This surface is ready for append-only metadata once an approved writer exists.",
  };
}
