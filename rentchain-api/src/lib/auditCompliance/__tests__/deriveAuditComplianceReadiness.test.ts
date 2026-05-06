import { describe, expect, it } from "vitest";
import { deriveAuditComplianceReadiness } from "../deriveAuditComplianceReadiness";
import type { DecisionInboxItem } from "../../decisions/decisionInboxTypes";

function exportPackage(overrides: Record<string, unknown> = {}) {
  return {
    packageId: "institution_export:lender_due_diligence:landlord-1",
    packageType: "lender_due_diligence",
    audience: "lender",
    status: "preview_ready",
    generatedAt: "2026-05-05T12:00:00.000Z",
    manualOnly: true,
    externalSubmissionEnabled: false,
    sections: [
      {
        sectionKey: "property_summary",
        label: "Property summary",
        status: "included",
        recordsCount: 1,
        blockedReasons: [],
      },
      {
        sectionKey: "occupancy_summary",
        label: "Occupancy summary",
        status: "included",
        recordsCount: 1,
        blockedReasons: [],
      },
    ],
    blockedReasons: [],
    redactions: [
      {
        fieldCategory: "tenant_contact_details",
        reason: "Tenant contact details are excluded.",
      },
      {
        fieldCategory: "payment_account_details",
        reason: "Payment account details are excluded.",
      },
    ],
    payloadPreview: {},
    ...overrides,
  } as any;
}

function decision(overrides: Partial<DecisionInboxItem> = {}): DecisionInboxItem {
  return {
    id: "decision-1",
    title: "Review missing payment",
    description: "Expected rent payment is missing.",
    severity: "critical",
    status: "open",
    type: "billing",
    source: "lease_ledger",
    relatedEntity: { kind: "lease", id: "lease-1", label: "Lease lease-1" },
    destination: "/leases/lease-1/ledger",
    automationEligible: false,
    workflow: {
      queue: "delinquency_review",
      workflowState: "escalated",
      ownershipType: "landlord",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
    },
    delinquencyActions: [
      {
        actionKey: "view_ledger",
        label: "View ledger",
        description: "Open the ledger.",
        manualOnly: true,
        requiresConfirmation: false,
        policyGuarded: true,
        destination: "/leases/lease-1/ledger",
        status: "available",
        blockedReason: null,
      },
    ],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("deriveAuditComplianceReadiness", () => {
  it("derives deterministic readiness with non-certification safeguards", () => {
    const readiness = deriveAuditComplianceReadiness({
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [{ id: "prop-1", address: "123 Main" }],
      leases: [{ id: "lease-1", propertyId: "prop-1", unitId: "unit-1" }],
      rentPayments: [{ id: "rent-1", leaseId: "lease-1" }],
      decisions: [decision()],
      auditEvents: [{ id: "event-1", domain: "lease" }],
      policyEvents: [{ id: "policy-1", type: "policy.evaluated" }],
      institutionExportPackage: exportPackage(),
    });

    expect(readiness.readinessId).toBe("audit_compliance:landlord_portfolio:landlord-1:portfolio");
    expect(readiness.status).toBe("ready_for_review");
    expect(readiness.manualOnly).toBe(true);
    expect(readiness.certificationIssued).toBe(false);
    expect(readiness.externalFilingEnabled).toBe(false);
    expect(readiness.automatedReportingEnabled).toBe(false);
    expect(readiness.summary).toEqual({ totalChecks: 12, passed: 12, needsAttention: 0, blocked: 0, unavailable: 0 });
    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: "property_identity_present", status: "passed" }),
        expect.objectContaining({ checkKey: "sensitive_data_redacted", status: "passed" }),
        expect.objectContaining({ checkKey: "external_submission_disabled", status: "passed" }),
      ])
    );
    expect(readiness.disclaimers).toContain("Readiness only. This is not legal certification.");
  });

  it("marks missing critical property context as blocked", () => {
    const readiness = deriveAuditComplianceReadiness({
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [],
      leases: [{ id: "lease-1", propertyId: "prop-1", unitId: "unit-1" }],
      institutionExportPackage: exportPackage(),
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkKey: "property_identity_present",
          status: "blocked",
          severity: "critical",
        }),
      ])
    );
  });

  it("uses needs_attention for missing non-critical evidence", () => {
    const readiness = deriveAuditComplianceReadiness({
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [{ id: "prop-1" }],
      leases: [{ id: "lease-1", propertyId: "prop-1", unitId: "unit-1" }],
      rentPayments: [],
      decisions: [],
      auditEvents: [],
      institutionExportPackage: exportPackage(),
    });

    expect(readiness.status).toBe("needs_attention");
    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: "payment_summary_available", status: "needs_attention" }),
        expect.objectContaining({ checkKey: "decision_workflow_reviewable", status: "needs_attention" }),
        expect.objectContaining({ checkKey: "audit_event_coverage", status: "needs_attention" }),
      ])
    );
  });

  it("excludes sensitive raw payloads from readiness output", () => {
    const readiness = deriveAuditComplianceReadiness({
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      properties: [{ id: "prop-1", ownerSsn: "123-45-6789" } as any],
      leases: [{ id: "lease-1", propertyId: "prop-1", unitId: "unit-1", tenantId: "tenant-1" }],
      rentPayments: [{ id: "rent-1", bankAccountNumber: "000123" } as any],
      decisions: [decision()],
      institutionExportPackage: exportPackage(),
    });

    expect(JSON.stringify(readiness)).not.toMatch(/123-45-6789|000123|tenant-1/);
  });
});
