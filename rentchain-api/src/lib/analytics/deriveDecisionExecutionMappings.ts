import type { LandlordAgentDecision, LandlordDecisionExecutionMapping } from "./analyticsTypes";
import { deriveLeaseNoticeExecutionInputSnapshot, normalizeLeaseRecord } from "../../services/leaseNoticeWorkflowService";

type MappingInput = {
  decisions: LandlordAgentDecision[];
  leases: any[];
  now: number;
};

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function toMillis(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
  if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function isActiveLease(lease: any, now: number) {
  const status = asString(lease?.status, 80).toLowerCase();
  if (status === "active" || status === "current") return true;
  const startAt = toMillis(lease?.leaseStartDate) || toMillis(lease?.startDate) || toMillis(lease?.leaseStart);
  const endAt =
    toMillis(lease?.leaseEndDate) || toMillis(lease?.endDate) || toMillis(lease?.leaseEnd) || toMillis(lease?.moveOutDate);
  if (startAt != null && startAt > now) return false;
  if (endAt != null && endAt < now) return false;
  return startAt != null || endAt != null;
}

function leaseEndsWithin30Days(lease: any, now: number) {
  const endAt =
    toMillis(lease?.leaseEndDate) || toMillis(lease?.endDate) || toMillis(lease?.leaseEnd) || toMillis(lease?.moveOutDate);
  if (endAt == null || endAt < now) return false;
  return endAt <= now + 30 * 24 * 60 * 60 * 1000;
}

function decisionPropertyId(decision: LandlordAgentDecision) {
  const prefix = `${decision.decisionType}:`;
  return decision.id.startsWith(prefix) ? decision.id.slice(prefix.length) || null : null;
}

function baseDecision(decision: LandlordAgentDecision, mapping: LandlordDecisionExecutionMapping | null): LandlordAgentDecision {
  return {
    ...decision,
    automationEligible: false,
    executionMappingState: mapping ? "mapped" : "none",
    executionMapping: mapping,
    executionInputState: "none",
    executionInputReason: null,
    executionInputMissingFields: [],
    executionInput: null,
  };
}

function mapLeaseRenewalDecision(decision: LandlordAgentDecision, input: MappingInput): LandlordAgentDecision {
  const propertyId = decisionPropertyId(decision);
  const candidateLeases = (input.leases || []).filter((lease) => {
    if (!isActiveLease(lease, input.now)) return false;
    if (!leaseEndsWithin30Days(lease, input.now)) return false;
    if (propertyId && asString(lease?.propertyId, 240) !== propertyId) return false;
    return true;
  });

  if (candidateLeases.length !== 1) {
    return baseDecision(decision, null);
  }

  const rawLease = candidateLeases[0];
  const lease = normalizeLeaseRecord(asString(rawLease?.id, 240), rawLease);
  if (asString(lease?.latestNoticeId, 240)) {
    return baseDecision(decision, null);
  }

  const executionInput = deriveLeaseNoticeExecutionInputSnapshot(lease);

  const mapping: LandlordDecisionExecutionMapping = {
    action: "lease.auto_send_notice",
    resourceType: "lease",
    resourceId: asString(lease.id, 240),
    prerequisitesMet: executionInput.state === "complete",
    prerequisiteReason: executionInput.reason,
  };

  return {
    ...decision,
    automationEligible: executionInput.state === "complete",
    executionMappingState: "mapped",
    executionMapping: mapping,
    executionInputState: executionInput.state,
    executionInputReason: executionInput.reason,
    executionInputMissingFields: executionInput.missingFields,
    executionInput: executionInput.input,
  };
}

export function applyDecisionExecutionMappings(input: MappingInput): LandlordAgentDecision[] {
  return input.decisions.map((decision) => {
    if (decision.decisionType === "review_lease_renewals") {
      return mapLeaseRenewalDecision(decision, input);
    }

    return baseDecision(decision, null);
  });
}
