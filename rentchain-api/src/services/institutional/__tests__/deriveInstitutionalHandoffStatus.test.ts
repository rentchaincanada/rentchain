import { describe, expect, it } from "vitest";
import { deriveInstitutionalHandoffStatus } from "../deriveInstitutionalHandoffStatus";

describe("deriveInstitutionalHandoffStatus", () => {
  it("returns ready_for_manual_review for valid or warning exports with partial or ready compliance", () => {
    expect(
      deriveInstitutionalHandoffStatus({
        validationStatus: "valid",
        readinessStatus: "ready",
      })
    ).toBe("ready_for_manual_review");

    expect(
      deriveInstitutionalHandoffStatus({
        validationStatus: "valid_with_warnings",
        readinessStatus: "partial",
      })
    ).toBe("ready_for_manual_review");
  });

  it("returns blocked for invalid schema or not_ready compliance", () => {
    expect(
      deriveInstitutionalHandoffStatus({
        validationStatus: "invalid",
        readinessStatus: "ready",
      })
    ).toBe("blocked");

    expect(
      deriveInstitutionalHandoffStatus({
        validationStatus: "valid",
        readinessStatus: "not_ready",
      })
    ).toBe("blocked");
  });
});
