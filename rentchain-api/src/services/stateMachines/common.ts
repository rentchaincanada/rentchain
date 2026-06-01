import type {
  StateMachine,
  StateSnapshot,
  StateTransition,
  TransitionValidator,
  TransitionError,
  TransitionValidationResult,
} from "./types";

export function text(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

export function lower(value: unknown, max = 240): string {
  return text(value, max).toLowerCase();
}

export function positiveNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

export function hasValue(value: unknown): boolean {
  return text(value).length > 0;
}

export function invalid<S extends string>(
  state: S,
  code: TransitionError<S>["code"],
  reason: string
): TransitionError<S> {
  return { state, code, reason };
}

export function createStateMachine<S extends string, C, E extends string>(params: {
  workflowType: string;
  states: readonly S[];
  terminalStates: readonly S[];
  transitions: readonly StateTransition<S, C, E>[];
}): StateMachine<S, C, E> {
  const getAllowedTransitions = (state: S): S[] =>
    params.transitions.filter((transition) => transition.from === state).map((transition) => transition.to);

  const snapshot = (state: S): StateSnapshot<S> => ({
    state,
    terminal: params.terminalStates.includes(state),
    allowedTransitions: getAllowedTransitions(state),
  });

  const validateTransition = (input: {
    currentState: S;
    proposedState: S;
    event: E;
    context: C;
  }): TransitionValidationResult<S> => {
    const allowedTransitions = getAllowedTransitions(input.currentState);
    const transition = params.transitions.find(
      (candidate) =>
        candidate.from === input.currentState &&
        candidate.to === input.proposedState &&
        candidate.event === input.event
    );

    if (!transition) {
      return {
        valid: false,
        currentState: input.currentState,
        proposedState: input.proposedState,
        allowedTransitions,
        reason: allowedTransitions.includes(input.proposedState)
          ? `Transition event ${input.event} is not valid for ${input.currentState} to ${input.proposedState}.`
          : `Transition from ${input.currentState} to ${input.proposedState} is not allowed.`,
      };
    }

    for (const validator of transition.validators) {
      const error = validator(input);
      if (error) {
        return {
          valid: false,
          currentState: input.currentState,
          proposedState: input.proposedState,
          allowedTransitions,
          reason: error.reason,
        };
      }
    }

    return {
      valid: true,
      currentState: input.currentState,
      proposedState: input.proposedState,
      allowedTransitions,
    };
  };

  return Object.freeze({
    workflowType: params.workflowType,
    states: Object.freeze([...params.states]),
    terminalStates: Object.freeze([...params.terminalStates]),
    transitions: Object.freeze([...params.transitions]),
    getAllowedTransitions,
    validateTransition,
    snapshot,
  });
}

export function authorityValidator<S extends string, C extends { authorized?: boolean; actorRole?: string }, E extends string>(
  roles: readonly string[]
) {
  return ({ currentState, context }: { currentState: S; proposedState: S; event: E; context: C }) => {
    if (context.authorized !== true) {
      return invalid(currentState, "insufficient_authority", "Actor is not authorized for this transition.");
    }
    if (!roles.includes(context.actorRole || "")) {
      return invalid(currentState, "insufficient_authority", "Actor role is not allowed for this transition.");
    }
    return null;
  };
}

export function requiredFieldsValidator<S extends string, C extends object, E extends string>(
  fields: readonly string[]
): TransitionValidator<S, C, E> {
  return ({ currentState, context }: { currentState: S; proposedState: S; event: E; context: C }) => {
    const missing = fields.filter((field) => !hasValue(context[field as keyof C]));
    if (missing.length) {
      return invalid(currentState, "missing_context", `Missing required context: ${missing.join(", ")}.`);
    }
    return null;
  };
}
