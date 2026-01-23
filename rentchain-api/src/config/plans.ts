export const PLANS = {
  starter: {
    maxProperties: 999999,
    maxUnits: 999999,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
