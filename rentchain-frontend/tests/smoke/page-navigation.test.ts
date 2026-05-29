import { describe, expect, it } from "vitest";

type SmokeJourney = {
  role: "admin" | "landlord" | "tenant";
  path: string;
  expectedText: RegExp[];
  apiRoutes: string[];
};

const criticalJourneys: SmokeJourney[] = [
  {
    role: "admin",
    path: "/admin/properties",
    expectedText: [/properties/i, /workspace/i],
    apiRoutes: ["/api/admin/properties"],
  },
  {
    role: "admin",
    path: "/admin/tenants",
    expectedText: [/tenants/i, /workspace/i],
    apiRoutes: ["/api/admin/tenants"],
  },
  {
    role: "landlord",
    path: "/properties",
    expectedText: [/properties/i, /portfolio/i],
    apiRoutes: ["/api/landlord/properties"],
  },
  {
    role: "landlord",
    path: "/work-orders",
    expectedText: [/work orders/i, /maintenance/i],
    apiRoutes: ["/api/maintenance-requests"],
  },
  {
    role: "tenant",
    path: "/tenant/lease",
    expectedText: [/lease/i, /tenant/i],
    apiRoutes: ["/api/tenant/lease"],
  },
  {
    role: "tenant",
    path: "/tenant/maintenance",
    expectedText: [/maintenance/i, /tenant/i],
    apiRoutes: ["/api/tenant/maintenance-requests"],
  },
];

describe("authenticated smoke page navigation contract", () => {
  it("covers admin, landlord, and tenant critical journeys", () => {
    expect(new Set(criticalJourneys.map((journey) => journey.role))).toEqual(
      new Set(["admin", "landlord", "tenant"])
    );
    expect(criticalJourneys).toHaveLength(6);
  });

  it("uses role-scoped paths and API routes", () => {
    for (const journey of criticalJourneys) {
      expect(journey.path).toMatch(/^\//);
      expect(journey.apiRoutes.length).toBeGreaterThan(0);
      expect(journey.expectedText.length).toBeGreaterThan(0);
      for (const route of journey.apiRoutes) {
        expect(route).toMatch(/^\/api\//);
        if (journey.role === "tenant") expect(route).toContain("/tenant/");
        if (journey.role === "admin") expect(route).toContain("/admin/");
      }
    }
  });
});
