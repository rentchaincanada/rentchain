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
    expect(rules.rentIncrease).toMatchObject({
      minMonthsBetweenIncreases: 12,
      noticeDays: 90,
    });
    expect(rules.notices.entryNoticeMinHours).toBe(24);
    expect(rules.workflow).toMatchObject({
      leaseTemplateType: "standard_residential_on",
      fixedTermContinuation: "continues_periodic",
      legalAdviceDisclaimer: expect.stringContaining("does not provide legal advice"),
    });
  });

  it("loads Nova Scotia workflow rules", () => {
    const rules = getComplianceRules("NS");
    expect(rules.province).toBe("NS");
    expect(rules.complianceVersion).toBe("v1");
    expect(rules.rentIncrease.noticeDays).toBe(120);
    expect(rules.leaseEnd.renewalWindowDays).toBe(90);
    expect(rules.workflow).toMatchObject({
      leaseTemplateType: "standard_residential_ns_form_p",
      fixedTermContinuation: "ends_on_term_end",
    });
  });

  it("normalizes and validates province codes", () => {
    expect(normalizeComplianceProvince("on")).toBe("ON");
    expect(normalizeComplianceProvince("ns")).toBe("NS");
    expect(normalizeComplianceProvince("bc")).toBeNull();
    expect(listComplianceProvinces()).toEqual(["ON", "NS"]);
  });
});
