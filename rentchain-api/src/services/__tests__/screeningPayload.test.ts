import { describe, expect, it } from "vitest";
import { buildScreeningStatusPayload } from "../screening/screeningPayload";

describe("screening payload", () => {
  it("returns expected status shape", () => {
    const payload = buildScreeningStatusPayload({
      screeningStatus: "processing",
      screeningPaidAt: 100,
      screeningStartedAt: 200,
      screeningCompletedAt: null,
      screeningLastUpdatedAt: 300,
      screeningProvider: "manual",
      screeningResultSummary: { overall: "review", scoreBand: "B" },
      screeningResultId: "result_1",
    });

    expect(payload).toEqual({
      status: "processing",
      paidAt: 100,
      startedAt: 200,
      completedAt: null,
      lastUpdatedAt: 300,
      provider: "manual",
      summary: { overall: "review", scoreBand: "B" },
      resultId: "result_1",
    });
  });
});
