import { describe, expect, it } from "vitest";
import { deriveInstitutionalSchemaV2 } from "../deriveInstitutionalSchemaV2";

describe("deriveInstitutionalSchemaV2", () => {
  it("builds a versioned institutional schema envelope from safe v1 inputs", () => {
    const result = deriveInstitutionalSchemaV2({
      packageV1: {
        identitySummary: {
          identityStatus: "verified",
          verificationLevel: "strong",
          completenessLevel: "high",
          readinessLabel: "Ready to apply",
        },
        credibilitySummary: {
          completenessLevel: "high",
          verificationLevel: "strong",
          summaryLabel: "Credibility established",
          summaryDescription: "Most credibility signals are available.",
        },
        leaseSummary: {
          activeLease: true,
          leaseExecutionStatus: "fully_executed",
        },
        paymentReadinessSummary: {
          readinessStatus: "ready_to_configure",
          readinessLabel: "Rent terms ready",
          readinessDescription: "safe",
        },
        auditSummary: {
          totalEvents: 2,
          recentActivity: [
            {
              type: "lease.activated",
              label: "Lease activated",
              occurredAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
        portabilitySummary: {
          portabilityStatus: "ready",
          portabilityLabel: "Ready to reuse",
          reusableAcrossApplications: true,
        },
        metadata: {
          generatedAt: "2026-04-27T00:00:00.000Z",
          dataScope: "tenant_controlled_institutional_readiness",
          consentRequired: true,
        },
      },
      latestPaymentStatus: "payment_pending",
    });

    expect(result.schema.version).toBe("2.0");
    expect(result.rentalHistory.leaseExecutionStatus).toBe("executed");
    expect(result.paymentReadiness.latestPaymentStatus).toBe("pending");
    expect(result.audit.recentActivityAvailable).toBe(true);
    expect(result.complianceReadiness.exportTraceability.schemaVersion).toBe("2.0");
    expect((result.audit as any).recentActivity).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("paymentMethod");
    expect(JSON.stringify(result)).not.toContain("documentUrl");
  });
});
