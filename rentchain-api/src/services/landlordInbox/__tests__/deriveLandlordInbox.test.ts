import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  collection: vi.fn(),
};

const buildReviewSummary = vi.fn();
const loadLandlordSafeTenantIdentitySummary = vi.fn();
const deriveLandlordSafeApplicationReusableFromApplication = vi.fn();
const deriveLandlordTrustContext = vi.fn();
const deriveTenantCredibilitySignals = vi.fn();
const deriveLeaseExecution = vi.fn();

vi.mock("../../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../../lib/reviewSummary", () => ({
  buildReviewSummary,
}));

vi.mock("../../../lib/trust/deriveLandlordTrustContext", () => ({
  deriveLandlordTrustContext,
}));

vi.mock("../../tenantPortal/tenantProfileService", () => ({
  loadLandlordSafeTenantIdentitySummary,
  deriveLandlordSafeApplicationReusableFromApplication,
}));

vi.mock("../../tenantCredibility/deriveTenantCredibilitySignals", () => ({
  deriveTenantCredibilitySignals,
}));

vi.mock("../../leaseExecution/deriveLeaseExecution", () => ({
  deriveLeaseExecution,
}));

function makeDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  };
}

describe("deriveLandlordInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.collection.mockImplementation((name: string) => ({
      get: vi.fn().mockResolvedValue({
        docs:
          name === "rentalApplications"
            ? [
                makeDoc("app-1", {
                  landlordId: "landlord-1",
                  propertyId: "prop-1",
                  status: "submitted",
                }),
              ]
            : [
                makeDoc("lease-1", {
                  landlordId: "landlord-1",
                  propertyId: "prop-1",
                  applicationId: "app-1",
                  status: "awaiting_landlord_signature",
                }),
              ],
      }),
    }));
    buildReviewSummary.mockReturnValue({
      derived: {
        completeness: { score: 0.82 },
        flags: ["income_pending"],
      },
      screening: {
        status: "in_progress",
      },
    });
    loadLandlordSafeTenantIdentitySummary.mockResolvedValue({
      identityStatus: "ready",
      verification: { level: "partial" },
      readinessLabel: "Ready for review",
      readinessDescription: "Current application signals are organized for review.",
    });
    deriveLandlordSafeApplicationReusableFromApplication.mockReturnValue(true);
    deriveLandlordTrustContext.mockReturnValue({
      trustReadiness: "ready",
      trustLabel: "Ready for review",
      trustDescription: "Current application context is ready for landlord review.",
      positiveSignals: [],
      missingSignals: [],
      cautionSignals: [],
      recommendedNextAction: "review_application",
      decisionSupportLevel: "medium",
    });
    deriveTenantCredibilitySignals.mockReturnValue({
      landlordSafeSummary: {
        completenessLevel: "medium",
        verificationLevel: "partial",
        summaryLabel: "Building credibility",
        summaryDescription: "Some credibility signals are available.",
      },
    });
    deriveLeaseExecution.mockReturnValue({
      executionStatus: "ready_for_landlord_signature",
      executionLabel: "Waiting for landlord signature",
      executionDescription: "Tenant signing appears complete and the next visible execution step belongs to the landlord.",
      requiredNextAction: "landlord_signature",
      tenantSignatureStatus: "completed",
      landlordSignatureStatus: "needed",
      pdfStatus: "generated",
      completedAt: null,
    });
  });

  it("builds inbox items from review-summary-compatible application context", async () => {
    const { deriveLandlordInbox } = await import("../deriveLandlordInbox");
    const result = await deriveLandlordInbox({
      landlordId: "landlord-1",
      analyticsDecisions: [],
    });

    expect(result.summary.actionRequired).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "application:app-1",
        type: "application",
        nextAction: "review_application",
        nextActionHref: "/applications/app-1/review-summary",
        trustSummary: {
          readiness: "ready",
          verificationLevel: "partial",
        },
        credibilitySummary: {
          completenessLevel: "medium",
        },
        source: "review_summary",
      }),
    ]);
  });

  it("uses analytics decisions as overlays instead of creating duplicates", async () => {
    const { deriveLandlordInbox } = await import("../deriveLandlordInbox");
    const result = await deriveLandlordInbox({
      landlordId: "landlord-1",
      analyticsDecisions: [
        {
          id: "start_screening_checkout:app-1",
          decisionType: "start_screening_checkout",
          priority: "high",
          explanation: "Start screening",
          supportingSignals: [],
          recommendedAction: "Start screening",
          actionKey: "open_screening_checkout_flow",
          actionLabel: "Start screening checkout",
          destination: "/applications/app-1/review-summary",
          workflowCategory: "screening_checkout",
          automationEligible: false,
          automationState: "manual_only",
          automationReason: null,
          executionMappingState: "none",
          executionMapping: null,
          executionInputState: "none",
          executionInputReason: null,
          executionInputMissingFields: [],
          executionInput: null,
          executionState: "blocked",
          blockedReason: "automation_disabled",
          executionGuardKey: null,
          duplicateGuardActive: false,
          executionSummary: {
            lastExecutedAt: null,
            executionCount: 0,
            lastExecutionOutcome: "none",
            lastExecutionOutcomeAt: null,
          },
          executedAt: null,
          executionOutcomeStatus: "none",
          executionOutcomeAt: null,
          executionOutcomeReason: null,
          state: "pending",
          reviewedAt: null,
          trustContext: null,
        },
      ],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("application:app-1");
    expect(result.items[0]?.priority).toBe("high");
  });

  it("creates a lease item only when it is landlord-actionable and not duplicated by an application item", async () => {
    dbMock.collection.mockImplementation((name: string) => ({
      get: vi.fn().mockResolvedValue({
        docs:
          name === "rentalApplications"
            ? []
            : [
                makeDoc("lease-1", {
                  landlordId: "landlord-1",
                  propertyId: "prop-1",
                  status: "awaiting_landlord_signature",
                }),
              ],
      }),
    }));

    const { deriveLandlordInbox } = await import("../deriveLandlordInbox");
    const result = await deriveLandlordInbox({
      landlordId: "landlord-1",
      analyticsDecisions: [],
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: "lease:lease-1",
        type: "lease",
        nextAction: "prepare_lease",
        nextActionHref: "/leases/lease-1/ledger",
        source: "lease_execution",
      }),
    ]);
  });
});
