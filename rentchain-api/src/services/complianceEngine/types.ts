export type ComplianceProvince = "ON" | "NS";

export type RentIncreaseRules = {
  minMonthsBetweenIncreases: number;
  noticeDays: number;
  exemptions?: string[];
};

export type LeaseEndRules = {
  renewalWindowDays: number;
  fixedTermBehavior: string;
};

export type NoticeRules = {
  entryNoticeMinHours: number;
};

export type ComplianceRules = {
  province: ComplianceProvince;
  complianceVersion: "v1";
  rentIncrease: RentIncreaseRules;
  leaseEnd: LeaseEndRules;
  notices: NoticeRules;
};
