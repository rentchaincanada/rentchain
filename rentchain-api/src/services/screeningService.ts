// src/services/screeningService.ts
import { v4 as uuid } from "uuid";
import {
  Applicant,
  ScreeningRequest,
  CreditReport,
  ScreeningStatus,
} from "../types/screening";

const applicants: Applicant[] = [];
const screenings: ScreeningRequest[] = [];

export function createApplicant(payload: {
  fullName: string;
  email: string;
  phone?: string;
  consent: boolean;
}): Applicant {
  const applicant: Applicant = {
    id: uuid(),
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    consent: Boolean(payload.consent),
    createdAt: new Date().toISOString(),
  };

  applicants.push(applicant);
  return applicant;
}

export function getApplicantById(id: string): Applicant | undefined {
  return applicants.find((a) => a.id === id);
}

export function createScreeningRequest(options: {
  applicantId: string;
  amount?: number;
}): ScreeningRequest {
  const screening: ScreeningRequest = {
    id: uuid(),
    applicantId: options.applicantId,
    status: "pending",
    createdAt: new Date().toISOString(),
    amount: options.amount ?? 29,
  };

  screenings.push(screening);
  return screening;
}

export function getScreeningById(id: string): ScreeningRequest | undefined {
  return screenings.find((s) => s.id === id);
}

export function payForScreening(id: string): ScreeningRequest | undefined {
  const screening = screenings.find((s) => s.id === id);
  if (!screening) return undefined;

  const now = new Date().toISOString();
  screening.status = nextStatus(screening.status);
  screening.paidAt = now;
  screening.creditReport = generateCreditReport(screening.applicantId);
  screening.status = "completed";
  screening.completedAt = new Date().toISOString();

  return screening;
}

function nextStatus(current: ScreeningStatus): ScreeningStatus {
  if (current === "pending") return "paid";
  return current;
}

function generateCreditReport(applicantId: string): CreditReport {
  return {
    id: uuid(),
    provider: "StubbedProvider",
    score: 720,
    summary: "Credit report generated successfully (stub).",
    recommendations: [
      "Verify employment and income documents.",
      "Confirm tenancy references for additional assurance.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
