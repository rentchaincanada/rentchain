import { apiFetch } from "./apiFetch";

export type RenewalContinuityReason =
  | "RENEWAL_LINK_MISSING"
  | "RENEWAL_LINK_CONFLICT"
  | "RENEWAL_CONTEXT_MISMATCH"
  | "RENEWAL_TERM_NOT_CONTIGUOUS"
  | "RENEWAL_TOO_EARLY"
  | "RENEWAL_EXECUTION_INCOMPLETE"
  | "RENEWAL_PARTICIPANTS_MISMATCH"
  | "RENEWAL_PREDECESSOR_NOT_CURRENT"
  | "RENEWAL_SUCCESSOR_INELIGIBLE"
  | "RENEWAL_SUCCESSOR_SUPERSEDED"
  | "MULTIPLE_RENEWAL_SUCCESSORS"
  | "MULTIPLE_CURRENT_LEASES"
  | "RENEWAL_PROJECTION_MISMATCH";

export type RenewalContinuityContext = {
  expectedStateToken: string;
  evaluationInstant: string;
  predecessorLeaseId: string;
  successorLeaseId: string;
  propertyId: string;
  unitId: string;
  participantIds: string[];
  predecessorCanonicalState: string;
  successorCanonicalState: string;
  termContinuity: boolean;
  executionReady: boolean;
  handoffEligible: boolean;
  blockingReasons: RenewalContinuityReason[];
};

export function getRenewalContinuityContext(successorLeaseId: string) {
  return apiFetch<{ ok: true; context: RenewalContinuityContext }>(
    `/leases/renewals/${encodeURIComponent(successorLeaseId)}/context`
  );
}

export function activateRenewalContinuity(
  successorLeaseId: string,
  input: Pick<RenewalContinuityContext, "expectedStateToken" | "evaluationInstant">,
  idempotencyKey: string
) {
  return apiFetch<{
    ok: true;
    result: {
      outcome: "renewal_handoff_completed" | "idempotent_replay";
      predecessorLeaseId: string;
      successorLeaseId: string;
      auditEventIds: string[];
    };
  }>(`/leases/renewals/${encodeURIComponent(successorLeaseId)}/activate`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: input,
  });
}
