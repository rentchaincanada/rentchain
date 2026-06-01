import { authorityValidator, createStateMachine, invalid, positiveNumber, requiredFieldsValidator } from "./common";
import type { MaintenanceContext, MaintenanceEvent, MaintenanceRequestState, StateTransition } from "./types";

export const maintenanceStates = [
  "Open",
  "Assigned",
  "Scheduled",
  "InProgress",
  "CostReview",
  "Completed",
  "Rework",
] as const satisfies readonly MaintenanceRequestState[];

const tenantLandlordAdmin = authorityValidator<MaintenanceRequestState, MaintenanceContext, MaintenanceEvent>([
  "tenant",
  "landlord",
  "admin",
]);
const landlordAdmin = authorityValidator<MaintenanceRequestState, MaintenanceContext, MaintenanceEvent>(["landlord", "admin"]);
const contractorLandlordAdmin = authorityValidator<MaintenanceRequestState, MaintenanceContext, MaintenanceEvent>([
  "contractor",
  "landlord",
  "admin",
]);

const requiresCost = ({ currentState, context }: {
  currentState: MaintenanceRequestState;
  proposedState: MaintenanceRequestState;
  event: MaintenanceEvent;
  context: MaintenanceContext;
}) => {
  if (positiveNumber(context.costTotalCents) == null) {
    return invalid(currentState, "missing_context", "Cost review requires a positive cost amount.");
  }
  return null;
};

const requiresEvidence = ({ currentState, context }: {
  currentState: MaintenanceRequestState;
  proposedState: MaintenanceRequestState;
  event: MaintenanceEvent;
  context: MaintenanceContext;
}) => {
  if (positiveNumber(context.evidenceCount) == null) {
    return invalid(currentState, "missing_context", "Completion requires at least one evidence item.");
  }
  return null;
};

const transitions: StateTransition<MaintenanceRequestState, MaintenanceContext, MaintenanceEvent>[] = [
  {
    from: "Open",
    to: "Assigned",
    event: "assign",
    validators: [landlordAdmin, requiredFieldsValidator(["workOrderId", "assignedContractorId"])],
  },
  {
    from: "Assigned",
    to: "Scheduled",
    event: "schedule",
    validators: [contractorLandlordAdmin, requiredFieldsValidator(["workOrderId", "scheduledFor"])],
  },
  {
    from: "Assigned",
    to: "CostReview",
    event: "request_cost_review",
    validators: [contractorLandlordAdmin, requiredFieldsValidator(["workOrderId"]), requiresCost],
  },
  {
    from: "Scheduled",
    to: "InProgress",
    event: "start",
    validators: [contractorLandlordAdmin, requiredFieldsValidator(["workOrderId"])],
  },
  {
    from: "InProgress",
    to: "CostReview",
    event: "request_cost_review",
    validators: [contractorLandlordAdmin, requiredFieldsValidator(["workOrderId"]), requiresCost],
  },
  {
    from: "InProgress",
    to: "Completed",
    event: "complete",
    validators: [contractorLandlordAdmin, requiredFieldsValidator(["workOrderId"]), requiresEvidence],
  },
  {
    from: "CostReview",
    to: "Completed",
    event: "complete",
    validators: [landlordAdmin, requiredFieldsValidator(["workOrderId"])],
  },
  {
    from: "CostReview",
    to: "Rework",
    event: "request_rework",
    validators: [landlordAdmin, requiredFieldsValidator(["workOrderId"])],
  },
  {
    from: "Completed",
    to: "Rework",
    event: "request_rework",
    validators: [tenantLandlordAdmin, requiredFieldsValidator(["workOrderId"])],
  },
  {
    from: "Rework",
    to: "Assigned",
    event: "return_to_assignment",
    validators: [landlordAdmin, requiredFieldsValidator(["workOrderId", "assignedContractorId"])],
  },
  {
    from: "Rework",
    to: "Completed",
    event: "complete",
    validators: [contractorLandlordAdmin, requiredFieldsValidator(["workOrderId"]), requiresEvidence],
  },
];

export const maintenanceStateMachine = createStateMachine<MaintenanceRequestState, MaintenanceContext, MaintenanceEvent>({
  workflowType: "maintenance",
  states: maintenanceStates,
  terminalStates: [],
  transitions,
});
