import { buildEvidenceReference, compactEvidenceRefs, readRecordId } from "../evidenceProvenance";
import type { EvidenceReference, RecordLike, ScreeningContext } from "../types";

export function buildScreeningEvidence(input: {
  application?: RecordLike | null;
  order?: RecordLike | null;
  transaction?: RecordLike | null;
  result?: RecordLike | null;
  context?: ScreeningContext;
}): EvidenceReference[] {
  return compactEvidenceRefs([
    buildEvidenceReference({
      workflowType: "screening",
      referenceType: "application",
      referenceId: input.context?.applicationId || readRecordId(input.application, ["id", "applicationId"]),
      label: "screening application state",
    }),
    buildEvidenceReference({
      workflowType: "screening",
      referenceType: "order",
      referenceId: input.context?.orderId || readRecordId(input.order, ["id", "orderId"]),
      label: "screening order state",
    }),
    buildEvidenceReference({
      workflowType: "screening",
      referenceType: "transaction",
      referenceId: readRecordId(input.transaction, ["id", "transactionId", "paymentId"]),
      label: "screening transaction status",
    }),
    buildEvidenceReference({
      workflowType: "screening",
      referenceType: "result",
      referenceId: input.context?.resultId || readRecordId(input.result, ["id", "resultId"]),
      label: "screening result availability",
    }),
  ]);
}
