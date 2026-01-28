export const PLANS = {
  screening: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
  },
  starter: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
  },
  pro: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
  },
  elite: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
  },
} as const;

export type PlanKey = keyof typeof PLANS;
