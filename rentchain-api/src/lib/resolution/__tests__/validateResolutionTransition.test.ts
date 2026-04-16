import { describe, expect, it } from "vitest";
import { validateResolutionTransition } from "../validateResolutionTransition";

describe("validateResolutionTransition", () => {
  it("allows valid transitions", () => {
    expect(() => validateResolutionTransition("open", "acknowledged")).not.toThrow();
    expect(() => validateResolutionTransition("acknowledged", "in_progress")).not.toThrow();
    expect(() => validateResolutionTransition("in_progress", "resolved")).not.toThrow();
  });

  it("rejects invalid transitions cleanly", () => {
    expect(() => validateResolutionTransition("open", "resolved")).toThrow(/cannot move/i);
    expect(() => validateResolutionTransition("resolved", "acknowledged")).toThrow(/cannot move/i);
  });
});
