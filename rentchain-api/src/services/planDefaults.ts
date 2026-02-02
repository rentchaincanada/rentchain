import { Entitlements, PlanTier } from "../types/account";

export function entitlementsForPlan(plan: PlanTier): Entitlements {
  const unlimited = Number.MAX_SAFE_INTEGER;
  switch (plan) {
    case "screening":
      return {
        propertiesMax: unlimited,
        unitsMax: unlimited,
        usersMax: 1,
        screening: true,
        automation: false,
        exports: "csv",
        notifications: false,
        apiAccess: false,
      };
    case "starter":
      return {
        propertiesMax: 1,
        unitsMax: 5,
        usersMax: 1,
        screening: true,
        automation: false,
        exports: "csv",
        notifications: false,
        apiAccess: false,
      };

    case "core":
      return {
        propertiesMax: 1,
        unitsMax: 5,
        usersMax: 1,
        screening: true,
        automation: false,
        exports: "csv",
        notifications: false,
        apiAccess: false,
      };

    case "pro":
      return {
        propertiesMax: unlimited,
        unitsMax: unlimited,
        usersMax: 10,
        screening: true,
        automation: true,
        exports: "advanced",
        notifications: true,
        apiAccess: true,
      };

    case "elite":
      return {
        propertiesMax: unlimited,
        unitsMax: unlimited,
        usersMax: 1000,
        screening: true,
        automation: true,
        exports: "advanced",
        notifications: true,
        apiAccess: true,
      };

    default:
      return entitlementsForPlan("starter");
  }
}
