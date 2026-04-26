import { describe, expect, it } from "vitest";
import {
  canonicalPlanLabel,
  capabilitiesForPlan,
  requiredPlanForCapability,
  resolveCanonicalPlan,
} from "../entitlements/planCapabilities";

describe("planCapabilities entitlement aliases", () => {
  it("includes operational starter capabilities on starter and above", () => {
    const starter = capabilitiesForPlan("starter");
    expect(starter).toContain("portfolio_health_summary");
    expect(starter).toContain("move_in_readiness");
    expect(starter).toContain("work_orders");
  });

  it("includes export and review aliases on pro and above", () => {
    const pro = capabilitiesForPlan("pro");
    expect(pro).toContain("marketplace_directory");
    expect(pro).toContain("portfolio_score");
    expect(pro).toContain("pdf_export");
    expect(pro).toContain("review_summary");
    expect(pro).toContain("screening");
    expect(pro).toContain("registry_filing_access");
    expect(pro).toContain("registry_attempts_history");
  });

  it("includes advanced recommendation intelligence on elite", () => {
    const elite = capabilitiesForPlan("elite");
    expect(elite).toContain("marketplace_contractor_assignment");
    expect(elite).toContain("portfolio_action_recommendations");
    expect(elite).toContain("portfolio_score");
    expect(elite).toContain("portfolio_health_summary");
  });

  it("resolves required plan for marketplace capabilities", () => {
    expect(requiredPlanForCapability("marketplace_directory")).toBe("pro");
    expect(requiredPlanForCapability("marketplace_contractor_assignment")).toBe("elite");
  });

  it("normalizes legacy aliases into canonical plans", () => {
    expect(resolveCanonicalPlan("screening")).toBe("free");
    expect(resolveCanonicalPlan("core")).toBe("starter");
    expect(resolveCanonicalPlan("business")).toBe("elite");
    expect(resolveCanonicalPlan("enterprise")).toBe("elite");
  });

  it("returns canonical display labels", () => {
    expect(canonicalPlanLabel("screening")).toBe("Free");
    expect(canonicalPlanLabel("core")).toBe("Starter");
    expect(canonicalPlanLabel("pro")).toBe("Pro");
    expect(canonicalPlanLabel("elite")).toBe("Elite");
  });
});
