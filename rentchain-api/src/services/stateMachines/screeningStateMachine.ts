import { authorityValidator, createStateMachine, requiredFieldsValidator } from "./common";
import type { ScreeningApplicationState, ScreeningContext, ScreeningEvent, StateTransition } from "./types";

export const screeningStates = [
  "NotRequested",
  "ApplicationStarted",
  "OrderCreated",
  "CheckoutInitiated",
  "CheckoutCompleted",
  "ResultAvailable",
  "Failed",
  "Cancelled",
] as const satisfies readonly ScreeningApplicationState[];

const landlordOrAdmin = authorityValidator<ScreeningApplicationState, ScreeningContext, ScreeningEvent>([
  "landlord",
  "admin",
]);
const requiredScreeningFields = (fields: readonly string[]) =>
  requiredFieldsValidator<ScreeningApplicationState, ScreeningContext, ScreeningEvent>(fields);

const transitions: StateTransition<ScreeningApplicationState, ScreeningContext, ScreeningEvent>[] = [
  {
    from: "NotRequested",
    to: "ApplicationStarted",
    event: "start_application",
    validators: [landlordOrAdmin, requiredScreeningFields(["applicationId", "landlordId"])],
  },
  {
    from: "ApplicationStarted",
    to: "OrderCreated",
    event: "create_order",
    validators: [landlordOrAdmin, requiredScreeningFields(["applicationId", "orderId"])],
  },
  {
    from: "OrderCreated",
    to: "CheckoutInitiated",
    event: "initiate_checkout",
    validators: [landlordOrAdmin, requiredScreeningFields(["orderId", "checkoutSessionId"])],
  },
  {
    from: "CheckoutInitiated",
    to: "CheckoutCompleted",
    event: "complete_checkout",
    validators: [landlordOrAdmin, requiredScreeningFields(["orderId"])],
  },
  {
    from: "CheckoutInitiated",
    to: "Failed",
    event: "fail",
    validators: [landlordOrAdmin, requiredScreeningFields(["orderId", "failureCode"])],
  },
  {
    from: "CheckoutCompleted",
    to: "ResultAvailable",
    event: "publish_result",
    validators: [landlordOrAdmin, requiredScreeningFields(["applicationId", "resultId"])],
  },
  ...screeningStates
    .filter((state) => state !== "Cancelled")
    .map((from) => ({
      from,
      to: "Cancelled" as const,
      event: "cancel" as const,
      validators: [landlordOrAdmin, requiredScreeningFields(["applicationId"])],
    })),
];

export const screeningStateMachine = createStateMachine<ScreeningApplicationState, ScreeningContext, ScreeningEvent>({
  workflowType: "screening",
  states: screeningStates,
  terminalStates: ["ResultAvailable", "Failed", "Cancelled"],
  transitions,
});
