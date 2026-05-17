import {
  getJurisdictionWorkflowConfig,
  listJurisdictionWorkflowConfigs,
  normalizeLeaseWorkflowProvince,
} from "../lib/jurisdiction/leaseWorkflowRegistry";

export type LeaseNoticeWorkflowFlag = {
  enabled: boolean;
  source: string;
};

export type LeaseStatusWorkflow =
  | "active"
  | "notice_pending"
  | "renewal_pending"
  | "renewal_accepted"
  | "move_out_pending"
  | "ended"
  | "archived";

export type LeaseType = "fixed_term" | "year_to_year" | "month_to_month";
export type RentChangeMode = "no_change" | "increase" | "decrease" | "undecided";
export type LeaseNoticeType =
  | "renewal_offer"
  | "end_of_term_notice"
  | "non_renewal"
  | "month_to_month_notice";

export type LeaseNoticeRule = {
  province: string;
  leaseType: LeaseType;
  noticeLeadDays: number;
  templateKey: string;
  allowedNoticeTypes: LeaseNoticeType[];
  allowUndecidedRent: boolean;
  requireTermDates: boolean;
  ruleVersion: string;
};

function buildRules(): LeaseNoticeRule[] {
  const rules: LeaseNoticeRule[] = [];
  for (const workflow of listJurisdictionWorkflowConfigs()) {
    if (workflow.province === "NS") {
      rules.push(
        {
          province: "NS",
          leaseType: "fixed_term",
          noticeLeadDays: workflow.defaultWorkflow.leaseRenewalReminderDays,
          templateKey: "ns.fixed_term.renewal_offer.v1",
          allowedNoticeTypes: ["renewal_offer", "end_of_term_notice"],
          allowUndecidedRent: true,
          requireTermDates: true,
          ruleVersion: "ns-v1",
        },
        {
          province: "NS",
          leaseType: "year_to_year",
          noticeLeadDays: workflow.noticePeriods.leaseTerminationByLeaseType.year_to_year || 90,
          templateKey: "ns.year_to_year.notice.v1",
          allowedNoticeTypes: ["renewal_offer", "end_of_term_notice"],
          allowUndecidedRent: true,
          requireTermDates: true,
          ruleVersion: "ns-v1",
        },
        {
          province: "NS",
          leaseType: "month_to_month",
          noticeLeadDays: workflow.noticePeriods.leaseTerminationByLeaseType.month_to_month || 30,
          templateKey: "ns.month_to_month.notice.v1",
          allowedNoticeTypes: ["month_to_month_notice", "non_renewal"],
          allowUndecidedRent: true,
          requireTermDates: false,
          ruleVersion: "ns-v1",
        }
      );
    }

    if (workflow.province === "ON") {
      rules.push(
        {
          province: "ON",
          leaseType: "fixed_term",
          noticeLeadDays: workflow.defaultWorkflow.leaseRenewalReminderDays,
          templateKey: "on.fixed_term.workflow_review.v1",
          allowedNoticeTypes: ["renewal_offer", "end_of_term_notice"],
          allowUndecidedRent: true,
          requireTermDates: false,
          ruleVersion: "on-v1",
        },
        {
          province: "ON",
          leaseType: "month_to_month",
          noticeLeadDays: workflow.noticePeriods.leaseTerminationByLeaseType.month_to_month || 60,
          templateKey: "on.month_to_month.workflow_review.v1",
          allowedNoticeTypes: ["month_to_month_notice", "non_renewal"],
          allowUndecidedRent: true,
          requireTermDates: false,
          ruleVersion: "on-v1",
        }
      );
    }
  }
  return rules;
}

const RULES: LeaseNoticeRule[] = buildRules();

export function getLeaseNoticeWorkflowFlag(): LeaseNoticeWorkflowFlag {
  const raw = String(process.env.LEASE_NOTICE_WORKFLOW_ENABLED || "").trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") {
    return { enabled: true, source: "env_enabled" };
  }
  return { enabled: false, source: raw ? "env_disabled" : "env_missing" };
}

export function resolveLeaseNoticeRule(input: {
  province?: string | null;
  leaseType?: string | null;
}): LeaseNoticeRule | null {
  const province = normalizeLeaseWorkflowProvince(input.province);
  const leaseType = String(input.leaseType || "").trim().toLowerCase();
  if (!province || !leaseType) return null;
  return (
    RULES.find((rule) => rule.province === province && rule.leaseType === leaseType) || null
  );
}

export function listSupportedLeaseNoticeRules() {
  return [...RULES];
}

export function resolveLeaseWorkflowConfig(input: { province?: string | null }) {
  return getJurisdictionWorkflowConfig(input.province);
}
