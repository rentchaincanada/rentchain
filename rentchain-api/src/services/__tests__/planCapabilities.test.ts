import { describe, expect, it } from "vitest";
import { capabilitiesForPlan } from "../entitlements/planCapabilities";

describe("planCapabilities entitlement aliases", () => {
  it("includes operational starter capabilities on starter and above", () => {
    const starter = capabilitiesForPlan("starter");
    expect(starter).toContain("move_in_readiness");
    expect(starter).toContain("work_orders");
  });

  it("includes export and review aliases on pro and above", () => {
    const pro = capabilitiesForPlan("pro");
    expect(pro).toContain("pdf_export");
    expect(pro).toContain("review_summary");
    expect(pro).toContain("screening");
  });
});
