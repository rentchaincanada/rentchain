// src/types/screening.ts
export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  consent: boolean;
  createdAt: string;
}

export type ScreeningStatus =
  | "requested"
  | "paid"
  | "completed"
  | "failed"
  | "pending";

export interface CreditReport {
  id: string;
  provider: string;
  score: number;
  summary: string;
  recommendations: string[];
  generatedAt: string;
}

export interface ScreeningReportSummary {
  headline: string;
  highlights: string[];
  createdAt: string;
  applicationId?: string;
  providerName?: string;
  providerReferenceId?: string;
  score?: number;
  riskBand?: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export interface ScreeningRequest {
  id: string;
  applicationId?: string;
  landlordId?: string;
  landlordEmail?: string;
  applicantId?: string;
  status: ScreeningStatus;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  amount?: number;
  priceCents?: number;
  currency?: string;
  reportSummary?: ScreeningReportSummary;
  creditReport?: CreditReport;
  checkoutSessionId?: string;
  encryptedPayload?: EncryptedPayload;
  deleteAfterAt?: string;
  providerName?: string;
  providerReferenceId?: string;
  failureReason?: string;
  lastProviderDurationMs?: number;
  lastWebhookEventId?: string;
  providerOverride?: string;
}
