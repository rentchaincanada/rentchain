import { describe, expect, it } from "vitest";
import {
  getScreeningProviderOptions,
  normalizeScreeningWorkflowState,
  screeningProviderAvailabilityLabel,
} from "./screeningWorkflowProviders";

describe("screeningWorkflowProviders", () => {
  it("returns deterministic provider options with only configured paths marked live", () => {
    const options = getScreeningProviderOptions({ screeningEnabled: true, transUnionConnected: true });

    expect(options.map((option) => option.key)).toEqual([
      "transunion",
      "certn",
      "equifax",
      "manual_offline",
      "future_provider",
    ]);
    expect(options.find((option) => option.key === "transunion")).toMatchObject({
      availability: "available",
      live: true,
    });
    expect(options.find((option) => option.key === "certn")).toMatchObject({
      availability: "coming_soon",
      live: false,
    });
    expect(options.find((option) => option.key === "equifax")).toMatchObject({
      availability: "coming_soon",
      live: false,
    });
    expect(options.find((option) => option.key === "manual_offline")).toMatchObject({
      availability: "manual",
      live: true,
    });
  });

  it("requires setup for TransUnion when credentials are not connected", () => {
    const options = getScreeningProviderOptions({ screeningEnabled: true, transUnionConnected: false });

    expect(options.find((option) => option.key === "transunion")).toMatchObject({
      availability: "requires_setup",
      live: false,
    });
  });

  it("normalizes legacy screening status names into provider-agnostic states", () => {
    expect(normalizeScreeningWorkflowState("requested")).toBe("awaiting_applicant");
    expect(normalizeScreeningWorkflowState("processing")).toBe("in_progress");
    expect(normalizeScreeningWorkflowState("complete")).toBe("completed");
    expect(normalizeScreeningWorkflowState("blocked_transunion_not_connected")).toBe("blocked");
    expect(screeningProviderAvailabilityLabel("requires_setup")).toBe("Requires setup");
  });
});
