export const PLANS = {
  starter: {
    maxProperties: Infinity,
    maxUnits: Infinity,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
