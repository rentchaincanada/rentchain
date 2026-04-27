import { describe, expect, it } from "vitest";
import { deriveIdentityExchangeReference } from "../deriveIdentityExchangeReference";

describe("deriveIdentityExchangeReference", () => {
  it("derives an available reference from ready portability and safe readiness signals", () => {
    const result = deriveIdentityExchangeReference({
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
      auditTimelineReady: true,
      paymentReadinessAvailable: true,
      sharingControlsReady: true,
    });

    expect(result.referenceStatus).toBe("available");
    expect(result.referenceType).toBe("tenant_identity_reference");
    expect(result.exchangeReadiness.identityReady).toBe(true);
  });

  it("derives a limited reference when only partial signals exist", () => {
    const result = deriveIdentityExchangeReference({
      portableIdentity: {
        portabilityStatus: "limited",
        portabilityLabel: "Almost portable",
        portabilityDescription: "limited",
        reusableAcrossApplications: false,
        identityReference: {
          referenceType: "tenant_identity",
          referenceStatus: "limited",
        },
        readiness: {
          identityReady: true,
          applicationReusable: false,
          credibilityReady: false,
          sharingEnabled: false,
        },
        nextAction: "review_reusability",
      },
      auditTimelineReady: false,
      paymentReadinessAvailable: false,
      sharingControlsReady: false,
    });

    expect(result.referenceStatus).toBe("limited");
  });

  it("derives not_ready when no safe readiness signals are present", () => {
    const result = deriveIdentityExchangeReference({
      portableIdentity: null,
      auditTimelineReady: false,
      paymentReadinessAvailable: false,
      sharingControlsReady: false,
    });

    expect(result.referenceStatus).toBe("not_ready");
    expect(result.exchangeReadiness.credibilityReady).toBe(false);
  });
});
