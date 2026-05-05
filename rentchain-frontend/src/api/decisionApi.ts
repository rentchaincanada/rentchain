import { apiFetch } from "./apiFetch";
import type { DecisionActionType, DecisionItem } from "@/lib/decisions/decisionDisplay";

export type DecisionActionPayload = {
  leaseId: string;
  actionType: DecisionActionType;
  note?: string | null;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
  decision?: DecisionItem;
};

export async function patchDecisionAction(decisionId: string, payload: DecisionActionPayload) {
  return apiFetch(`/decisions/${encodeURIComponent(decisionId)}/action`, {
    method: "PATCH",
    body: payload,
  });
}

export async function getLeaseDecisions(leaseId: string) {
  return apiFetch(`/decisions?leaseId=${encodeURIComponent(leaseId)}`, {
    method: "GET",
  });
}
