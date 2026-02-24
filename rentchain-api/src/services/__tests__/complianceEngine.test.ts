import { describe, expect, it } from "vitest";
import {
  getComplianceRules,
  listComplianceProvinces,
  normalizeComplianceProvince,
} from "../complianceEngine";

describe("complianceEngine", () => {
  it("loads Ontario rules with v1 version", () => {
    const rules = getComplianceRules("ON");
    expect(rules.province).toBe("ON");
    expect(rules.complianceVersion).toBe("v1");
    expect(rules.rentIncrease.minMonthsBetweenIncreases).toBeGreaterThan(0);
    expect(rules.rentIncrease.noticeDays).toBeGreaterThan(0);
    expect(rules.notices.entryNoticeMinHours).toBeGreaterThan(0);
  });

  it("loads NS stub rules", () => {
    const rules = getComplianceRules("NS");
    expect(rules.province).toBe("NS");
    expect(rules.complianceVersion).toBe("v1");
  });

  it("normalizes and validates province codes", () => {
    expect(normalizeComplianceProvince("on")).toBe("ON");
    expect(normalizeComplianceProvince("ns")).toBe("NS");
    expect(normalizeComplianceProvince("bc")).toBeNull();
    expect(listComplianceProvinces()).toEqual(["ON", "NS"]);
  });
});
