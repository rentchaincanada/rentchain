import {
  evaluateSecurityTelemetryRetention,
  summarizeSecurityTelemetryRetention,
} from "../securityTelemetryRetention";
import { describe, expect, it } from "vitest";

describe("security telemetry retention", () => {
  const evaluatedAt = "2026-05-10T12:00:00.000Z";

  it("keeps recent telemetry active and support-visible", () => {
    const decision = evaluateSecurityTelemetryRetention({
      recordedAt: "2026-05-01T12:00:00.000Z",
      evaluatedAt,
    });

    expect(decision).toEqual(
      expect.objectContaining({
        classification: "security_session_internal",
        lifecycleState: "active",
        reason: "within_active_retention",
        activeSupportSignalsIncluded: true,
        forensicChainIncluded: true,
        supportSummaryIncluded: true,
        purgeEligible: false,
        nonPortable: true,
        nonExportable: true,
      })
    );
  });

  it("archives telemetry after the active window without counting it as active", () => {
    const decision = evaluateSecurityTelemetryRetention({
      recordedAt: "2025-09-01T12:00:00.000Z",
      evaluatedAt,
    });

    expect(decision).toEqual(
      expect.objectContaining({
        lifecycleState: "archived",
        reason: "archive_window_reached",
        activeSupportSignalsIncluded: false,
        forensicChainIncluded: true,
        supportSummaryIncluded: true,
        purgeEligible: false,
      })
    );
  });

  it("marks expired telemetry purge eligible and excludes it from summaries", () => {
    const decision = evaluateSecurityTelemetryRetention({
      recordedAt: "2025-04-15T12:00:00.000Z",
      evaluatedAt,
    });

    expect(decision).toEqual(
      expect.objectContaining({
        lifecycleState: "retention_expired",
        reason: "retention_window_expired",
        activeSupportSignalsIncluded: false,
        forensicChainIncluded: false,
        supportSummaryIncluded: false,
        purgeEligible: true,
      })
    );
  });

  it("summarizes lifecycle counts deterministically", () => {
    const decisions = [
      evaluateSecurityTelemetryRetention({ recordedAt: "2026-05-01T12:00:00.000Z", evaluatedAt }),
      evaluateSecurityTelemetryRetention({ recordedAt: "2025-09-01T12:00:00.000Z", evaluatedAt }),
      evaluateSecurityTelemetryRetention({ recordedAt: "2025-04-15T12:00:00.000Z", evaluatedAt }),
    ];

    expect(summarizeSecurityTelemetryRetention(decisions, evaluatedAt)).toEqual(
      expect.objectContaining({
        policyVersion: "security_telemetry_retention.v1",
        classification: "security_session_internal",
        activeCount: 1,
        archivedCount: 1,
        retentionExpiredCount: 1,
        purgePendingCount: 0,
        purgedCount: 0,
        totalEvaluatedCount: 3,
        destructivePurgeJobImplemented: false,
      })
    );
  });
});
