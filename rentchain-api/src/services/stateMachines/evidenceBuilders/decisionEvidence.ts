import { buildEvidenceReference, compactEvidenceRefs, readRecordId } from "../evidenceProvenance";
import type { DecisionContext, EvidenceReference, RecordLike } from "../types";

export function buildDecisionEvidence(input: {
  decisionAction?: RecordLike | null;
  context?: DecisionContext;
}): EvidenceReference[] {
  return compactEvidenceRefs([
    buildEvidenceReference({
      workflowType: "decision",
      referenceType: "decision",
      referenceId: input.context?.decisionId || readRecordId(input.decisionAction, ["decisionId", "id"]),
      label: "decision source state",
    }),
    buildEvidenceReference({
      workflowType: "decision",
      referenceType: "action",
      referenceId:
        input.context?.actionRecordExists === true
          ? input.context.decisionId || readRecordId(input.decisionAction, ["decisionId", "id"])
          : null,
      label: "decision action record",
    }),
    buildEvidenceReference({
      workflowType: "decision",
      referenceType: "source",
      referenceId:
        input.context?.sourceValid === true
          ? input.context.decisionId || readRecordId(input.decisionAction, ["decisionId", "id"])
          : null,
      label: "decision source validity",
    }),
  ]);
}
