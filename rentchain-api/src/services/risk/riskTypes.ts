export type RiskGrade = "A" | "B" | "C" | "D" | "E";

export type RiskInput = {
  creditScore?: number | null;
  monthlyIncome?: number | null;
  monthlyRent?: number | null;
  employmentMonths?: number | null;
  onTimePaymentRatio?: number | null;
  latePayments?: number | null;
  coTenantCount?: number | null;
  hasGuarantor?: boolean | null;
};

export type RiskAssessment = {
  version: string;
  score: number;
  grade: RiskGrade;
  confidence: number;
  flags: string[];
  recommendations: string[];
  factors: {
    credit?: number | null;
    income?: number | null;
    paymentHistory?: number | null;
    employment?: number | null;
    behavior?: number | null;
  };
  inputs: {
    creditScore?: number | null;
    monthlyIncome?: number | null;
    monthlyRent?: number | null;
    employmentMonths?: number | null;
    onTimePaymentRatio?: number | null;
    latePayments?: number | null;
    coTenantCount?: number | null;
    hasGuarantor?: boolean | null;
  };
  generatedAt: string;
};

export type RiskFactorKey = keyof RiskAssessment["factors"];
