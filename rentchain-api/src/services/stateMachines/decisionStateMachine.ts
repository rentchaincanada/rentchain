import { authorityValidator, createStateMachine, invalid, requiredFieldsValidator } from "./common";
import type { DecisionActionState, DecisionContext, DecisionEvent, StateTransition } from "./types";

export const decisionStates = [
  "Derived",
  "Appeared",
  "Reviewed",
  "Snoozed",
  "Dismissed",
  "Executed",
  "Failed",
] as const satisfies readonly DecisionActionState[];

const landlordOrAdmin = authorityValidator<DecisionActionState, DecisionContext, DecisionEvent>(["landlord", "admin"]);

const requiresValidSource = ({ currentState, context }: {
  currentState: DecisionActionState;
  proposedState: DecisionActionState;
  event: DecisionEvent;
  context: DecisionContext;
}) => {
  if (context.sourceValid === false) {
    return invalid(currentState, "source_invalid", "Source decision context is no longer valid.");
  }
  return null;
};

const requiresActionRecord = ({ currentState, context }: {
  currentState: DecisionActionState;
  proposedState: DecisionActionState;
  event: DecisionEvent;
  context: DecisionContext;
}) => {
  if (context.actionRecordExists !== true) {
    return invalid(currentState, "missing_context", "Decision action record is required for this transition.");
  }
  return null;
};

const transitions: StateTransition<DecisionActionState, DecisionContext, DecisionEvent>[] = [
  {
    from: "Derived",
    to: "Appeared",
    event: "appear",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresValidSource],
  },
  {
    from: "Appeared",
    to: "Reviewed",
    event: "review",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresValidSource],
  },
  {
    from: "Appeared",
    to: "Dismissed",
    event: "dismiss",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresValidSource],
  },
  {
    from: "Reviewed",
    to: "Snoozed",
    event: "snooze",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId", "snoozedUntil"]), requiresActionRecord],
  },
  {
    from: "Reviewed",
    to: "Executed",
    event: "execute",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresActionRecord, requiresValidSource],
  },
  {
    from: "Reviewed",
    to: "Failed",
    event: "mark_failed",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresActionRecord],
  },
  {
    from: "Snoozed",
    to: "Reviewed",
    event: "review",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresActionRecord],
  },
  {
    from: "Dismissed",
    to: "Reviewed",
    event: "reopen",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresActionRecord, requiresValidSource],
  },
  {
    from: "Executed",
    to: "Failed",
    event: "mark_failed",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresActionRecord],
  },
  {
    from: "Failed",
    to: "Reviewed",
    event: "reopen",
    validators: [landlordOrAdmin, requiredFieldsValidator(["decisionId", "landlordId"]), requiresActionRecord, requiresValidSource],
  },
];

export const decisionStateMachine = createStateMachine<DecisionActionState, DecisionContext, DecisionEvent>({
  workflowType: "decision",
  states: decisionStates,
  terminalStates: [],
  transitions,
});
