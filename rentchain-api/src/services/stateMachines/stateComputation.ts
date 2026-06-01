import { lower, positiveNumber, text } from "./common";
import type {
  DecisionActionState,
  LeaseLifecycleState,
  MaintenanceRequestState,
  PaymentState,
  RecordLike,
  ScreeningApplicationState,
} from "./types";

export function computeScreeningState(params: {
  application?: RecordLike | null;
  order?: RecordLike | null;
  transaction?: RecordLike | null;
  result?: RecordLike | null;
}): ScreeningApplicationState {
  const applicationStatus = lower(params.application?.screeningStatus || params.application?.status, 80);
  const orderStatus = lower(params.order?.status || params.order?.orderStatus, 80);
  const transactionStatus = lower(params.transaction?.status || params.transaction?.paymentStatus, 80);
  const resultStatus = lower(params.result?.status || params.application?.screeningResultSummary, 80);

  if (applicationStatus === "cancelled" || orderStatus === "cancelled") return "Cancelled";
  if (applicationStatus === "failed" || orderStatus === "failed" || transactionStatus === "failed") return "Failed";
  if (
    text(params.application?.screeningResultId) ||
    resultStatus === "complete" ||
    resultStatus === "completed" ||
    resultStatus === "available"
  ) {
    return "ResultAvailable";
  }
  if (transactionStatus === "completed" || applicationStatus === "paid" || orderStatus === "paid") return "CheckoutCompleted";
  if (
    transactionStatus === "pending" ||
    orderStatus === "unpaid" ||
    text(params.order?.stripeCheckoutSessionId || params.order?.checkoutSessionId)
  ) {
    return "CheckoutInitiated";
  }
  if (params.order && Object.keys(params.order).length > 0) return "OrderCreated";
  if (params.application && Object.keys(params.application).length > 0) return "ApplicationStarted";
  return "NotRequested";
}

export function computeLeaseState(lease?: RecordLike | null): LeaseLifecycleState {
  const status = lower(lease?.status || lease?.leaseStatus, 80);
  if (!lease || Object.keys(lease).length === 0) return "Draft";
  if (status === "draft" || status === "generated") return "Draft";
  if (status === "ended" || status === "expired" || status === "terminated") return "Ended";
  if (status === "restored") return "Restored";
  if (status === "notice_pending" || status === "renewal_pending" || text(lease?.latestNoticeId)) return "NoticePending";
  return "Active";
}

export function computeMaintenanceState(workOrder?: RecordLike | null): MaintenanceRequestState {
  const status = lower(workOrder?.status, 80);
  const costStatus = lower((workOrder?.cost as RecordLike | undefined)?.reviewStatus || workOrder?.costReviewStatus, 80);
  const rework = workOrder?.reworkCycle as RecordLike | undefined;
  const reworkStatus = lower(rework?.status, 80);

  if (rework && reworkStatus !== "completed" && reworkStatus !== "cancelled") return "Rework";
  if (costStatus === "pending_review" || costStatus === "revision_requested" || costStatus === "rejected") return "CostReview";
  if (status === "completed" || status === "resolved" || status === "closed") return "Completed";
  if (status === "in_progress" || status === "blocked") return "InProgress";
  if (status === "scheduled") return "Scheduled";
  if (status === "assigned" || text(workOrder?.assignedContractorId)) return "Assigned";
  return "Open";
}

export function computePaymentState(payment?: RecordLike | null): PaymentState {
  const status = lower(payment?.status || payment?.paymentStatus, 80);
  if (status === "refunded") return "Refunded";
  if (status === "paid" || status === "confirmed" || status === "recorded" || status === "completed") return "Confirmed";
  if (status === "failed" || status === "canceled" || status === "cancelled" || status === "expired") return "Failed";
  if (status === "checkout_created" || status === "payment_pending" || status === "processing" || status === "provider_session_created") {
    return "Processing";
  }
  if (positiveNumber(payment?.amountCents) != null || positiveNumber(payment?.amount) != null) return "Pending";
  return "Pending";
}

export function computeDecisionState(decisionAction?: RecordLike | null): DecisionActionState {
  const state = lower(decisionAction?.state || decisionAction?.status, 80);
  const outcome = lower(decisionAction?.executionOutcomeStatus, 80);
  if (!decisionAction || Object.keys(decisionAction).length === 0) return "Derived";
  if (state === "executed" && outcome === "failed") return "Failed";
  if (state === "executed") return "Executed";
  if (state === "failed") return "Failed";
  if (state === "dismissed") return "Dismissed";
  if (state === "snoozed") return "Snoozed";
  if (state === "reviewed" || state === "accepted" || state === "resolved") return "Reviewed";
  if (state === "appeared" || text(decisionAction?.appearedAt)) return "Appeared";
  return "Appeared";
}
