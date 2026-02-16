// src/api/screeningApi.ts
import { apiFetch } from "./apiFetch";

export type ScreeningStatus =
  | "requested"
  | "paid"
  | "completed"
  | "failed"
  | "pending";

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

export interface ScreeningCreditReport {
  id?: string;
  provider?: string;
  score?: number;
  summary?: string;
  recommendations?: string[];
  generatedAt?: string;
}

export interface ScreeningRequest {
  id: string;
  applicationId?: string;
  landlordId?: string;
  status: ScreeningStatus;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  priceCents?: number;
  currency?: string;
  reportSummary?: ScreeningReportSummary;
  creditReport?: ScreeningCreditReport;
  providerName?: string;
  providerReferenceId?: string;
  failureReason?: string;
}

export interface ScreeningRequestResponse {
  screeningRequest: ScreeningRequest;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const json = await response.json();
      if (json?.error) {
        message = json.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function requestScreening(
  applicationId: string
): Promise<ScreeningRequest> {
  const data = await apiFetch<ScreeningRequestResponse>(`/screenings/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId }),
  });
  return data.screeningRequest;
}

export async function runScreening(applicationId: string): Promise<ScreeningRequest> {
  const data = await apiFetch<ScreeningRequestResponse>(`/screenings/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId }),
  });
  return data.screeningRequest;
}

export async function checkoutScreening(id: string): Promise<string> {
  const data = await apiFetch<{ url: string }>(
    `/screenings/${encodeURIComponent(id)}/checkout`,
    { method: "POST" }
  );
  return data.url;
}

export async function getScreening(
  id: string
): Promise<ScreeningRequestResponse> {
  return apiFetch<ScreeningRequestResponse>(`/screenings/${encodeURIComponent(id)}`);
}

export async function downloadScreeningPdf(
  id: string
): Promise<Blob> {
  const res = await fetch(`/api/screenings/${encodeURIComponent(id)}/report.pdf`, {
    method: "GET",
  });

  if (!res.ok) {
    let message = `Failed to download screening PDF: ${res.status}`;
    try {
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.blob();
}
