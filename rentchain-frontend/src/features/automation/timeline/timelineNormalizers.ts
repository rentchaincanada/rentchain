import type { Conversation } from "@/api/messagesApi";
import type { PaymentRecord } from "@/api/paymentsApi";
import type { RentalApplicationSummary, ScreeningPipeline } from "@/api/rentalApplicationsApi";
import type { Lease } from "@/api/leasesApi";
import type { LedgerEventV2 } from "@/api/ledgerV2";
import type { ActionRequest } from "@/api/actionRequestsApi";
import type { AutomationEvent, AutomationEventType } from "./automationTimeline.types";

export type TimelineSourceKey =
  | "ledgerV2"
  | "payments"
  | "leases"
  | "applications"
  | "messages"
  | "actionRequests"
  | "unknown";

function toIso(input: unknown): { iso: string; missingTimestamp: boolean } {
  if (typeof input === "string" && input.trim()) {
    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) {
      return { iso: date.toISOString(), missingTimestamp: false };
    }
  }

  if (typeof input === "number" && Number.isFinite(input)) {
    const ms = input < 1e12 ? input * 1000 : input;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      return { iso: date.toISOString(), missingTimestamp: false };
    }
  }

  return { iso: new Date().toISOString(), missingTimestamp: true };
}

function eventWithMeta(
  source: string,
  type: AutomationEventType,
  id: string,
  title: string,
  occurredAtInput: unknown,
  event: Omit<AutomationEvent, "id" | "type" | "title" | "occurredAt" | "metadata">
): AutomationEvent {
  const { iso, missingTimestamp } = toIso(occurredAtInput);
  return {
    id,
    type,
    title,
    occurredAt: iso,
    ...event,
    metadata: {
      source,
      ...(missingTimestamp ? { missingTimestamp: true } : {}),
      ...(event.metadata || {}),
    },
  };
}

export function normalizeRentalApplicationSummary(
  applications: RentalApplicationSummary[],
  source = "rentalApplicationsApi.fetchRentalApplications"
): AutomationEvent[] {
  return applications.map((application) =>
    eventWithMeta(
      source,
      "TENANT",
      `applications:${application.id}:status:${application.status}`,
      `Application ${String(application.status || "updated").toLowerCase()}`,
      application.submittedAt,
      {
        summary: `${application.applicantName} application status: ${application.status}`,
        entity: {
          propertyId: application.propertyId || undefined,
          unitId: application.unitId || undefined,
          applicationId: application.id,
        },
      }
    )
  );
}

export function normalizeScreeningPipeline(
  applicationId: string,
  screening: ScreeningPipeline,
  source = "rentalApplicationsApi.fetchScreening"
): AutomationEvent[] {
  if (!screening?.status) return [];

  const labelByStatus: Record<string, string> = {
    unpaid: "Screening pending payment",
    paid: "Screening paid",
    processing: "Screening in progress",
    complete: "Screening completed",
    failed: "Screening failed",
    ineligible: "Screening ineligible",
  };

  const occurredAt =
    screening.completedAt ||
    screening.startedAt ||
    screening.paidAt ||
    screening.lastUpdatedAt;

  return [
    eventWithMeta(
      source,
      "SCREENING",
      `screening:${applicationId}:${screening.status}`,
      labelByStatus[screening.status] || "Screening updated",
      occurredAt,
      {
        summary: screening.summary?.overall
          ? `Screening result: ${screening.summary.overall}`
          : undefined,
        entity: {
          applicationId,
        },
      }
    ),
  ];
}

export function normalizePayments(
  payments: PaymentRecord[],
  source = "paymentsApi.fetchPayments"
): AutomationEvent[] {
  return payments.map((payment) =>
    eventWithMeta(
      source,
      "PAYMENT",
      `payments:${payment.id}`,
      "Rent payment recorded",
      payment.paidAt || payment.updatedAt || payment.createdAt,
      {
        summary:
          typeof payment.amount === "number"
            ? `Payment amount: $${payment.amount.toFixed(2)}`
            : undefined,
        entity: {
          propertyId: payment.propertyId || undefined,
          tenantId: payment.tenantId || undefined,
          paymentId: payment.id,
        },
      }
    )
  );
}

