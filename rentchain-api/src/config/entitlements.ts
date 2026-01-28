export type PlanTier = "screening" | "starter" | "core" | "pro" | "elite";

export const ENTITLEMENTS: Record<
  PlanTier,
  {
    maxProperties: number;
    maxUnits: number;
    maxTenants: number;
    maxActiveLeases: number;
  }
> = {
  screening: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
    maxTenants: Number.MAX_SAFE_INTEGER,
    maxActiveLeases: Number.MAX_SAFE_INTEGER,
  },
  starter: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
    maxTenants: Number.MAX_SAFE_INTEGER,
    maxActiveLeases: Number.MAX_SAFE_INTEGER,
  },
  core: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
    maxTenants: Number.MAX_SAFE_INTEGER,
    maxActiveLeases: Number.MAX_SAFE_INTEGER,
  },
  pro: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
    maxTenants: Number.MAX_SAFE_INTEGER,
    maxActiveLeases: Number.MAX_SAFE_INTEGER,
  },
  elite: {
    maxProperties: Number.MAX_SAFE_INTEGER,
    maxUnits: Number.MAX_SAFE_INTEGER,
    maxTenants: Number.MAX_SAFE_INTEGER,
    maxActiveLeases: Number.MAX_SAFE_INTEGER,
  },
};
