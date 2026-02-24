import { ComplianceRules } from "../types";

export const onComplianceRules: ComplianceRules = {
  province: "ON",
  complianceVersion: "v1",
  rentIncrease: {
    minMonthsBetweenIncreases: 12,
    noticeDays: 90,
    exemptions: ["new_unit_exemption_window"],
  },
  leaseEnd: {
    renewalWindowDays: 60,
    fixedTermBehavior: "continues_as_month_to_month_unless_ended_by_valid_notice",
  },
  notices: {
    entryNoticeMinHours: 24,
  },
};
