import { describe, expect, it } from "vitest";
import {
  getJurisdictionWorkflow,
  getLeaseWorkflowConfig,
  getProvinceOperationalRules,
} from "./jurisdictionLeaseWorkflow";

describe("jurisdictionLeaseWorkflow", () => {
  it("derives NS and ON operational workflow UI config", () => {
    expect(getJurisdictionWorkflow("Nova Scotia")).toMatchObject({
      province: "NS",
      badgeLabel: "NS Residential",
      supportsLeaseGeneration: true,
      guidanceCopy: expect.stringContaining("Workflow guidance only"),
    });
    expect(getLeaseWorkflowConfig("ON")).toMatchObject({
      province: "ON",
      badgeLabel: "ON Residential",
      supportsLeaseGeneration: false,
    });
  });

  it("falls back safely for unsupported or missing province", () => {
    expect(getProvinceOperationalRules("BC")).toBeNull();
    expect(getJurisdictionWorkflow(null)).toBeNull();
  });
});
