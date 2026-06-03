import { db } from "../../firebase";
import {
  buildAdminSupportEscalationReviewDetail,
  buildAdminSupportEscalationReviewRecords,
  emptyAdminSupportEscalationReviewSummary,
  filterAdminSupportEscalationReviewRecords,
  type AdminSupportEscalationReviewDetail,
  type AdminSupportEscalationReviewRecord,
} from "../../lib/adminSupportEscalations/adminSupportEscalationReview";

type LoadParams = {
  category?: string | null;
  severity?: string | null;
  state?: string | null;
  approvalExpectation?: string | null;
  q?: string | null;
  limit?: number | null;
};

const HISTORY_COLLECTION = "supportEscalationHistory";
const NOTES_COLLECTION = "supportEscalationReviewNotes";

async function loadCollection(collectionName: typeof HISTORY_COLLECTION | typeof NOTES_COLLECTION, limit = 100) {
  const snap = await db.collection(collectionName).get().catch(() => null);
  return (snap?.docs || []).slice(0, limit).map((doc: any) => ({
    id: String(doc.id || ""),
    ...((doc.data() as Record<string, unknown>) || {}),
  }));
}

async function loadEscalationSources() {
  const [history, notes] = await Promise.all([
    loadCollection(HISTORY_COLLECTION),
    loadCollection(NOTES_COLLECTION),
  ]);
  return { history, notes };
}

function summaryFor(records: AdminSupportEscalationReviewRecord[]) {
  if (!records.length) return emptyAdminSupportEscalationReviewSummary();
  return {
    total: records.length,
    highOrCritical: records.filter((record) => record.severity === "high" || record.severity === "critical").length,
    awaitingApproval: records.filter((record) => record.state === "awaiting_approval").length,
    notes: records.reduce((sum, record) => sum + record.noteCount, 0),
    metadataOnly: true as const,
    emptyState: null,
  };
}

export async function loadAdminSupportEscalationReviews(
  params: LoadParams = {}
): Promise<{
  escalations: AdminSupportEscalationReviewRecord[];
  summary: ReturnType<typeof summaryFor>;
  schema: {
    metadataOnly: true;
    visibilityClass: "admin_support_internal";
    tenantVisible: false;
    landlordVisible: false;
    persistence: "read_only_if_present";
    mutationControlsEnabled: false;
  };
}> {
  const requestedLimit = Number(params.limit || 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const sources = await loadEscalationSources();
  const records = buildAdminSupportEscalationReviewRecords(sources);
  const filtered = filterAdminSupportEscalationReviewRecords(records, params)
    .sort((a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt) || a.escalationId.localeCompare(b.escalationId))
    .slice(0, limit);

  return {
    escalations: filtered,
    summary: summaryFor(filtered),
    schema: {
      metadataOnly: true,
      visibilityClass: "admin_support_internal",
      tenantVisible: false,
      landlordVisible: false,
      persistence: "read_only_if_present",
      mutationControlsEnabled: false,
    },
  };
}

export async function loadAdminSupportEscalationReviewDetail(
  escalationId: string
): Promise<AdminSupportEscalationReviewDetail | null> {
  const sources = await loadEscalationSources();
  return buildAdminSupportEscalationReviewDetail(escalationId, sources);
}
