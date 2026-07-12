import type { DecisionInboxItem } from "../../lib/decisions/decisionInboxTypes";
import type { UnifiedInboxPublicRecord } from "../unifiedInbox/types";

export type LandlordDecisionQueueSeverity =
  | "critical"
  | "warning"
  | "needs_review"
  | "upcoming"
  | "informational";

export type LandlordDecisionQueueWorkspace =
  | "dashboard"
  | "operations"
  | "tenant"
  | "lease"
  | "property"
  | "maintenance"
  | "payments"
  | "notices"
  | "evidence_compliance";

export type LandlordDecisionQueueSourceType =
  | "renewal_notice_send_review"
  | "application_review"
  | "evidence_review"
  | "decision_inbox"
  | "lease_state_coherence"
  | "payment_obligation"
  | "payment_readiness"
  | "lease_lifecycle"
  | "maintenance_readiness"
  | "property_action_request"
  | "message_thread"
  | "message_unread_priority"
  | "message_notice_relevance"
  | "message_maintenance_follow_up"
  | "message_support_escalation"
  | "unified_inbox_event";

export type LandlordDecisionQueueStatus =
  | "open"
  | "acknowledged"
  | "in_review"
  | "pending"
  | "blocked"
  | "approved"
  | "returned"
  | "deferred"
  | "resolved"
  | "dismissed";

export type LandlordDecisionQueueAssignment = {
  assignedToUserId: string | null;
  assignedToEmail: string | null;
  assignmentLabel: string | null;
};

export type LandlordDecisionQueueRelatedRefs = {
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  maintenanceRequestId?: string | null;
  noticeId?: string | null;
};

export type LandlordDecisionQueueItem = LandlordDecisionQueueRelatedRefs & {
  id: string;
  landlordId: string;
  persistence?: "derived" | "persisted";
  sourceType: LandlordDecisionQueueSourceType;
  sourceId: string;
  sourceRoute?: string | null;
  workspace: LandlordDecisionQueueWorkspace;
  severity: LandlordDecisionQueueSeverity;
  title: string;
  description: string;
  recommendedActionLabel: string;
  recommendedActionHref: string;
  dueAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  status: LandlordDecisionQueueStatus;
  assignment?: LandlordDecisionQueueAssignment | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  lastActionAt?: string | null;
  lastActionBy?: string | null;
  sourceSnapshot?: Record<string, unknown> | null;
  auditEventIds?: string[];
  metadata?: Record<string, unknown> | null;
  dedupeKey: string;
  sortKey: string;
  priorityRank: number;
};

export type LandlordDecisionQueueSummary = {
  total: number;
  critical: number;
  warning: number;
  needsReview: number;
  upcoming: number;
  informational: number;
  open: number;
  blocked: number;
};

export type LandlordDecisionQueueResult = {
  version: "landlord_decision_queue_v1";
  landlordId: string;
  generatedAt: string;
  items: LandlordDecisionQueueItem[];
  summary: LandlordDecisionQueueSummary;
};

export type ScopedSignal = LandlordDecisionQueueRelatedRefs & {
  id?: unknown;
  landlordId?: unknown;
  sourceId?: unknown;
  severity?: unknown;
  status?: unknown;
  workspace?: unknown;
  title?: unknown;
  description?: unknown;
  recommendedActionLabel?: unknown;
  recommendedActionHref?: unknown;
  dueAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  dedupeKey?: unknown;
};

export type LandlordDecisionQueueInput = {
  landlordId: string;
  generatedAt?: string | null;
  decisionInboxItems?: DecisionInboxItem[] | null;
  unifiedInboxRecords?: UnifiedInboxPublicRecord[] | null;
  leaseCoherenceSignals?: ScopedSignal[] | null;
  paymentReadinessSignals?: ScopedSignal[] | null;
  leaseLifecycleSignals?: ScopedSignal[] | null;
  maintenanceReadinessSignals?: ScopedSignal[] | null;
  propertyActionRequests?: ScopedSignal[] | null;
  messageSignals?: Array<ScopedSignal & { sourceType?: unknown }> | null;
};
