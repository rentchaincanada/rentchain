import { authorityValidator, createStateMachine, invalid, requiredFieldsValidator } from "./common";
import type { LeaseContext, LeaseEvent, LeaseLifecycleState, StateTransition } from "./types";

export const leaseStates = ["Draft", "Active", "NoticePending", "Ended", "Restored"] as const satisfies readonly LeaseLifecycleState[];

const landlordOrAdmin = authorityValidator<LeaseLifecycleState, LeaseContext, LeaseEvent>(["landlord", "admin"]);

const requiresNotice = ({ currentState, proposedState, context }: {
  currentState: LeaseLifecycleState;
  proposedState: LeaseLifecycleState;
  event: LeaseEvent;
  context: LeaseContext;
}) => {
  if (proposedState !== "NoticePending") return null;
  if (context.noticeRequired === false) {
    return invalid(currentState, "missing_context", "Notice transition requires an applicable notice rule.");
  }
  return null;
};

const requiresRestoreIntent = ({ currentState, context }: {
  currentState: LeaseLifecycleState;
  proposedState: LeaseLifecycleState;
  event: LeaseEvent;
  context: LeaseContext;
}) => {
  if (context.restoreRequested !== true) {
    return invalid(currentState, "missing_context", "Ended lease restore requires explicit restore context.");
  }
  return null;
};

const transitions: StateTransition<LeaseLifecycleState, LeaseContext, LeaseEvent>[] = [
  {
    from: "Draft",
    to: "Active",
    event: "activate",
    validators: [landlordOrAdmin, requiredFieldsValidator(["leaseId", "landlordId"])],
  },
  {
    from: "Active",
    to: "NoticePending",
    event: "prepare_notice",
    validators: [landlordOrAdmin, requiredFieldsValidator(["leaseId", "landlordId", "noticeId"]), requiresNotice],
  },
  {
    from: "Active",
    to: "Ended",
    event: "end",
    validators: [landlordOrAdmin, requiredFieldsValidator(["leaseId", "landlordId"])],
  },
  {
    from: "NoticePending",
    to: "Ended",
    event: "end",
    validators: [landlordOrAdmin, requiredFieldsValidator(["leaseId", "landlordId"])],
  },
  {
    from: "Ended",
    to: "Restored",
    event: "restore",
    validators: [landlordOrAdmin, requiredFieldsValidator(["leaseId", "landlordId"]), requiresRestoreIntent],
  },
  {
    from: "Restored",
    to: "Active",
    event: "reactivate",
    validators: [landlordOrAdmin, requiredFieldsValidator(["leaseId", "landlordId"])],
  },
];

export const leaseStateMachine = createStateMachine<LeaseLifecycleState, LeaseContext, LeaseEvent>({
  workflowType: "lease",
  states: leaseStates,
  terminalStates: [],
  transitions,
});
