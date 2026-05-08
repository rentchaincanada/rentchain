import { describe, expect, it } from "vitest";
import {
  composeScheduleALegalDocument,
  NS_SCHEDULE_A_TEMPLATE_VERSION,
} from "../scheduleAComposition";

const draft = {
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
} as const;

describe("scheduleAComposition", () => {
  it("composes Schedule A sections with province, template, and governance metadata", () => {
    const documentDefinition = composeScheduleALegalDocument({
      draftId: "draft-1",
      draft: draft as any,
      landlordDisplayName: "Demo Landlord",
      tenantDisplayNames: ["Tenant One"],
      propertyAddressLine: "123 Main St, Halifax, NS",
      unitLabel: "Unit 2A",
    });

    expect(documentDefinition.metadata).toMatchObject({
      documentKind: "schedule_a",
      province: "NS",
      templateKey: NS_SCHEDULE_A_TEMPLATE_VERSION,
      version: NS_SCHEDULE_A_TEMPLATE_VERSION,
      sensitivity: "restricted",
      governance: {
        sensitivity: "restricted",
        retentionCategory: "export_metadata",
        metadataOnly: true,
      },
    });
    expect(documentDefinition.sections.map((section) => section.id)).toEqual([
      "lease-summary",
      "term",
      "payments",
      "additional-clauses",
    ]);
    expect(documentDefinition.sections[0].fields.map((field) => field.label)).toEqual([
      "Landlord",
      "Tenant(s)",
      "Property",
      "Unit",
      "Draft ID",
    ]);
    expect(documentDefinition.sections[3].body).toBe("No smoking in common areas.");
    expect(documentDefinition.footer).toMatch(/supplements Form P/);
  });
});
