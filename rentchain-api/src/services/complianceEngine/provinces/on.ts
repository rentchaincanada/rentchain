import { ComplianceRules } from "../types";
import { getJurisdictionWorkflowConfig } from "../../../lib/jurisdiction/leaseWorkflowRegistry";

const workflow = getJurisdictionWorkflowConfig("ON")!;

export const onComplianceRules: ComplianceRules = {
  province: "ON",
  complianceVersion: "v1",
  rentIncrease: {
    minMonthsBetweenIncreases: 12,
    noticeDays: workflow.noticePeriods.rentIncreaseDays,
    exemptions: ["new_unit_exemption_window"],
  },
  leaseEnd: {
    renewalWindowDays: workflow.defaultWorkflow.leaseRenewalReminderDays,
    fixedTermBehavior: workflow.leaseLifecycleExpectations.fixedTermContinuation,
  },
  notices: {
    entryNoticeMinHours: workflow.noticePeriods.entryNoticeHours,
  },
  workflow: {
    leaseTemplateType: workflow.leaseTemplateType,
    leaseRenewalReminderDays: workflow.defaultWorkflow.leaseRenewalReminderDays,
    moveOutPreparationDays: workflow.defaultWorkflow.moveOutPreparationDays,
    fixedTermContinuation: workflow.leaseLifecycleExpectations.fixedTermContinuation,
    supportedNoticeTypes: workflow.supportedNoticeTypes,
    legalAdviceDisclaimer: workflow.legalAdviceDisclaimer,
  },
};
