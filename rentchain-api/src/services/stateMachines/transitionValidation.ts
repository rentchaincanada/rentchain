import { computeDecisionState, computeLeaseState, computeMaintenanceState, computePaymentState, computeScreeningState } from "./stateComputation";
import { decisionStateMachine } from "./decisionStateMachine";
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
};

export type LeaseTransitionRequest = {
  to: LeaseLifecycleState;
  event: LeaseEvent;
  context: LeaseContext;
};

export type MaintenanceTransitionRequest = {
  to: MaintenanceRequestState;
  event: MaintenanceEvent;
  context: MaintenanceContext;
};

export type PaymentTransitionRequest = {
  to: PaymentState;
  event: PaymentEvent;
  context: PaymentContext;
};

export type DecisionTransitionRequest = {
  to: DecisionActionState;
  event: DecisionEvent;
  context: DecisionContext;
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
  return screeningStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
}

export function validateLeaseTransition(
  lease: RecordLike | null | undefined,
  proposedTransition: LeaseTransitionRequest
): TransitionValidationResult<LeaseLifecycleState> {
  const currentState = computeLeaseState(lease);
  return leaseStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
}

export function validateMaintenanceTransition(
  workOrder: RecordLike | null | undefined,
  proposedTransition: MaintenanceTransitionRequest
): TransitionValidationResult<MaintenanceRequestState> {
  const currentState = computeMaintenanceState(workOrder);
  return maintenanceStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
}

export function validatePaymentTransition(
  payment: RecordLike | null | undefined,
  proposedTransition: PaymentTransitionRequest
): TransitionValidationResult<PaymentState> {
  const currentState = computePaymentState(payment);
  return paymentStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
}

export function validateDecisionTransition(
  decisionAction: RecordLike | null | undefined,
  proposedTransition: DecisionTransitionRequest
): TransitionValidationResult<DecisionActionState> {
  const currentState = computeDecisionState(decisionAction);
  return decisionStateMachine.validateTransition({
    currentState,
    proposedState: proposedTransition.to,
    event: proposedTransition.event,
    context: proposedTransition.context,
  });
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
  };
}
