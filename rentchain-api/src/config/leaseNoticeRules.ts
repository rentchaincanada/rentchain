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

const RULES: LeaseNoticeRule[] = [
  {
    province: "NS",
    leaseType: "fixed_term",
    noticeLeadDays: 90,
    templateKey: "ns.fixed_term.renewal_offer.v1",
    allowedNoticeTypes: ["renewal_offer", "end_of_term_notice"],
    allowUndecidedRent: true,
    requireTermDates: true,
    ruleVersion: "ns-v1",
  },
  {
    province: "NS",
    leaseType: "year_to_year",
    noticeLeadDays: 90,
    templateKey: "ns.year_to_year.notice.v1",
    allowedNoticeTypes: ["renewal_offer", "end_of_term_notice"],
    allowUndecidedRent: true,
    requireTermDates: true,
    ruleVersion: "ns-v1",
  },
  {
    province: "NS",
    leaseType: "month_to_month",
    noticeLeadDays: 30,
    templateKey: "ns.month_to_month.notice.v1",
    allowedNoticeTypes: ["month_to_month_notice", "non_renewal"],
    allowUndecidedRent: true,
    requireTermDates: false,
    ruleVersion: "ns-v1",
  },
];

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
  const province = String(input.province || "").trim().toUpperCase();
  const leaseType = String(input.leaseType || "").trim().toLowerCase();
  if (!province || !leaseType) return null;
  return (
    RULES.find((rule) => rule.province === province && rule.leaseType === leaseType) || null
  );
}

export function listSupportedLeaseNoticeRules() {
  return [...RULES];
}
