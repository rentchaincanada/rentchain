import { decisionStateMachine } from "./decisionStateMachine";
import { leaseStateMachine } from "./leaseStateMachine";
import { maintenanceStateMachine } from "./maintenanceStateMachine";
import { paymentStateMachine } from "./paymentStateMachine";
import { screeningStateMachine } from "./screeningStateMachine";

export type ReviewWorkflowType = "screening" | "lease" | "maintenance" | "payment" | "decision";

export function getStateMachine(workflowType: ReviewWorkflowType) {
  switch (workflowType) {
    case "screening":
      return screeningStateMachine;
    case "lease":
      return leaseStateMachine;
    case "maintenance":
      return maintenanceStateMachine;
    case "payment":
      return paymentStateMachine;
    case "decision":
      return decisionStateMachine;
  }
}

export function listStateMachineWorkflowTypes(): ReviewWorkflowType[] {
  return ["screening", "lease", "maintenance", "payment", "decision"];
}
