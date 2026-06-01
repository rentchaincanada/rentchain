import { authorityValidator, createStateMachine, invalid, requiredFieldsValidator } from "./common";
import type { PaymentContext, PaymentEvent, PaymentState, StateTransition } from "./types";

export const paymentStates = ["Pending", "Processing", "Confirmed", "Failed", "Refunded"] as const satisfies readonly PaymentState[];

const accountAuthority = authorityValidator<PaymentState, PaymentContext, PaymentEvent>(["tenant", "landlord", "admin", "system"]);

const requiresUnambiguousProviderState = ({ currentState, context }: {
  currentState: PaymentState;
  proposedState: PaymentState;
  event: PaymentEvent;
  context: PaymentContext;
}) => {
  const providerStatus = String(context.providerStatus || "").trim().toLowerCase();
  if (!providerStatus && currentState === "Processing") {
    return invalid(currentState, "ambiguous_state", "Persisted payment transaction status is required for processing transitions.");
  }
  return null;
};

const transitions: StateTransition<PaymentState, PaymentContext, PaymentEvent>[] = [
  {
    from: "Pending",
    to: "Processing",
    event: "start_processing",
    validators: [accountAuthority, requiredFieldsValidator(["paymentId", "paymentIntentId"])],
  },
  {
    from: "Processing",
    to: "Confirmed",
    event: "confirm",
    validators: [accountAuthority, requiredFieldsValidator(["paymentId", "paymentIntentId"]), requiresUnambiguousProviderState],
  },
  {
    from: "Processing",
    to: "Failed",
    event: "fail",
    validators: [accountAuthority, requiredFieldsValidator(["paymentId", "paymentIntentId"]), requiresUnambiguousProviderState],
  },
  {
    from: "Confirmed",
    to: "Refunded",
    event: "refund",
    validators: [accountAuthority, requiredFieldsValidator(["paymentId"])],
  },
  {
    from: "Failed",
    to: "Pending",
    event: "retry",
    validators: [accountAuthority, requiredFieldsValidator(["paymentId"])],
  },
  {
    from: "Refunded",
    to: "Pending",
    event: "reattempt",
    validators: [accountAuthority, requiredFieldsValidator(["paymentId"])],
  },
];

export const paymentStateMachine = createStateMachine<PaymentState, PaymentContext, PaymentEvent>({
  workflowType: "payment",
  states: paymentStates,
  terminalStates: [],
  transitions,
});
