import { writeCanonicalEvent } from "../../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";
import type { LandlordAgentDecision } from "../../lib/analytics/analyticsTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function decisionAppearanceEventId(landlordId: string, decisionId: string) {
  return `decision_appeared__${landlordId}__${decisionId}`.replace(/[\/\s]+/g, "_");
}

function isDecisionAppearanceEvent(event: CanonicalEventV1, landlordId: string, decisionId: string) {
  if (asString(event.type, 120) !== "decision.appeared") return false;
  if (asString(event.resource?.type, 120) !== "analytics_decision") return false;
  if (asString(event.resource?.id, 240) !== decisionId) return false;
  if (asString(event.metadata?.landlordId, 240) !== landlordId) return false;
  return asString(event.metadata?.decisionId, 240) === decisionId;
}

export async function emitLandlordDecisionAppearanceEvents(params: {
  landlordId: string;
  decisions: LandlordAgentDecision[];
  canonicalEvents: CanonicalEventV1[];
  occurredAt: string;
}): Promise<void> {
  const landlordId = asString(params.landlordId, 240);
  if (!landlordId) return;

  const seenDecisionIds = new Set<string>();
  for (const event of params.canonicalEvents || []) {
    const decisionId = asString(event.metadata?.decisionId, 240);
    if (!decisionId) continue;
    if (!isDecisionAppearanceEvent(event, landlordId, decisionId)) continue;
    seenDecisionIds.add(decisionId);
  }

  for (const decision of params.decisions || []) {
    const decisionId = asString(decision.id, 240);
    if (!decisionId || seenDecisionIds.has(decisionId)) continue;
    seenDecisionIds.add(decisionId);

    await writeCanonicalEvent({
      id: decisionAppearanceEventId(landlordId, decisionId),
      type: "decision.appeared",
      domain: "system",
      action: "appeared",
      actor: { type: "system", id: "system", role: "system" },
      resource: { type: "analytics_decision", id: decisionId },
      occurredAt: params.occurredAt,
      visibility: "landlord",
      summary: `Analytics decision ${decisionId} appeared.`,
      metadata: {
        landlordId,
        decisionId,
        decisionType: decision.decisionType,
        source: "landlord_analytics_decisions",
      },
    });
  }
}
