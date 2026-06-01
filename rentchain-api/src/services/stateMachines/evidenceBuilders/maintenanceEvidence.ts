import { buildEvidenceReference, compactEvidenceRefs, readRecordId } from "../evidenceProvenance";
import type { EvidenceReference, MaintenanceContext, RecordLike } from "../types";

export function buildMaintenanceEvidence(input: {
  workOrder?: RecordLike | null;
  context?: MaintenanceContext;
}): EvidenceReference[] {
  const workOrder = input.workOrder || {};
  return compactEvidenceRefs([
    buildEvidenceReference({
      workflowType: "maintenance",
      referenceType: "work_order",
      referenceId: input.context?.workOrderId || readRecordId(workOrder, ["id", "workOrderId", "requestId"]),
      label: "maintenance request state",
    }),
    buildEvidenceReference({
      workflowType: "maintenance",
      referenceType: "cost",
      referenceId: input.context?.costTotalCents != null ? `${input.context.workOrderId || readRecordId(workOrder, ["id"])}:cost` : null,
      label: "maintenance cost review context",
    }),
    buildEvidenceReference({
      workflowType: "maintenance",
      referenceType: "attachment",
      referenceId:
        input.context?.evidenceCount != null
          ? `${input.context.workOrderId || readRecordId(workOrder, ["id"])}:evidence:${input.context.evidenceCount}`
          : null,
      label: "maintenance completion evidence count",
    }),
  ]);
}
