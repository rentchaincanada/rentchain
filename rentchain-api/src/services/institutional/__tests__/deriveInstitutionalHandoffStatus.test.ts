import { describe, expect, it } from "vitest";
import { deriveInstitutionalHandoffStatus } from "../deriveInstitutionalHandoffStatus";

describe("deriveInstitutionalHandoffStatus", () => {
  it("returns ready_for_tenant_managed_release for fully ready valid exports", () => {
    expect(
      deriveInstitutionalHandoffStatus({
        validationStatus: "valid",
        readinessStatus: "ready",
      })
    ).toBe("ready_for_tenant_managed_release");
  });

  it("returns ready_for_manual_review for warning exports or partially ready exports", () => {
    expect(
      deriveInstitutionalHandoffStatus({
        validationStatus: "valid_with_warnings",
        readinessStatus: "partial",
      })
    ).toBe("ready_for_manual_review");

    expect(
      deriveInstitutionalHandoffStatus({
        validationStatus: "valid",
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
