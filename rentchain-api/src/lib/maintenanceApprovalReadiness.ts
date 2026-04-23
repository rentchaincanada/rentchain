import {
  normalizeCostCurrency,
  normalizeCostLinkStatus,
  normalizeCostReviewStatus,
  normalizeWorkOrderCost,
  type WorkOrderCostLinkStatus,
  type WorkOrderCostReviewStatus,
} from "./maintenanceCost";
import { MAINTENANCE_AUTO_APPROVAL_THRESHOLD_CENTS } from "./policy/policyRules";

export type MaintenanceApprovalExecutionInputMissingField =
  | "actualCostCents"
  | "reviewStatus"
  | "supportingEvidence"
  | "autoApprovalThreshold";

export type MaintenanceApprovalExecutionInput = {
  actualCostCents: number | null;
  currency: string | null;
  reviewStatus: WorkOrderCostReviewStatus | null;
  linkedExpenseStatus: WorkOrderCostLinkStatus | null;
  hasSupportingEvidence: boolean;
  thresholdCents: number;
  withinAutoApprovalThreshold: boolean;
};

export type MaintenanceApprovalExecutionInputSnapshot = {
  state: "none" | "partial" | "complete";
  reason: string | null;
  missingFields: MaintenanceApprovalExecutionInputMissingField[];
  input: MaintenanceApprovalExecutionInput;
};

export function hasSupportingEvidenceForWorkOrder(workOrder: any) {
  const evidence = Array.isArray(workOrder?.evidence) ? workOrder.evidence : [];
  const costAttachments = Array.isArray(workOrder?.costAttachments) ? workOrder.costAttachments : [];
  return evidence.length > 0 || costAttachments.length > 0;
}

export function deriveMaintenanceApprovalExecutionInputSnapshot(
  workOrder: any
): MaintenanceApprovalExecutionInputSnapshot {
  const cost = normalizeWorkOrderCost(workOrder?.cost);
  const actualCostCents = typeof cost?.actualCostCents === "number" ? cost.actualCostCents : null;
  const reviewStatus = normalizeCostReviewStatus(cost?.reviewStatus);
  const hasSupportingEvidence = hasSupportingEvidenceForWorkOrder(workOrder);
  const withinAutoApprovalThreshold =
    typeof actualCostCents === "number" && actualCostCents > 0
      ? actualCostCents <= MAINTENANCE_AUTO_APPROVAL_THRESHOLD_CENTS
      : false;

  const input: MaintenanceApprovalExecutionInput = {
    actualCostCents,
    currency: normalizeCostCurrency(cost?.currency),
    reviewStatus,
    linkedExpenseStatus: normalizeCostLinkStatus(cost?.linkedExpenseStatus),
    hasSupportingEvidence,
    thresholdCents: MAINTENANCE_AUTO_APPROVAL_THRESHOLD_CENTS,
    withinAutoApprovalThreshold,
  };

  const missingFields: MaintenanceApprovalExecutionInputMissingField[] = [];
  if (typeof actualCostCents !== "number" || actualCostCents <= 0) {
    missingFields.push("actualCostCents");
  }
  if (reviewStatus !== "pending_review") {
    missingFields.push("reviewStatus");
  }
  if (!hasSupportingEvidence) {
    missingFields.push("supportingEvidence");
  }
  if (!withinAutoApprovalThreshold) {
    missingFields.push("autoApprovalThreshold");
  }

  if (!missingFields.length) {
    return {
      state: "complete",
      reason: null,
      missingFields,
      input,
    };
  }

  const state =
    actualCostCents != null || reviewStatus != null || hasSupportingEvidence || input.linkedExpenseStatus != null
      ? "partial"
      : "none";

  let reason = "This work order is not yet approval-ready for deterministic maintenance execution.";
  if (missingFields.length === 1 && missingFields[0] === "actualCostCents") {
    reason = "This work order still needs a submitted actual cost before it can become approval-ready.";
  } else if (missingFields.length === 1 && missingFields[0] === "reviewStatus") {
    reason = "This work order must still be in pending review before it can become approval-ready.";
  } else if (missingFields.length === 1 && missingFields[0] === "supportingEvidence") {
    reason = "This work order still needs supporting evidence or cost attachments before it can become approval-ready.";
  } else if (missingFields.length === 1 && missingFields[0] === "autoApprovalThreshold") {
    reason = "This work order exceeds the maintenance auto-approval threshold and is not execution-ready.";
  }

  return {
    state,
    reason,
    missingFields,
    input,
  };
}
