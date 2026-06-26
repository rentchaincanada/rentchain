import type { DecisionInboxItem, DecisionInboxSeverity, DecisionInboxStatus } from "../../lib/decisions/decisionInboxTypes";
import type { UnifiedInboxPriority, UnifiedInboxPublicRecord, UnifiedInboxStatus } from "../unifiedInbox/types";
import type {
  LandlordDecisionQueueInput,
  LandlordDecisionQueueItem,
  LandlordDecisionQueueRelatedRefs,
  LandlordDecisionQueueResult,
  LandlordDecisionQueueSeverity,
  LandlordDecisionQueueSourceType,
  LandlordDecisionQueueStatus,
  LandlordDecisionQueueWorkspace,
  ScopedSignal,
} from "./landlordDecisionQueueTypes";

const VERSION = "landlord_decision_queue_v1" as const;

const SEVERITY_RANK: Record<LandlordDecisionQueueSeverity, number> = {
  critical: 0,
  warning: 1,
  needs_review: 2,
  upcoming: 3,
  informational: 4,
};

const KNOWN_WORKSPACES = new Set<LandlordDecisionQueueWorkspace>([
  "dashboard",
  "operations",
  "tenant",
  "lease",
  "property",
  "maintenance",
  "payments",
  "notices",
  "evidence_compliance",
]);

