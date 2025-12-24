// src/types/ledger.ts

export type LedgerEventType =
  | "RentPaymentRecorded"
  | "RentPaymentAIInsightGenerated"
  | "reporting_submitted"
  | "reporting_accepted"
  | "reporting_rejected"
  | "reporting_failed"
  | "reporting_queued"
  // add more as you define them:
  | string;

export interface LedgerEventActor {
  system?: string;
  userId?: string;
}

export interface LedgerEventMeta {
  blockchain?: {
    status?: "pending" | "confirmed" | "failed" | string;
    txHash?: string;
    network?: string;
  };
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

export interface RentPaymentRecordedData {
  tenantId: string;
  propertyId: string;
  unitId: string;
  monthlyRent: number;
  amountPaid: number;
  dueDate: string; // ISO date
  paidAt: string;  // ISO date
  notes?: string;
}

export interface RentPaymentAIInsightData {
  tenantId: string;
  totalPayments: number;
  onTimePayments: number;
  latePayments: number;
  onTimePercentage: number;
  avgDaysLate?: number;
  riskScore: number;   // 0–1
  riskLevel: "Low" | "Medium" | "High";
  summary: string;
  generatedAt: string; // ISO date
}

export interface LedgerEvent<TData = any> {
  eventId: string;
  eventType: LedgerEventType;
  version: number;
  timestamp: string; // ISO
  actor: LedgerEventActor;
  data: TData;
  meta?: LedgerEventMeta;
}

export interface TenantLedgerResponse {
  success: boolean;
  tenantId: string;
  count: number;
  events: LedgerEvent[];
}

export interface PropertyLedgerSummary {
  propertyId: string;
  totalEvents: number;
  totalPayments: number;
  totalAmountPaid: number;
  totalMonthlyRent: number;
  uniqueTenants: number;
  latestPaymentAt: string | null;
}

export interface PropertyLedgerResponse {
  success: boolean;
  propertyId: string;
  count: number;
  summary: PropertyLedgerSummary;
  events: LedgerEvent[];
}
