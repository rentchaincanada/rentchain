import { ComplianceRules } from "../types";

export const nsComplianceRules: ComplianceRules = {
  province: "NS",
  complianceVersion: "v1",
  rentIncrease: {
    minMonthsBetweenIncreases: 12,
    noticeDays: 4,
  },
  leaseEnd: {
    renewalWindowDays: 60,
    fixedTermBehavior: "stub_v1_review_required_before_automation",
  },
  notices: {
    entryNoticeMinHours: 24,
  },
};
