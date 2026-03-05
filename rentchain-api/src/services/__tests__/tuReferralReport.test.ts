import { describe, expect, it } from "vitest";
import { renderTuReferralCsv, type TuReferralMetricsPayload } from "../metrics/tuReferralReport";

describe("tuReferralReport csv rendering", () => {
  it("renders daily rows with initiated/completed counts", () => {
    const payload: TuReferralMetricsPayload = {
      ok: true,
      month: "2026-03",
      metrics: {
        referralClicks: 5,
        completedScreenings: 3,
        activeLandlords: 2,
        screeningsPerLandlord: 1.5,
        conversionRate: 0.6,
      },
      dailyInitiated: [
        { day: "2026-03-01", count: 2 },
        { day: "2026-03-02", count: 3 },
      ],
      dailyCompleted: [
        { day: "2026-03-02", count: 1 },
        { day: "2026-03-03", count: 2 },
      ],
    };

    const csv = renderTuReferralCsv(payload);
    expect(csv).toContain("day,initiated_count,completed_count");
    expect(csv).toContain("2026-03-01,2,0");
    expect(csv).toContain("2026-03-02,3,1");
    expect(csv).toContain("2026-03-03,0,2");
  });
});