const MESSAGE_SOURCE_TYPES = new Set<LandlordDecisionQueueSourceType>([
  "message_thread",
  "message_unread_priority",
  "message_notice_relevance",
  "message_maintenance_follow_up",
  "message_support_escalation",
  "unified_inbox_event",
]);

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanToken(value: unknown, fallback: string): string {
  const cleaned = asString(value, 300)
    .toLowerCase()
    .replace(/[\/\\#?&=]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function normalizeDate(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function safeHref(value: unknown, fallback: string): string {
  const href = asString(value, 600);
  if (!href) return fallback;
  if (href.startsWith("/")) return href;
  if (href.startsWith("https://storage.googleapis.com/")) return href;
  return fallback;
}

function scopedToLandlord(recordLandlordId: unknown, landlordId: string): boolean {
  const recordScope = asString(recordLandlordId, 240);
  return !recordScope || recordScope === landlordId;
}

function normalizeStatus(value: unknown): LandlordDecisionQueueStatus {
  const status = asString(value, 80).toLowerCase();
  if (status === "blocked") return "blocked";
  if (status === "pending") return "pending";
  if (status === "resolved" || status === "complete" || status === "completed") return "resolved";
  if (status === "dismissed" || status === "archived") return "dismissed";
  return "open";
}

function severityFromDecisionInbox(value: DecisionInboxSeverity): LandlordDecisionQueueSeverity {
  if (value === "critical") return "critical";
  if (value === "high" || value === "medium") return "warning";
  if (value === "low") return "needs_review";
  return "informational";
}

function statusFromDecisionInbox(value: DecisionInboxStatus): LandlordDecisionQueueStatus {
  if (value === "blocked") return "blocked";
  if (value === "pending") return "pending";
  if (value === "resolved") return "resolved";
  if (value === "dismissed") return "dismissed";
  return "open";
}

function workspaceFromDecisionInbox(item: DecisionInboxItem): LandlordDecisionQueueWorkspace {
  if (item.type === "billing") return "payments";
  if (item.type === "lease") return "lease";
  if (item.type === "tenant") return "tenant";
  if (item.type === "property") return "property";
  if (item.type === "maintenance") return "maintenance";
  if (item.type === "compliance") return "evidence_compliance";
  return "operations";
}

function sourceTypeFromUnifiedInbox(record: UnifiedInboxPublicRecord): LandlordDecisionQueueSourceType {
  if (record.sourceKind === "landlord.message") {
    if (record.priority === "critical" || record.priority === "high") return "message_unread_priority";
    return "message_thread";
  }
  if (record.sourceKind === "landlord.maintenance" || record.sourceKind === "landlord.work_order") {
    return "message_maintenance_follow_up";
  }
  if (record.sourceKind === "landlord.notice") return "message_notice_relevance";
  return "unified_inbox_event";
}

function severityFromUnifiedInbox(priority: UnifiedInboxPriority, status: UnifiedInboxStatus): LandlordDecisionQueueSeverity {
  if (status === "resolved" || status === "archived" || status === "muted") return "informational";
  if (priority === "critical") return "critical";
  if (priority === "high") return "warning";
  if (status === "unread") return "needs_review";
  return "informational";
}

function workspaceFromUnifiedInbox(record: UnifiedInboxPublicRecord): LandlordDecisionQueueWorkspace {
  if (record.sourceKind === "landlord.maintenance" || record.sourceKind === "landlord.work_order") return "maintenance";
  if (record.sourceKind === "landlord.lease") return "lease";
  if (record.sourceKind === "landlord.notice") return "notices";
  if (record.sourceKind === "landlord.message") return "tenant";
  return "operations";
}

function normalizeWorkspace(value: unknown, fallback: LandlordDecisionQueueWorkspace): LandlordDecisionQueueWorkspace {
  const workspace = asString(value, 80).toLowerCase().replace(/-/g, "_") as LandlordDecisionQueueWorkspace;
  return KNOWN_WORKSPACES.has(workspace) ? workspace : fallback;
}

function normalizeSeverity(value: unknown, fallback: LandlordDecisionQueueSeverity): LandlordDecisionQueueSeverity {
  const severity = asString(value, 80).toLowerCase().replace(/-/g, "_");
  if (severity === "critical") return "critical";
  if (severity === "warning" || severity === "high") return "warning";
  if (severity === "needs_review" || severity === "review_required" || severity === "medium") return "needs_review";
  if (severity === "upcoming") return "upcoming";
  if (severity === "informational" || severity === "info" || severity === "low") return "informational";
  return fallback;
}

function relatedRefs(input: LandlordDecisionQueueRelatedRefs): LandlordDecisionQueueRelatedRefs {
  return {
    propertyId: asString(input.propertyId, 240) || null,
    unitId: asString(input.unitId, 240) || null,
    tenantId: asString(input.tenantId, 240) || null,
    leaseId: asString(input.leaseId, 240) || null,
    maintenanceRequestId: asString(input.maintenanceRequestId, 240) || null,
    noticeId: asString(input.noticeId, 240) || null,
  };
}

function buildItem(input: Omit<LandlordDecisionQueueItem, "sortKey" | "priorityRank">): LandlordDecisionQueueItem {
  const rank = SEVERITY_RANK[input.severity];
  const dueOrDate = input.dueAt || input.updatedAt || input.createdAt || "";
  return {
    ...input,
    priorityRank: rank,
    sortKey: [String(rank).padStart(2, "0"), dueOrDate || "9999-12-31T23:59:59.999Z", input.id].join("|"),
  };
}

export function normalizeDecisionInboxItems(
  landlordId: string,
  items: DecisionInboxItem[] | null | undefined
): LandlordDecisionQueueItem[] {
  return (items || []).map((item) => {
    const sourceId = asString(item.id, 300) || "decision_inbox";
    const workspace = workspaceFromDecisionInbox(item);
    const refs = relatedRefs({
      leaseId: item.relatedEntity?.kind === "lease" ? item.relatedEntity.id : null,
      tenantId: item.relatedEntity?.kind === "tenant" ? item.relatedEntity.id : null,
      propertyId: item.relatedEntity?.kind === "property" ? item.relatedEntity.id : null,
      unitId: item.relatedEntity?.kind === "unit" ? item.relatedEntity.id : null,
      maintenanceRequestId: item.relatedEntity?.kind === "maintenance_request" ? item.relatedEntity.id : null,
    });
    return buildItem({
      id: cleanToken(["decision_queue", "decision_inbox", sourceId].join(":"), "decision_queue:decision_inbox"),
      landlordId,
      sourceType: "decision_inbox",
      sourceId,
      workspace,
      severity: severityFromDecisionInbox(item.severity),
      title: asString(item.title, 180) || "Decision requires review",
      description: asString(item.description, 500) || "Review this decision context.",
      recommendedActionLabel: "Review",
      recommendedActionHref: safeHref(item.destination, "/operations"),
      dueAt: normalizeDate(item.dueAt),
      createdAt: normalizeDate(item.createdAt),
      updatedAt: normalizeDate(item.updatedAt),
      status: statusFromDecisionInbox(item.status),
      dedupeKey: cleanToken(["decision_inbox", item.relatedEntity?.kind || item.type, item.relatedEntity?.id || sourceId].join(":"), sourceId),
      ...refs,
    });
  });
}

export function normalizeUnifiedInboxRecords(
  landlordId: string,
  records: UnifiedInboxPublicRecord[] | null | undefined
): LandlordDecisionQueueItem[] {
  return (records || [])
    .filter((record) => record.audienceRole === "landlord")
    .map((record) => {
      const sourceType = sourceTypeFromUnifiedInbox(record);
      const sourceId = asString(record.id, 300) || "unified_inbox";
      const workspace = workspaceFromUnifiedInbox(record);
      return buildItem({
        id: cleanToken(["decision_queue", sourceType, sourceId].join(":"), "decision_queue:unified_inbox"),
        landlordId,
        sourceType,
        sourceId,
        workspace,
        severity: severityFromUnifiedInbox(record.priority, record.status),
        title: asString(record.title, 180) || "Inbox item requires review",
        description: asString(record.body, 500) || "Review this inbox item.",
        recommendedActionLabel: workspace === "maintenance" ? "Open maintenance" : workspace === "notices" ? "Open notice workflow" : "Open message",
        recommendedActionHref: workspace === "maintenance" ? "/maintenance" : workspace === "notices" ? "/leases" : "/messages",
        dueAt: null,
        createdAt: normalizeDate(record.occurredAt),
        updatedAt: normalizeDate(record.readAt || record.occurredAt),
        status: record.status === "resolved" ? "resolved" : record.status === "archived" ? "dismissed" : "open",
        dedupeKey: cleanToken([sourceType, workspace, sourceId].join(":"), sourceId),
        ...relatedRefs({}),
      });
    })
    .filter((item) => item.severity !== "informational");
}

function normalizeScopedSignals(
  landlordId: string,
  sourceType: LandlordDecisionQueueSourceType,
  fallbackWorkspace: LandlordDecisionQueueWorkspace,
  fallbackSeverity: LandlordDecisionQueueSeverity,
  fallbackActionLabel: string,
  fallbackActionHref: string,
  signals: ScopedSignal[] | null | undefined
): LandlordDecisionQueueItem[] {
  return (signals || [])
    .filter((signal) => scopedToLandlord(signal.landlordId, landlordId))
    .map((signal) => {
      const sourceId = asString(signal.sourceId || signal.id, 300) || sourceType;
      const workspace = normalizeWorkspace(signal.workspace, fallbackWorkspace);
      const refs = relatedRefs(signal);
      return buildItem({
        id: cleanToken(["decision_queue", sourceType, sourceId].join(":"), `decision_queue:${sourceType}`),
        landlordId,
        sourceType,
        sourceId,
        workspace,
        severity: normalizeSeverity(signal.severity, fallbackSeverity),
        title: asString(signal.title, 180) || "Review required",
        description: asString(signal.description, 500) || "Review this operational signal.",
        recommendedActionLabel: asString(signal.recommendedActionLabel, 120) || fallbackActionLabel,
        recommendedActionHref: safeHref(signal.recommendedActionHref, fallbackActionHref),
        dueAt: normalizeDate(signal.dueAt),
        createdAt: normalizeDate(signal.createdAt),
        updatedAt: normalizeDate(signal.updatedAt),
        status: normalizeStatus(signal.status),
        dedupeKey: cleanToken(signal.dedupeKey || [sourceType, workspace, refs.leaseId || refs.tenantId || refs.propertyId || refs.maintenanceRequestId || refs.noticeId || sourceId].join(":"), sourceId),
        ...refs,
      });
    });
}

export function normalizeMessageSignals(
  landlordId: string,
  signals: Array<ScopedSignal & { sourceType?: unknown }> | null | undefined
): LandlordDecisionQueueItem[] {
  return (signals || [])
    .filter((signal) => scopedToLandlord(signal.landlordId, landlordId))
    .map((signal) => {
      const rawSourceType = asString(signal.sourceType, 120) as LandlordDecisionQueueSourceType;
      const sourceType = MESSAGE_SOURCE_TYPES.has(rawSourceType) ? rawSourceType : "message_thread";
      const sourceId = asString(signal.sourceId || signal.id, 300) || sourceType;
      const workspace = normalizeWorkspace(signal.workspace, sourceType === "message_maintenance_follow_up" ? "maintenance" : sourceType === "message_notice_relevance" ? "notices" : "tenant");
      const refs = relatedRefs(signal);
      return buildItem({
        id: cleanToken(["decision_queue", sourceType, sourceId].join(":"), `decision_queue:${sourceType}`),
        landlordId,
        sourceType,
        sourceId,
        workspace,
        severity: normalizeSeverity(signal.severity, sourceType === "message_unread_priority" ? "warning" : "needs_review"),
        title: asString(signal.title, 180) || "Message requires review",
        description: asString(signal.description, 500) || "Review this message thread.",
        recommendedActionLabel: asString(signal.recommendedActionLabel, 120) || "Open message",
        recommendedActionHref: safeHref(signal.recommendedActionHref, "/messages"),
        dueAt: normalizeDate(signal.dueAt),
        createdAt: normalizeDate(signal.createdAt),
        updatedAt: normalizeDate(signal.updatedAt),
        status: normalizeStatus(signal.status),
        dedupeKey: cleanToken(signal.dedupeKey || [sourceType, workspace, refs.tenantId || refs.leaseId || refs.maintenanceRequestId || refs.noticeId || sourceId].join(":"), sourceId),
        ...refs,
      });
    });
}

function dedupeItems(items: LandlordDecisionQueueItem[]): LandlordDecisionQueueItem[] {
  const byKey = new Map<string, LandlordDecisionQueueItem>();
  for (const item of items) {
    const existing = byKey.get(item.dedupeKey);
    if (!existing) {
      byKey.set(item.dedupeKey, item);
      continue;
    }
    const nextRank = item.priorityRank;
    const existingRank = existing.priorityRank;
    const nextDate = item.dueAt || item.updatedAt || item.createdAt || "";
    const existingDate = existing.dueAt || existing.updatedAt || existing.createdAt || "";
    if (nextRank < existingRank || (nextRank === existingRank && nextDate.localeCompare(existingDate) < 0)) {
      byKey.set(item.dedupeKey, item);
    }
  }
  return Array.from(byKey.values());
}

function sortItems(items: LandlordDecisionQueueItem[]): LandlordDecisionQueueItem[] {
  return [...items].sort((a, b) => {
    const rank = a.priorityRank - b.priorityRank;
    if (rank !== 0) return rank;
    const aDue = a.dueAt || "";
    const bDue = b.dueAt || "";
    if (aDue || bDue) return (aDue || "9999-12-31T23:59:59.999Z").localeCompare(bDue || "9999-12-31T23:59:59.999Z");
    const aDate = a.updatedAt || a.createdAt || "";
    const bDate = b.updatedAt || b.createdAt || "";
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return a.id.localeCompare(b.id);
  });
}

export function deriveLandlordDecisionQueue(input: LandlordDecisionQueueInput): LandlordDecisionQueueResult {
  const landlordId = asString(input.landlordId, 240);
  const generatedAt = normalizeDate(input.generatedAt) || new Date().toISOString();
  const items = sortItems(
    dedupeItems([
      ...normalizeDecisionInboxItems(landlordId, input.decisionInboxItems),
      ...normalizeUnifiedInboxRecords(landlordId, input.unifiedInboxRecords),
      ...normalizeScopedSignals(landlordId, "lease_state_coherence", "lease", "critical", "Review lease", "/leases", input.leaseCoherenceSignals),
      ...normalizeScopedSignals(landlordId, "payment_readiness", "payments", "warning", "Review payments", "/leases", input.paymentReadinessSignals),
      ...normalizeScopedSignals(landlordId, "lease_lifecycle", "notices", "upcoming", "Review timeline", "/leases", input.leaseLifecycleSignals),
      ...normalizeScopedSignals(landlordId, "maintenance_readiness", "maintenance", "needs_review", "Review maintenance", "/maintenance", input.maintenanceReadinessSignals),
      ...normalizeScopedSignals(landlordId, "property_action_request", "property", "needs_review", "Review property", "/properties", input.propertyActionRequests),
      ...normalizeMessageSignals(landlordId, input.messageSignals),
    ])
  );

  return {
    version: VERSION,
    landlordId,
    generatedAt,
    items,
    summary: {
      total: items.length,
      critical: items.filter((item) => item.severity === "critical").length,
      warning: items.filter((item) => item.severity === "warning").length,
      needsReview: items.filter((item) => item.severity === "needs_review").length,
      upcoming: items.filter((item) => item.severity === "upcoming").length,
      informational: items.filter((item) => item.severity === "informational").length,
      open: items.filter((item) => item.status === "open").length,
      blocked: items.filter((item) => item.status === "blocked").length,
    },
  };
}
