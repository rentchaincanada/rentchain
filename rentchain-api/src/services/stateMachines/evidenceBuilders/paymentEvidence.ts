import { buildEvidenceReference, compactEvidenceRefs, readRecordId } from "../evidenceProvenance";
import type { EvidenceReference, PaymentContext, RecordLike } from "../types";

export function buildPaymentEvidence(input: { payment?: RecordLike | null; context?: PaymentContext }): EvidenceReference[] {
  return compactEvidenceRefs([
    buildEvidenceReference({
      workflowType: "payment",
      referenceType: "payment",
      referenceId: input.context?.paymentId || readRecordId(input.payment, ["id", "paymentId"]),
      label: "payment record state",
    }),
    buildEvidenceReference({
      workflowType: "payment",
      referenceType: "provider_status",
      referenceId:
        input.context?.providerStatus && (input.context?.paymentId || readRecordId(input.payment, ["id", "paymentId"]))
          ? `${input.context.paymentId || readRecordId(input.payment, ["id", "paymentId"])}:${input.context.providerStatus}`
          : null,
      label: "payment provider status",
    }),
  ]);
}
