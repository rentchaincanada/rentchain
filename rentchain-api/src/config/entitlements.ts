export type PlanTier = "starter" | "core" | "pro" | "elite";

export const ENTITLEMENTS: Record<
  PlanTier,
  {
    maxProperties: number;
    maxUnits: number;
    maxTenants: number;
    maxActiveLeases: number;
  }
> = {
  starter: {
    maxProperties: Infinity,
    maxUnits: Infinity,
    maxTenants: 10,
    maxActiveLeases: 10,
  },
  core: {
    maxProperties: 5,
    maxUnits: 50,
    maxTenants: 50,
    maxActiveLeases: 50,
  },
  pro: {
    maxProperties: 25,
    maxUnits: 250,
    maxTenants: 250,
    maxActiveLeases: 250,
  },
  elite: {
    maxProperties: Infinity,
    maxUnits: Infinity,
    maxTenants: Infinity,
    maxActiveLeases: Infinity,
  },
};
