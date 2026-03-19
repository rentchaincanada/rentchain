import { describe, expect, it } from "vitest";
import { buildCredibilityInsights, deriveCredibilityTrend } from "../risk/credibilityInsights";

describe("credibilityInsights", () => {
  it("derives trend directions from the latest two timeline scores", () => {
    expect(deriveCredibilityTrend([{ score: 72 }, { score: 79 }])).toBe("up");
    expect(deriveCredibilityTrend([{ score: 79 }, { score: 72 }])).toBe("down");
    expect(deriveCredibilityTrend([{ score: 79 }, { score: 79 }])).toBe("flat");
    expect(deriveCredibilityTrend([{ score: 79 }])).toBe("unknown");
  });

  it("builds compact tenant score and lease risk summaries safely", () => {
    const insights = buildCredibilityInsights({
      tenant: {
        tenantScore: {
          version: "tenant-score-v1",
          score: 78,
          grade: "B",
          confidence: 0.81,
          factors: {
            leaseRisk: 75,
            paymentBehavior: 83,
            stability: 74,
            historyDepth: 68,
          },
          signals: ["Consistent lease history", "Low missed payment count", "Recent risk improved"],
          recommendations: ["Monitor after the next rent cycle", "Verify income docs on renewal"],
          derivedFrom: {
            activeLeaseCount: 1,
            completedLeaseCount: 1,
            latestLeaseRiskScore: 64,
            averageLeaseRiskScore: 71,
            onTimePaymentRatio: 0.94,
          },
          generatedAt: "2026-03-18T10:00:00.000Z",
        },
        tenantScoreValue: 78,
        tenantScoreGrade: "B",
        tenantScoreConfidence: 0.81,
        tenantScoreTimeline: [
          {
            generatedAt: "2026-03-10T10:00:00.000Z",
            version: "tenant-score-v1",
            score: 72,
            grade: "B",
            confidence: 0.74,
            trigger: "tenant_recompute",
            signals: ["Stable tenancy"],
          },
          {
            generatedAt: "2026-03-18T10:00:00.000Z",
            version: "tenant-score-v1",
            score: 78,
            grade: "B",
            confidence: 0.81,
            trigger: "lease_recompute",
            signals: ["Recent risk improved"],
          },
        ],
      },
      leaseRaw: {
        risk: {
          version: "risk-v1",
          score: 64,
          grade: "C",
          confidence: 0.76,
          flags: ["High rent-to-income"],
          recommendations: ["Review income verification"],
          factors: {},
          inputs: {},
          generatedAt: "2026-03-18T10:00:00.000Z",
        },
      },
    });

    expect(insights.tenantScore).toEqual(
      expect.objectContaining({
        score: 78,
        grade: "B",
        confidence: 0.81,
        trend: "up",
        signals: ["Consistent lease history", "Low missed payment count", "Recent risk improved"],
      })
    );
    expect(insights.leaseRisk).toEqual(
      expect.objectContaining({
        score: 64,
        grade: "C",
        confidence: 0.76,
        flags: ["High rent-to-income"],
        recommendations: ["Review income verification"],
      })
    );
  });

  it("returns null summaries when score and risk data are absent", () => {
    expect(buildCredibilityInsights({ tenant: null, leaseRaw: null })).toEqual({
      tenantScore: null,
      leaseRisk: null,
    });
  });
});
