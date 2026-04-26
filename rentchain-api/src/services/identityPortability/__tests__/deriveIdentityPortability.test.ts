import { describe, expect, it } from "vitest";
import { deriveIdentityPortability } from "../deriveIdentityPortability";
import type { TenantIdentityRecord } from "../../tenantPortal/tenantProfileService";

function buildRecord(overrides?: Partial<TenantIdentityRecord>): TenantIdentityRecord {
  return {
    identityStatus: "ready",
    profile: { completionStatus: "complete" },
    application: { reusable: true, lastSubmittedAt: "2026-01-01T00:00:00.000Z" },
    documents: { completionStatus: "complete", missingCategories: [] },
    screening: { status: "completed", lastCompletedAt: "2026-01-02T00:00:00.000Z" },
    leases: { activeCount: 1, historicalCount: 0, lastSignedAt: "2026-02-01T00:00:00.000Z" },
    verification: { level: "strong" },
    readinessLabel: "Ready to apply",
    readinessDescription: "Ready",
    ...overrides,
  };
}

describe("deriveIdentityPortability", () => {
  it("fails closed to not_ready when data is missing", () => {
    const result = deriveIdentityPortability({
      tenantIdentityRecord: null,
      credibilitySummary: null,
      shareAvailability: { sharingEnabled: false },
      timelineAvailability: null,
    });

    expect(result.portableIdentity.portabilityStatus).toBe("not_ready");
    expect(result.portableIdentity.reusableAcrossApplications).toBe(false);
    expect(result.portableIdentity.readiness).toEqual({
      identityReady: false,
      applicationReusable: false,
      credibilityReady: false,
      sharingEnabled: false,
    });
  });

  it("derives ready when identity, reuse, and credibility are organized", () => {
    const result = deriveIdentityPortability({
      tenantIdentityRecord: buildRecord(),
      credibilitySummary: {
        completenessLevel: "high",
        verificationLevel: "strong",
        summaryLabel: "Credibility established",
        summaryDescription: "Most signals are available.",
      },
      shareAvailability: { sharingEnabled: true },
      timelineAvailability: { hasIdentityTimeline: true },
    });

    expect(result.portableIdentity.portabilityStatus).toBe("ready");
    expect(result.portableIdentity.portabilityLabel).toBe("Ready to reuse");
    expect(result.portableIdentity.reusableAcrossApplications).toBe(true);
    expect(result.portableIdentitySummary.reusableAcrossApplications).toBe(true);
  });

  it("derives limited for partial readiness without exposing extra internals", () => {
    const result = deriveIdentityPortability({
      tenantIdentityRecord: buildRecord({
        profile: { completionStatus: "in_progress" },
        application: { reusable: false, lastSubmittedAt: null },
      }),
      credibilitySummary: {
        completenessLevel: "medium",
        verificationLevel: "partial",
        summaryLabel: "Building credibility",
        summaryDescription: "Some signals are available.",
      },
      shareAvailability: { sharingEnabled: true },
      timelineAvailability: null,
    });

    expect(result.portableIdentity.portabilityStatus).toBe("limited");
    expect(result.portableIdentity.nextAction).toBe("review_reusability");
    expect(result.portableIdentitySummary).toEqual({
      portabilityStatus: "limited",
      portabilityLabel: "Almost portable",
      portabilityDescription:
        "Some portability foundations are in place, but a few identity or application details still need attention.",
      reusableAcrossApplications: false,
    });
  });
});
