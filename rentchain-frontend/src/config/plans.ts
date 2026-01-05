export const PLANS = {
  starter: {
    maxProperties: 1,
    maxUnits: 10,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
