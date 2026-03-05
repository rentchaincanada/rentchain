import { describe, expect, it } from "vitest";
import { renderTuReferralEmail, type TuReferralMetricsPayload } from "../metrics/tuReferralReport";

const payload: TuReferralMetricsPayload = {
  ok: true,
  month: "2026-03",
  metrics: {
    referralClicks: 8,
    completedScreenings: 5,
    activeLandlords: 4,
    screeningsPerLandlord: 1.25,
    conversionRate: 0.625,
  },
  dailyInitiated: [
    { day: "2026-03-01", count: 2 },
    { day: "2026-03-02", count: 6 },
  ],
  dailyCompleted: [
    { day: "2026-03-01", count: 1 },
    { day: "2026-03-02", count: 4 },
  ],
};

describe("renderTuReferralEmail", () => {
  it("returns expected subject and summary sections", () => {
    const result = renderTuReferralEmail(payload, {
      csv: "gs://bucket/reports/tu.csv",
      json: "gs://bucket/reports/tu.json",
    });

    expect(result.subject).toBe("[RentChain] TransUnion Referral Metrics — 2026-03");
    expect(result.body).toContain("Summary:");
    expect(result.body).toContain("- Referral clicks: 8");
    expect(result.body).toContain("- Completed screenings: 5");
    expect(result.body).toContain("Daily Activity:");
    expect(result.body).toContain("2026-03-01");
    expect(result.body).toContain("Top Day:");
    expect(result.body).toContain("Artifact links:");
    expect(result.body).toContain("gs://bucket/reports/tu.csv");
    expect(result.body).toContain("gs://bucket/reports/tu.json");
  });

  it("renders fallback artifact labels when links are missing", () => {
    const result = renderTuReferralEmail(payload, null);
    expect(result.body).toContain("- CSV: not_uploaded");
    expect(result.body).toContain("- JSON: not_uploaded");
  });
});
