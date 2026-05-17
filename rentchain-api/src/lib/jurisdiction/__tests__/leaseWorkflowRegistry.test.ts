import { describe, expect, it } from "vitest";
import {
  getJurisdictionWorkflow,
  getJurisdictionWorkflowConfig,
  getLeaseWorkflowConfig,
  getProvinceOperationalRules,
  listSupportedJurisdictionWorkflowProvinces,
  normalizeLeaseWorkflowProvince,
  toJurisdictionWorkflowSummary,
} from "../leaseWorkflowRegistry";

describe("leaseWorkflowRegistry", () => {
  it("normalizes only the supported v1 provinces", () => {
    expect(normalizeLeaseWorkflowProvince("Nova Scotia")).toBe("NS");
    expect(normalizeLeaseWorkflowProvince("on")).toBe("ON");
    expect(normalizeLeaseWorkflowProvince("BC")).toBeNull();
    expect(listSupportedJurisdictionWorkflowProvinces()).toEqual(["NS", "ON"]);
  });

  it("derives Nova Scotia workflow metadata without legal automation", () => {
    const config = getJurisdictionWorkflowConfig("NS");
    expect(config).toMatchObject({
      province: "NS",
      leaseTemplateType: "standard_residential_ns_form_p",
      noticePeriods: {
        rentIncreaseDays: 120,
        entryNoticeHours: 24,
        leaseTerminationByLeaseType: {
          fixed_term: 0,
          year_to_year: 90,
          month_to_month: 30,
        },
      },
      leaseLifecycleExpectations: {
        fixedTermContinuation: "ends_on_term_end",
        activeRequiresExecutionReview: true,
      },
      confidence: "medium",
    });
    expect(config?.legalAdviceDisclaimer).toContain("does not provide legal advice");
    expect(config?.supportedNoticeTypes).toContain("renewal_review");
  });

  it("derives Ontario workflow metadata and keeps fixed-term continuation distinct", () => {
    const config = getJurisdictionWorkflowConfig("ON");
    expect(config).toMatchObject({
      province: "ON",
      leaseTemplateType: "standard_residential_on",
      noticePeriods: {
        rentIncreaseDays: 90,
        entryNoticeHours: 24,
        leaseTerminationByLeaseType: {
          fixed_term: 60,
          month_to_month: 60,
        },
      },
      leaseLifecycleExpectations: {
        fixedTermContinuation: "continues_periodic",
        activeRequiresExecutionReview: true,
      },
      confidence: "medium",
    });
  });

  it("returns a source-free operational summary for API payloads", () => {
    const config = getJurisdictionWorkflowConfig("ON");
    expect(config).toBeTruthy();
    const summary = toJurisdictionWorkflowSummary(config!);
    expect(summary).toEqual(
      expect.objectContaining({
        province: "ON",
        legalAdviceDisclaimer: expect.any(String),
        guidance: expect.any(Object),
      })
    );
    expect(summary).not.toHaveProperty("sources");
  });

  it("exposes mission-named helper aliases for downstream workflow callers", () => {
    expect(getJurisdictionWorkflow("NS")?.province).toBe("NS");
    expect(getLeaseWorkflowConfig("ON")?.province).toBe("ON");
    expect(getProvinceOperationalRules("Ontario")).toMatchObject({
      province: "ON",
      leaseTemplateType: "standard_residential_on",
    });
    expect(getProvinceOperationalRules("BC")).toBeNull();
  });
});
