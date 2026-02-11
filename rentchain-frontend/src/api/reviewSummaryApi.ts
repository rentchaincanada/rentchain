import { apiFetch } from "./apiFetch";
import { API_BASE_URL } from "./config";

export type ApplicationReviewSummary = {
  applicationId: string;
  generatedAt: string;
  applicant: {
    name: string | null;
    email: string | null;
    currentAddressLine: string | null;
    city: string | null;
    provinceState: string | null;
    postalCode: string | null;
    country: string | null;
    timeAtCurrentAddressMonths: number | null;
    currentRentAmountCents: number | null;
  };
  employment: {
    employerName: string | null;
    jobTitle: string | null;
    incomeAmountCents: number | null;
    incomeFrequency: "monthly" | "annual" | null;
    incomeMonthlyCents: number | null;
    monthsAtJob: number | null;
  };
  reference: {
    name: string | null;
    phone: string | null;
  };
  compliance: {
    applicationConsentAcceptedAt: string | null;
    applicationConsentVersion: string | null;
    signatureType: string | null;
    signedAt: string | null;
  };
  screening: {
    status: string;
    provider: string | null;
    referenceId: string | null;
  };
  derived: {
    incomeToRentRatio: number | null;
    completeness: {
      score: number;
      label: "High" | "Medium" | "Low";
    };
    flags: string[];
  };
  insights: string[];
};

export async function fetchReviewSummary(applicationId: string): Promise<ApplicationReviewSummary> {
  const res: any = await apiFetch(`/rental-applications/${encodeURIComponent(applicationId)}/review-summary`, {
    method: "GET",
  });
  return res?.summary as ApplicationReviewSummary;
}

export function reviewSummaryPdfUrl(applicationId: string): string {
  const base = API_BASE_URL.replace(/\/$/, "").replace(/\/api$/i, "");
  return `${base}/api/rental-applications/${encodeURIComponent(applicationId)}/review-summary.pdf`;
}
