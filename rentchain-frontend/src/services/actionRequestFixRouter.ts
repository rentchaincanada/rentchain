import { ActionRequest } from "../api/actionRequestsApi";

export type FixAction =
  | { kind: "navigate"; to: string }
  | { kind: "navigateWithSearch"; to: string; search: Record<string, string> }
  | { kind: "noop"; reason: string };

export function fixActionForRequest(req: ActionRequest): FixAction {
  const propertyId = req.propertyId;

  if (!req.ruleKey) {
    return {
      kind: "navigateWithSearch",
      to: "/properties",
      search: {
        propertyId,
        actionRequestId: req.id,
        panel: "actionRequests",
      },
    };
  }

  switch (req.ruleKey) {
    case "no_active_lease":
      return {
        kind: "navigateWithSearch",
        to: "/properties",
        search: {
          propertyId,
          panel: "leases",
          openAddLease: "1",
        },
      };
    case "no_units":
      return {
        kind: "navigateWithSearch",
        to: "/properties",
        search: {
          propertyId,
          panel: "units",
          openAddUnit: "1",
        },
      };
    case "units_missing_basics":
      return {
        kind: "navigateWithSearch",
        to: "/properties",
        search: {
          propertyId,
          panel: "units",
          openEditUnits: "1",
        },
      };
    case "property_address_incomplete":
      return {
        kind: "navigateWithSearch",
        to: "/properties",
        search: {
          propertyId,
          panel: "property",
          openEditProperty: "1",
        },
      };
    default:
      return { kind: "noop", reason: `No fix mapping for ruleKey=${req.ruleKey}` };
  }
}
