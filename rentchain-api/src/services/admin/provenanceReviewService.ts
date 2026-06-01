import {
  getProvenanceChain,
  queryProvenanceEvents,
  type FirestoreLike,
  type ProvenanceAuthority,
} from "../stateMachines/provenanceStorage";
import type {
  ActorRole,
  EvidenceChain,
  EvidenceReference,
  ReviewWorkflowType,
  TransitionProvenanceEvent,
} from "../stateMachines/types";

export type ProvenanceReviewRole = "admin" | "support" | "landlord";

export type ProvenanceReviewEvent = {
  eventId: string;
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  fromState: string;
  toState: string;
  event: string;
  outcome: "valid" | "invalid";
  reason: string | null;
  actorRole: ActorRole;
  occurredAt: string;
  evidenceRefs: EvidenceReference[];
  metadataOnly: true;
  redactionSummary: string;
};

export type ProvenanceReviewChain = {
  workflowType: ReviewWorkflowType;
  workflowInstanceKey: string;
  events: ProvenanceReviewEvent[];
  metadataOnly: true;
};

export type ProvenanceReviewQuery = {
  workflowType?: ReviewWorkflowType;
  workflowInstanceId?: string;
  actorRole?: ActorRole;
  outcome?: "valid" | "invalid";
  from?: string;
  to?: string;
  role: ProvenanceReviewRole;
  landlordRef?: string | null;
  firestore?: FirestoreLike;
};

function authorityFor(input: { role: ProvenanceReviewRole; landlordRef?: string | null }): ProvenanceAuthority {
  return {
    actorRole: input.role,
    landlordRef: input.landlordRef || null,
    supportAllowed: input.role === "support",
  };
}

function projectEvent(event: TransitionProvenanceEvent, role: ProvenanceReviewRole): ProvenanceReviewEvent {
  return {
    eventId: event.eventId,
    workflowType: event.workflowType,
    workflowInstanceKey: event.workflowInstanceKey,
    fromState: event.transition.from,
    toState: event.transition.to,
    event: event.transition.event,
    outcome: event.transition.outcome,
    reason: role === "support" ? event.transition.reason : event.transition.reason,
    actorRole: event.actor.actorRole,
    occurredAt: event.occurredAt,
    evidenceRefs: event.evidenceRefs,
    metadataOnly: true,
    redactionSummary: event.redactionSummary,
  };
}

function projectChain(chain: EvidenceChain, role: ProvenanceReviewRole): ProvenanceReviewChain {
  return {
    workflowType: chain.workflowType,
    workflowInstanceKey: chain.workflowInstanceKey,
    events: chain.events.map((event) => projectEvent(event, role)),
    metadataOnly: true,
  };
}

export async function loadProvenanceReviewChain(input: {
  workflowType: ReviewWorkflowType;
  workflowInstanceId: string;
  role: ProvenanceReviewRole;
  landlordRef?: string | null;
  firestore?: FirestoreLike;
}): Promise<ProvenanceReviewChain> {
  const chain = await getProvenanceChain({
    workflowType: input.workflowType,
    workflowInstanceId: input.workflowInstanceId,
    authority: authorityFor(input),
    firestore: input.firestore,
  });
  return projectChain(chain, input.role);
}

export async function queryProvenanceReviewEvents(input: ProvenanceReviewQuery): Promise<ProvenanceReviewEvent[]> {
  const events = await queryProvenanceEvents({
    workflowType: input.workflowType,
    workflowInstanceId: input.workflowInstanceId,
    actorRole: input.actorRole,
    outcome: input.outcome,
    from: input.from,
    to: input.to,
    authority: authorityFor(input),
    firestore: input.firestore,
  });
  return events.map((event) => projectEvent(event, input.role));
}
