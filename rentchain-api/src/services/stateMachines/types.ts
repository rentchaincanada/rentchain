export type ActorRole = "tenant" | "landlord" | "admin" | "contractor" | "support" | "system";

export type RecordLike = Record<string, unknown>;

export type ScreeningApplicationState =
  | "NotRequested"
  | "ApplicationStarted"
  | "OrderCreated"
  | "CheckoutInitiated"
  | "CheckoutCompleted"
  | "ResultAvailable"
  | "Failed"
  | "Cancelled";

export type ScreeningOperationState = "Requested" | "InProgress" | "Completed" | "Cancelled" | "Blocked";

export type LeaseLifecycleState = "Draft" | "Active" | "NoticePending" | "Ended" | "Restored";

export type MaintenanceRequestState =
  | "Open"
  | "Assigned"
  | "Scheduled"
  | "InProgress"
  | "CostReview"
  | "Completed"
  | "Rework";

export type PaymentState = "Pending" | "Processing" | "Confirmed" | "Failed" | "Refunded";

export type DecisionActionState = "Derived" | "Appeared" | "Reviewed" | "Snoozed" | "Dismissed" | "Executed" | "Failed";

export type ScreeningEvent =
  | "start_application"
  | "create_order"
  | "initiate_checkout"
  | "complete_checkout"
  | "publish_result"
  | "fail"
  | "cancel";

export type LeaseEvent = "activate" | "prepare_notice" | "end" | "restore" | "reactivate";

export type MaintenanceEvent =
  | "assign"
  | "schedule"
  | "start"
  | "request_cost_review"
  | "complete"
  | "request_rework"
  | "return_to_assignment";

export type PaymentEvent = "start_processing" | "confirm" | "fail" | "refund" | "retry" | "reattempt";

export type DecisionEvent = "appear" | "review" | "snooze" | "dismiss" | "execute" | "mark_failed" | "reopen";

export type WorkflowState =
  | ScreeningApplicationState
  | ScreeningOperationState
  | LeaseLifecycleState
  | MaintenanceRequestState
  | PaymentState
  | DecisionActionState;

export type WorkflowEvent = ScreeningEvent | LeaseEvent | MaintenanceEvent | PaymentEvent | DecisionEvent;

export type AuthorityContext = {
  actorRole: ActorRole;
  actorId?: string | null;
  authorized?: boolean;
};

export type ScreeningContext = AuthorityContext & {
  applicationId?: string | null;
  landlordId?: string | null;
  accountOwnerId?: string | null;
  orderId?: string | null;
  checkoutSessionId?: string | null;
  transactionStatus?: string | null;
  resultId?: string | null;
  failureCode?: string | null;
};

export type LeaseContext = AuthorityContext & {
  leaseId?: string | null;
  landlordId?: string | null;
  leaseOwnerId?: string | null;
  noticeId?: string | null;
  noticeRequired?: boolean;
  restoreRequested?: boolean;
};

export type MaintenanceContext = AuthorityContext & {
  workOrderId?: string | null;
  tenantId?: string | null;
  landlordId?: string | null;
  contractorId?: string | null;
  assignedContractorId?: string | null;
  scheduledFor?: string | number | null;
  costTotalCents?: number | null;
  evidenceCount?: number | null;
};

export type PaymentContext = AuthorityContext & {
  paymentId?: string | null;
  paymentIntentId?: string | null;
  landlordId?: string | null;
  tenantId?: string | null;
  ownerId?: string | null;
  providerStatus?: string | null;
};

export type DecisionContext = AuthorityContext & {
  decisionId?: string | null;
  landlordId?: string | null;
  decisionOwnerId?: string | null;
  actionRecordExists?: boolean;
  sourceValid?: boolean;
  snoozedUntil?: string | null;
};

export type StateSnapshot<S extends string> = {
  state: S;
  terminal: boolean;
  allowedTransitions: S[];
  computedAt?: string;
};

export type TransitionEvent<S extends string, E extends string> = {
  from: S;
  to: S;
  event: E;
  occurredAt?: string;
  reason?: string;
};

export type TransitionError<S extends string> = {
  state: S;
  reason: string;
  code:
    | "invalid_transition"
    | "insufficient_authority"
    | "missing_context"
    | "ambiguous_state"
    | "terminal_state"
    | "source_invalid";
};

export type TransitionValidationResult<S extends string = string> = {
  valid: boolean;
  currentState: S;
  proposedState: S;
  allowedTransitions: S[];
  reason?: string;
};

export type TransitionValidator<S extends string, C, E extends string> = (input: {
  currentState: S;
  proposedState: S;
  event: E;
  context: C;
}) => TransitionError<S> | null;

export type StateHandler<S extends string, C, E extends string> = (input: {
  currentState: S;
  proposedState: S;
  event: E;
  context: C;
}) => StateSnapshot<S>;

export type StateTransition<S extends string, C, E extends string> = {
  from: S;
  to: S;
  event: E;
  validators: Array<TransitionValidator<S, C, E>>;
};

export type StateMachine<S extends string, C, E extends string> = {
  workflowType: string;
  states: readonly S[];
  terminalStates: readonly S[];
  transitions: readonly StateTransition<S, C, E>[];
  getAllowedTransitions: (state: S) => S[];
  validateTransition: (input: {
    currentState: S;
    proposedState: S;
    event: E;
    context: C;
  }) => TransitionValidationResult<S>;
  snapshot: (state: S) => StateSnapshot<S>;
};
