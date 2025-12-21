import { Entitlements, PlanTier } from "../types/account";

export function entitlementsForPlan(plan: PlanTier): Entitlements {
  switch (plan) {
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
        propertiesMax: 20,
        unitsMax: 200,
        usersMax: 2,
        screening: true,
        automation: true,
        exports: "pdf",
        notifications: true,
        apiAccess: false,
      };

    case "pro":
      return {
        propertiesMax: 100,
        unitsMax: 2000,
        usersMax: 10,
        screening: true,
        automation: true,
        exports: "advanced",
        notifications: true,
        apiAccess: true,
      };

    case "elite":
      return {
        propertiesMax: 100000,
        unitsMax: 1000000,
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
