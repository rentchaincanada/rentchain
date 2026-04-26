import { describe, expect, it } from "vitest";
import { deriveFeedbackSignals } from "../deriveFeedbackSignals";

describe("deriveFeedbackSignals", () => {
  it("aggregates sentiment ratios and dominant sentiment", () => {
    const signals = deriveFeedbackSignals([
      {
        version: "v1",
        id: "f1",
        type: "screening_experience",
        resource: { type: "screening_order", id: "screen-1", portfolioId: "landlord-1" },
        sentiment: "positive",
        tags: [],
        createdAt: "2026-04-16T12:00:00.000Z",
      },
      {
        version: "v1",
        id: "f2",
        type: "screening_experience",
        resource: { type: "screening_order", id: "screen-2", portfolioId: "landlord-1" },
        sentiment: "negative",
        tags: [],
        createdAt: "2026-04-16T12:00:00.000Z",
      },
      {
        version: "v1",
        id: "f3",
        type: "screening_experience",
        resource: { type: "screening_order", id: "screen-3", portfolioId: "landlord-1" },
        sentiment: "positive",
        tags: [],
        createdAt: "2026-04-16T12:00:00.000Z",
      },
    ]);

    expect(signals).toEqual([
      expect.objectContaining({
        type: "screening_experience",
        positiveRatio: 0.67,
        negativeRatio: 0.33,
        dominant: "positive",
        signalStrength: "weak",
      }),
    ]);
  });

  it("returns empty when no feedback exists", () => {
    expect(deriveFeedbackSignals([])).toEqual([]);
  });
});
