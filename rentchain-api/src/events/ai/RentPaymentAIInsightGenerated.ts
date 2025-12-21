// src/events/ai/RentPaymentAIInsightGenerated.ts
import { LedgerEvent } from "../envelope";

export interface RentPaymentAIInsightData {
  tenantId: string;

  // Overall stats
  totalPayments: number;
  onTimePayments: number;
  latePayments: number;
  onTimePercentage: number; // 0–100
  avgDaysLate?: number;      // undefined if no late payments

  // Risk
  riskScore: number;         // 0 = low risk, 1 = high risk
  riskLevel: "Low" | "Medium" | "High";

  // Human-readable
  summary: string;
  generatedAt: string;       // ISO timestamp when we ran the analysis
}

export type RentPaymentAIInsightEvent = LedgerEvent<RentPaymentAIInsightData>;
