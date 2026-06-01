import { computeDecisionState, computeLeaseState, computeMaintenanceState, computePaymentState, computeScreeningState } from "./stateComputation";
import { decisionStateMachine } from "./decisionStateMachine";
import {
  buildDecisionEvidence,
  buildLeaseEvidence,
  buildMaintenanceEvidence,
  buildPaymentEvidence,
  buildScreeningEvidence,
} from "./evidenceBuilders";
import { captureTransitionEvidence } from "./evidenceProvenance";
import { leaseStateMachine } from "./leaseStateMachine";
import { maintenanceStateMachine } from "./maintenanceStateMachine";
import { paymentStateMachine } from "./paymentStateMachine";
import { screeningStateMachine } from "./screeningStateMachine";
import type {
  DecisionActionState,
  DecisionContext,
  DecisionEvent,
  LeaseContext,
  LeaseEvent,
  LeaseLifecycleState,
  MaintenanceContext,
  MaintenanceEvent,
  MaintenanceRequestState,
  PaymentContext,
  PaymentEvent,
  PaymentState,
  RecordLike,
  ScreeningApplicationState,
  ScreeningContext,
  ScreeningEvent,
  TransitionValidationResult,
} from "./types";

export type ScreeningTransitionRequest = {
  to: ScreeningApplicationState;
  event: ScreeningEvent;
  context: ScreeningContext;
  captureEvidence?: boolean;
  occurredAt?: unknown;
};

export type LeaseTransitionRequest = {
  to: LeaseLifecycleState;
  event: LeaseEvent;
  context: LeaseContext;
  captureEvidence?: boolean;
  occurredAt?: unknown;
};

export type MaintenanceTransitionRequest = {
  to: MaintenanceRequestState;
  event: MaintenanceEvent;
  context: MaintenanceContext;
  captureEvidence?: boolean;
  occurredAt?: unknown;
};

export type PaymentTransitionRequest = {
  to: PaymentState;
  event: PaymentEvent;
  context: PaymentContext;
  captureEvidence?: boolean;
  occurredAt?: unknown;
};

export type DecisionTransitionRequest = {
  to: DecisionActionState;
  event: DecisionEvent;
  context: DecisionContext;
  captureEvidence?: boolean;
  occurredAt?: unknown;
};

export function validateScreeningTransition(
  currentApplication: RecordLike | null | undefined,
  proposedTransition: ScreeningTransitionRequest,
  relatedRecords: { order?: RecordLike | null; transaction?: RecordLike | null; result?: RecordLike | null } = {}
): TransitionValidationResult<ScreeningApplicationState> {
  const currentState = computeScreeningState({
    application: currentApplication,
    order: relatedRecords.order,
    transaction: relatedRecords.transaction,
    result: relatedRecords.result,
  });
  const validation = screeningStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
  if (!proposedTransition.captureEvidence) return validation;
  const workflowInstanceId = proposedTransition.context.applicationId || String(currentApplication?.id || "");
  if (!workflowInstanceId) return validation;
  return {
    ...validation,
    provenanceEvent: captureTransitionEvidence({
      workflowType: "screening",
      workflowInstanceId,
      currentState,
      proposedState: proposedTransition.to,
      event: proposedTransition.event,
      context: proposedTransition.context,
      validation,
      occurredAt: proposedTransition.occurredAt,
      evidenceRefs: buildScreeningEvidence({
        application: currentApplication,
        order: relatedRecords.order,
        transaction: relatedRecords.transaction,
        result: relatedRecords.result,
        context: proposedTransition.context,
      }),
    }),
  };
}

export function validateLeaseTransition(
  lease: RecordLike | null | undefined,
  proposedTransition: LeaseTransitionRequest
): TransitionValidationResult<LeaseLifecycleState> {
  const currentState = computeLeaseState(lease);
  const validation = leaseStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
  if (!proposedTransition.captureEvidence) return validation;
  const workflowInstanceId = proposedTransition.context.leaseId || String(lease?.id || "");
  if (!workflowInstanceId) return validation;
  return {
    ...validation,
    provenanceEvent: captureTransitionEvidence({
      workflowType: "lease",
      workflowInstanceId,
      currentState,
      proposedState: proposedTransition.to,
      event: proposedTransition.event,
      context: proposedTransition.context,
      validation,
      occurredAt: proposedTransition.occurredAt,
      evidenceRefs: buildLeaseEvidence({ lease, context: proposedTransition.context }),
    }),
  };
}

export function validateMaintenanceTransition(
  workOrder: RecordLike | null | undefined,
  proposedTransition: MaintenanceTransitionRequest
): TransitionValidationResult<MaintenanceRequestState> {
  const currentState = computeMaintenanceState(workOrder);
  const validation = maintenanceStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
  if (!proposedTransition.captureEvidence) return validation;
  const workflowInstanceId = proposedTransition.context.workOrderId || String(workOrder?.id || "");
  if (!workflowInstanceId) return validation;
  return {
    ...validation,
    provenanceEvent: captureTransitionEvidence({
      workflowType: "maintenance",
      workflowInstanceId,
      currentState,
      proposedState: proposedTransition.to,
      event: proposedTransition.event,
      context: proposedTransition.context,
      validation,
      occurredAt: proposedTransition.occurredAt,
      evidenceRefs: buildMaintenanceEvidence({ workOrder, context: proposedTransition.context }),
    }),
  };
}

export function validatePaymentTransition(
  payment: RecordLike | null | undefined,
  proposedTransition: PaymentTransitionRequest
): TransitionValidationResult<PaymentState> {
  const currentState = computePaymentState(payment);
  const validation = paymentStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
  if (!proposedTransition.captureEvidence) return validation;
  const workflowInstanceId = proposedTransition.context.paymentId || String(payment?.id || "");
  if (!workflowInstanceId) return validation;
  return {
    ...validation,
    provenanceEvent: captureTransitionEvidence({
      workflowType: "payment",
      workflowInstanceId,
      currentState,
      proposedState: proposedTransition.to,
      event: proposedTransition.event,
      context: proposedTransition.context,
      validation,
      occurredAt: proposedTransition.occurredAt,
      evidenceRefs: buildPaymentEvidence({ payment, context: proposedTransition.context }),
    }),
  };
}

export function validateDecisionTransition(
  decisionAction: RecordLike | null | undefined,
  proposedTransition: DecisionTransitionRequest
): TransitionValidationResult<DecisionActionState> {
  const currentState = computeDecisionState(decisionAction);
  const validation = decisionStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
  if (!proposedTransition.captureEvidence) return validation;
  const workflowInstanceId = proposedTransition.context.decisionId || String(decisionAction?.decisionId || decisionAction?.id || "");
  if (!workflowInstanceId) return validation;
  return {
    ...validation,
    provenanceEvent: captureTransitionEvidence({
      workflowType: "decision",
      workflowInstanceId,
      currentState,
      proposedState: proposedTransition.to,
      event: proposedTransition.event,
      context: proposedTransition.context,
      validation,
      occurredAt: proposedTransition.occurredAt,
      evidenceRefs: buildDecisionEvidence({ decisionAction, context: proposedTransition.context }),
    }),
  };
}

export function buildValidationSummary(result: TransitionValidationResult): {
  valid: boolean;
  allowedTransitions: string[];
  reason?: string;
} {
  return {
    valid: result.valid,
    allowedTransitions: result.allowedTransitions,
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.provenanceEvent ? { provenanceCaptured: true, provenanceEventId: result.provenanceEvent.eventId } : {}),
  };
}
