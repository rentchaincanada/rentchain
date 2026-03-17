export const RISK_VERSION = "risk-v1";

export const RISK_WEIGHTS = {
  credit: 0.3,
  income: 0.25,
  paymentHistory: 0.2,
  employment: 0.15,
  behavior: 0.1,
} as const;

export const CONFIDENCE_BOUNDS = {
  min: 0.45,
  max: 0.95,
} as const;
