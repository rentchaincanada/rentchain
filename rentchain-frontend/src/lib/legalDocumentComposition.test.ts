import { describe, expect, it } from "vitest";
import { composeLeaseSummaryLegalDocument } from "./legalDocumentComposition";

describe("legalDocumentComposition", () => {
  it("composes lease summary sections in deterministic legal order", () => {
    const documentDefinition = composeLeaseSummaryLegalDocument(
      {
        id: "lease-1",
        propertyId: "prop-1",
        propertyName: "Coburg Rd",
        unitNumber: "3",
        tenantName: "Tenant One",
        tenantEmail: "tenant@example.com",
        monthlyRent: 2100,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "notice_pending",
        paymentReadiness: {
          readinessLabel: "Rent terms ready",
          readinessDescription: "Payment terms are ready for review.",
        },
        rentPaymentSummary: {
          paymentRail: { enabled: true },
        },
        leaseLifecycleSummary: {
          lifecycleLabel: "Expiring soon",
          lifecycleDescription: "Notice timing should be reviewed.",
        },
      } as any,
      {
        currency: (value) => `$${value}`,
        date: (value) => String(value || "—"),
        status: (value) => String(value || "Unknown"),
      }
    );

    expect(documentDefinition.metadata).toMatchObject({
      documentType: "lease_summary",
      version: "lease-summary-v1",
      sensitivity: "confidential",
    });
    expect(documentDefinition.sections.map((section) => section.id)).toEqual([
      "property-unit",
      "parties",
      "term",
      "rent-payment",
      "clauses",
      "audit-events",
    ]);
    expect(documentDefinition.sections[4].note).toMatch(/Full legal clauses remain/);
    expect(documentDefinition.sections[5].note).toContain("Expiring soon: Notice timing should be reviewed.");
  });
});
