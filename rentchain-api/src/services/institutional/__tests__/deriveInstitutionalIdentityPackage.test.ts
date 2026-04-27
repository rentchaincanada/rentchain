import { describe, expect, it } from "vitest";
import { deriveInstitutionalIdentityPackage } from "../deriveInstitutionalIdentityPackage";

describe("deriveInstitutionalIdentityPackage", () => {
  it("builds a structured institutional package from safe reduced inputs", () => {
    const result = deriveInstitutionalIdentityPackage({
      tenantIdentityRecord: {
        identityStatus: "verified",
        profile: { completionStatus: "complete" },
        application: { reusable: true, lastSubmittedAt: "2026-01-01T00:00:00.000Z" },
        documents: { completionStatus: "complete", missingCategories: [] },
        screening: { status: "completed", lastCompletedAt: "2026-01-02T00:00:00.000Z" },
        leases: { activeCount: 1, historicalCount: 1, lastSignedAt: "2026-01-03T00:00:00.000Z" },
        verification: { level: "strong" },
        readinessLabel: "Ready to apply",
        readinessDescription: "ready",
      },
      credibilitySummary: {
        completenessLevel: "high",
        verificationLevel: "strong",
        summaryLabel: "Credibility established",
        summaryDescription: "Most credibility signals are available.",
      },
      leaseExecution: {
        executionStatus: "fully_executed",
        executionLabel: "Lease fully executed",
        executionDescription: "done",
        requiredNextAction: "none",
        tenantSignatureStatus: "completed",
        landlordSignatureStatus: "completed",
        pdfStatus: "generated",
        completedAt: "2026-01-04T00:00:00.000Z",
      },
      paymentReadiness: {
        readinessStatus: "ready_to_configure",
        readinessLabel: "Rent terms ready for future setup",
        readinessDescription: "safe",
        requiredNextAction: "confirm_payment_setup_later",
        rentTerms: {
          rentAmountAvailable: true,
          dueDateAvailable: true,
          leaseDatesAvailable: true,
          tenantLinked: true,
          leaseExecuted: true,
        },
        paymentSetup: {
          processorConnected: false,
          moneyMovementEnabled: false,
          storedPaymentMethod: false,
        },
      },
      identityTimeline: {
        events: [
          {
            type: "application.created",
            label: "Application created",
            description: "A rental application record was started.",
            occurredAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      portableIdentity: {
        portabilityStatus: "ready",
        portabilityLabel: "Ready to reuse",
        portabilityDescription: "ready",
        reusableAcrossApplications: true,
        identityReference: {
          referenceType: "tenant_identity",
          referenceStatus: "active",
        },
        readiness: {
          identityReady: true,
          applicationReusable: true,
          credibilityReady: true,
          sharingEnabled: true,
        },
        nextAction: "none",
      },
      leaseStatus: "active",
    });

    expect(result.identitySummary.identityStatus).toBe("verified");
    expect(result.leaseSummary.activeLease).toBe(true);
    expect(result.auditSummary.totalEvents).toBe(1);
    expect(JSON.stringify(result)).not.toContain("documentUrl");
    expect(JSON.stringify(result)).not.toContain("drawnDataUrl");
    expect(JSON.stringify(result)).not.toContain("paymentMethod");
  });

  it("handles missing data safely without exposing unsupported fields", () => {
    const result = deriveInstitutionalIdentityPackage({
      tenantIdentityRecord: null,
      credibilitySummary: null,
      leaseExecution: null,
      paymentReadiness: null,
      identityTimeline: { events: [] },
      portableIdentity: null,
      leaseStatus: null,
    });

    expect(result.identitySummary.identityStatus).toBe("incomplete");
    expect(result.paymentReadinessSummary.readinessStatus).toBe("not_available");
    expect(result.auditSummary.totalEvents).toBe(0);
  });
});
