import { describe, expect, it } from "vitest";
import { deriveAnalyticsDelta } from "../deriveAnalyticsDeltas";

describe("deriveAnalyticsDelta", () => {
  it("uses metric-aware better/worse semantics", () => {
    expect(
      deriveAnalyticsDelta({
        current: 0.12,
        prior: 0.08,
        preference: "lower_better",
      })
    ).toEqual({
      current: 0.12,
      prior: 0.08,
      absoluteDelta: 0.04,
      relativeDelta: 0.5,
      direction: "worse",
    });

    expect(
      deriveAnalyticsDelta({
        current: 0.55,
        prior: 0.4,
        preference: "higher_better",
      })
    ).toEqual({
      current: 0.55,
      prior: 0.4,
      absoluteDelta: 0.15,
      relativeDelta: 0.375,
      direction: "better",
    });
  });

  it("returns insufficient_data cleanly when no comparable prior value exists", () => {
    expect(
      deriveAnalyticsDelta({
        current: 3,
        prior: null,
        preference: "higher_better",
      })
    ).toEqual({
      current: 3,
      prior: null,
      absoluteDelta: null,
      relativeDelta: null,
      direction: "insufficient_data",
    });
  });
});
