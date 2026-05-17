import { describe, expect, it } from "vitest";
import {
  listSupportedLeaseNoticeRules,
  resolveLeaseNoticeRule,
  resolveLeaseWorkflowConfig,
} from "../leaseNoticeRules";

describe("leaseNoticeRules", () => {
  it("resolves Nova Scotia rules through the jurisdiction workflow registry", () => {
    expect(resolveLeaseNoticeRule({ province: "Nova Scotia", leaseType: "fixed_term" })).toMatchObject({
      province: "NS",
      leaseType: "fixed_term",
      noticeLeadDays: 90,
      templateKey: "ns.fixed_term.renewal_offer.v1",
      ruleVersion: "ns-v1",
    });
    expect(resolveLeaseNoticeRule({ province: "NS", leaseType: "month_to_month" })).toMatchObject({
      province: "NS",
      leaseType: "month_to_month",
      noticeLeadDays: 30,
    });
  });

  it("adds Ontario workflow-review rules without enabling autonomous legal enforcement", () => {
    expect(resolveLeaseNoticeRule({ province: "ON", leaseType: "fixed_term" })).toMatchObject({
      province: "ON",
      leaseType: "fixed_term",
      noticeLeadDays: 60,
      templateKey: "on.fixed_term.workflow_review.v1",
      ruleVersion: "on-v1",
      requireTermDates: false,
    });
    expect(resolveLeaseWorkflowConfig({ province: "ON" })).toMatchObject({
      province: "ON",
      legalAdviceDisclaimer: expect.stringContaining("does not provide legal advice"),
    });
  });

  it("fails closed for unsupported or missing provinces", () => {
    expect(resolveLeaseNoticeRule({ province: "BC", leaseType: "fixed_term" })).toBeNull();
    expect(resolveLeaseNoticeRule({ province: "", leaseType: "fixed_term" })).toBeNull();
    expect(resolveLeaseWorkflowConfig({ province: "BC" })).toBeNull();
    expect(listSupportedLeaseNoticeRules().map((rule) => `${rule.province}:${rule.leaseType}`)).toEqual([
      "NS:fixed_term",
      "NS:year_to_year",
      "NS:month_to_month",
      "ON:fixed_term",
      "ON:month_to_month",
    ]);
  });
});
