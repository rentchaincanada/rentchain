import { ReputationTimelineEvent } from "../types/models";
import { getLedgerEventsByTenant } from "./ledgerEventsService";
import { listActionRequests } from "./actionRequestsService";

export async function getTenantReputationTimeline(
  landlordId: string,
  tenantId: string
): Promise<ReputationTimelineEvent[]> {
  const events: ReputationTimelineEvent[] = [];

  const ledgerEvents = await getLedgerEventsByTenant(landlordId, tenantId);

  for (const le of ledgerEvents) {
    let type: ReputationTimelineEvent["type"] | null = null;
    let title = "Activity";
    let detail: string | undefined;

    if (le.type.startsWith("payment")) {
      type = "payment";
      title = "Payment recorded";
      detail = le.amountDelta ? `$${Math.abs(le.amountDelta)}` : undefined;
    } else if (le.type === "charge_posted" || le.type === "credit_applied") {
      type = "charge";
      title = le.type === "charge_posted" ? "Charge posted" : "Credit applied";
      detail = le.amountDelta ? `$${Math.abs(le.amountDelta)}` : undefined;
    } else if (le.reference?.kind === "screening") {
      type = "screening";
      title = "Screening activity";
    }

    if (type) {
      events.push({
        id: le.id,
        landlordId,
        tenantId,
        propertyId: (le as any).propertyId,
        unitId: (le as any).unitId,
        type,
        title,
        detail,
        occurredAt: le.occurredAt,
        meta: le.reference,
      });
    }
  }

  const actionRequests = await listActionRequests({
    landlordId,
  });

  for (const ar of actionRequests) {
    if (ar.tenantId !== tenantId) continue;

    events.push({
      id: `${ar.id}:reported`,
      landlordId,
      tenantId,
      propertyId: ar.propertyId,
      unitId: ar.unitId,
      type: "maintenance_reported",
      title: "Issue reported",
      detail: `${ar.issueType} (${ar.severity}, ${ar.location})`,
      occurredAt: ar.reportedAt,
      meta: {
        issueType: ar.issueType,
        severity: ar.severity,
        location: ar.location,
      },
    });

    if (ar.acknowledgedAt) {
      events.push({
        id: `${ar.id}:ack`,
        landlordId,
        tenantId,
        propertyId: ar.propertyId,
        unitId: ar.unitId,
        type: "action_acknowledged",
        title: "Issue acknowledged",
        occurredAt: ar.acknowledgedAt,
      });
    }

    if (ar.resolvedAt) {
      events.push({
        id: `${ar.id}:resolved`,
        landlordId,
        tenantId,
        propertyId: ar.propertyId,
        unitId: ar.unitId,
        type: "action_resolved",
        title: "Issue resolved",
        occurredAt: ar.resolvedAt,
      });
    }
  }

  events.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return events.slice(0, 200);
}