export function normalizeLeases(
  leases: Lease[],
  source = "leasesApi.getLeasesForProperty"
): AutomationEvent[] {
  return leases.map((lease) =>
    eventWithMeta(
      source,
      "LEASE",
      `leases:${lease.id}:${lease.status}`,
      "Lease updated",
      lease.updatedAt || lease.createdAt,
      {
        summary: `Lease ${lease.status} for unit ${lease.unitNumber}`,
        entity: {
          propertyId: lease.propertyId || undefined,
          tenantId: lease.tenantId || undefined,
          leaseId: lease.id,
        },
      }
    )
  );
}

export function normalizeConversations(
  conversations: Conversation[],
  source = "messagesApi.fetchLandlordConversations"
): AutomationEvent[] {
  return conversations.map((conversation) =>
    eventWithMeta(
      source,
      "MESSAGE",
      `messages:${conversation.id}`,
      "Conversation activity",
      conversation.lastMessageAt || conversation.createdAt,
      {
        summary: conversation.hasUnread ? "Unread message in conversation." : "Conversation updated.",
        entity: {
          unitId: conversation.unitId || undefined,
          tenantId: conversation.tenantId || undefined,
        },
      }
    )
  );
}

export function normalizeActionRequests(
  requests: ActionRequest[],
  source = "actionRequestsApi.listActionRequests"
): AutomationEvent[] {
  return requests.map((request) =>
    eventWithMeta(
      source,
      "PROPERTY",
      `actionRequests:${request.id}:${request.status || "new"}`,
      request.title || "Property action request",
      request.updatedAt || request.createdAt,
      {
        summary: request.description || request.issueType || undefined,
        entity: {
          propertyId: request.propertyId || undefined,
          unitId: request.unitId || undefined,
          tenantId: request.tenantId || undefined,
        },
      }
    )
  );
}

function mapLedgerType(type: string): AutomationEventType {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("screen")) return "SCREENING";
  if (normalized.includes("payment") || normalized.includes("charge")) return "PAYMENT";
  if (normalized.includes("lease") || normalized.includes("notice")) return "LEASE";
  if (normalized.includes("message") || normalized.includes("conversation")) return "MESSAGE";
  if (normalized.includes("tenant") || normalized.includes("application")) return "TENANT";
  if (normalized.includes("property") || normalized.includes("maintenance")) return "PROPERTY";
  return "SYSTEM";
}

export function normalizeLedgerV2Events(
  events: LedgerEventV2[],
  source = "ledgerV2.listLedgerV2"
): AutomationEvent[] {
  return events.map((event) =>
    eventWithMeta(
      source,
      mapLedgerType(event.eventType),
      `ledgerV2:${event.id}`,
      event.title || "Ledger event",
      event.occurredAt || event.createdAt,
      {
        summary: event.summary,
        entity: {
          propertyId: event.propertyId,
          unitId: event.unitId,
          tenantId: event.tenantId,
          leaseId: event.leaseId,
          paymentId: event.paymentId,
        },
      }
    )
  );
}

export function getTimelineSourceKey(event: AutomationEvent): TimelineSourceKey {
  const source = String((event.metadata as Record<string, unknown> | undefined)?.source || "").toLowerCase();
  if (source.includes("ledgerv2")) return "ledgerV2";
  if (source.includes("paymentsapi")) return "payments";
  if (source.includes("leasesapi")) return "leases";
  if (source.includes("rentalapplicationsapi")) return "applications";
  if (source.includes("messagesapi")) return "messages";
  if (source.includes("actionrequestsapi")) return "actionRequests";
  return "unknown";
}

const sourcePriority: Record<TimelineSourceKey, number> = {
  ledgerV2: 0,
  payments: 1,
  leases: 2,
  applications: 3,
  messages: 4,
  actionRequests: 5,
  unknown: 6,
};

export function getTimelineSourcePriority(source: TimelineSourceKey): number {
  return sourcePriority[source] ?? sourcePriority.unknown;
}

export function toTwoMinuteBucketIso(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return new Date(0).toISOString();
  const bucketMs = 2 * 60 * 1000;
  const bucketed = Math.floor(time / bucketMs) * bucketMs;
  return new Date(bucketed).toISOString();
}

export function buildEventFingerprint(event: AutomationEvent): string {
  const roundedTime = toTwoMinuteBucketIso(event.occurredAt);
  const entity = event.entity || {};
  return [
    event.type,
    roundedTime,
    String(entity.propertyId || ""),
    String(entity.unitId || ""),
    String(entity.tenantId || ""),
    String(entity.applicationId || ""),
    String(entity.leaseId || ""),
    String(entity.paymentId || ""),
  ].join("|");
}
