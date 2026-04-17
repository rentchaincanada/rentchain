import { describe, expect, it } from "vitest";
import {
  isPlanAtLeast,
  normalizePaidPlan,
  normalizePlan,
  planLabel,
  resolvePlanFrom,
} from "./plan";

describe("plan normalization", () => {
  it("normalizes legacy aliases to canonical plans", () => {
    expect(normalizePlan("screening")).toBe("free");
    expect(normalizePlan("core")).toBe("starter");
    expect(normalizePlan("business")).toBe("elite");
    expect(normalizePlan("enterprise")).toBe("elite");
  });

  it("resolves paid plans without treating free aliases as paid", () => {
    expect(normalizePaidPlan("starter")).toBe("starter");
    expect(normalizePaidPlan("core")).toBe("starter");
    expect(normalizePaidPlan("screening")).toBeNull();
  });

  it("provides canonical labels and ordering", () => {
    expect(planLabel("free")).toBe("Free");
    expect(planLabel("elite")).toBe("Elite");
    expect(isPlanAtLeast("elite", "pro")).toBe(true);
    expect(isPlanAtLeast("free", "starter")).toBe(false);
  });

  it("prefers limits and me payloads when resolving plan context", () => {
    expect(resolvePlanFrom({ limits: { plan: "core" } })).toBe("starter");
    expect(resolvePlanFrom({ me: { plan: "business" } })).toBe("elite");
    expect(resolvePlanFrom({})).toBe("free");
  });
});
