import { appendCanonicalAuditEventSafely, type CanonicalAuditFirestoreLike } from "./appendCanonicalAuditEvent";
import type { CanonicalAuditAuthorityRole } from "../../types/canonicalAuditEvent";
import type { ActorRole, TransitionProvenanceEvent } from "../../services/stateMachines/types";

type ReviewStateTransitionAuditAuthority = {
  actorRole: ActorRole;
  landlordRef?: string | null;
};

function auditRole(role: ActorRole): CanonicalAuditAuthorityRole {
  if (role === "admin" || role === "support" || role === "landlord" || role === "system") return role;
  return "system";
}

/**
 * Emits a canonical audit event for an existing state-machine provenance event.
 * The state transition remains advisory; this helper only records validated metadata.
 */
export async function appendReviewStateTransitionAuditEvent(input: {
  provenanceEvent: TransitionProvenanceEvent;
  authority: ReviewStateTransitionAuditAuthority;
  firestore?: CanonicalAuditFirestoreLike;
}) {
  const role = auditRole(input.authority.actorRole);
  return appendCanonicalAuditEventSafely(
    {
      eventType: "review_state_transitioned",
      actor: {
        role,
        operatorRef: input.provenanceEvent.actor.actorRef,
        rawIdsIncluded: false,
      },
      authority: {
        role,
        landlordRef: input.authority.landlordRef || input.provenanceEvent.access.landlordRef || null,
        supportAllowed: role === "support",
        rawIdsIncluded: false,
      },
      sourceReferenceId: input.provenanceEvent.workflowInstanceKey,
      timestamp: input.provenanceEvent.occurredAt,
      metadata: {
        workflowType: input.provenanceEvent.workflowType,
        workflowInstanceKey: input.provenanceEvent.workflowInstanceKey,
        fromState: input.provenanceEvent.transition.from,
        toState: input.provenanceEvent.transition.to,
        transitionEvent: input.provenanceEvent.transition.event,
        transitionReason: input.provenanceEvent.transition.reason,
        validationOutcome: input.provenanceEvent.transition.outcome === "valid" ? "valid" : "invalid",
        metadataOnly: true,
        rawIdsIncluded: false,
      },
    },
    { firestore: input.firestore }
  );
}
