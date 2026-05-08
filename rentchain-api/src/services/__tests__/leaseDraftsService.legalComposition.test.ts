import { describe, expect, it } from "vitest";
import { renderNsScheduleAHtml } from "../leaseDraftsService";

describe("leaseDraftsService legal composition rendering", () => {
  it("renders Schedule A HTML from shared legal composition without losing addendum order", () => {
    const html = renderNsScheduleAHtml({
      draftId: "draft-1",
      draft: {
        landlordId: "landlord-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        tenantIds: ["tenant-1"],
        province: "NS",
        termType: "fixed",
        startDate: "2026-03-01",
        endDate: "2027-02-28",
        baseRentCents: 185000,
        parkingCents: 10000,
        dueDay: 1,
        paymentMethod: "etransfer",
        nsfFeeCents: 4500,
        utilitiesIncluded: ["heat", "water"],
        depositCents: 92500,
        additionalClauses: "No smoking in common areas.",
        status: "draft",
        templateVersion: "ns-schedule-a-v1",
        createdAt: 1,
        updatedAt: 1,
      },
      landlordDisplayName: "Demo Landlord",
      tenantDisplayNames: ["Tenant One"],
      propertyAddressLine: "123 Main St, Halifax, NS",
      unitLabel: "Unit 2A",
    });

    expect(html).toContain("Schedule A addendum");
    expect(html).toContain("Template version: ns-schedule-a-v1");
    expect(html.indexOf("Lease Summary")).toBeLessThan(html.indexOf("Term"));
    expect(html.indexOf("Term")).toBeLessThan(html.indexOf("Payments"));
    expect(html.indexOf("Payments")).toBeLessThan(html.indexOf("Additional clauses"));
    expect(html).toContain("No smoking in common areas.");
    expect(html).toContain("This Schedule A addendum supplements Form P");
  });
});
