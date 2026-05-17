import { ComplianceRules } from "../types";
import { getJurisdictionWorkflowConfig } from "../../../lib/jurisdiction/leaseWorkflowRegistry";

const workflow = getJurisdictionWorkflowConfig("NS")!;

export const nsComplianceRules: ComplianceRules = {
  province: "NS",
  complianceVersion: "v1",
  rentIncrease: {
    minMonthsBetweenIncreases: 12,
    noticeDays: workflow.noticePeriods.rentIncreaseDays,
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
