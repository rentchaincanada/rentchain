// src/api/screeningApi.ts
import { withAuthHeaders } from "./httpClient";
import API_BASE from "../config/apiBase";

const API_BASE_URL = `${API_BASE.replace(/\/$/, "")}/api`;

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

export interface ScreeningCreditsResponse {
  screeningCredits: number;
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
  const init = withAuthHeaders({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId }),
  });

  const res = await fetch(`${API_BASE_URL}/api/screenings/request`, init);
  const data = await handleResponse<ScreeningRequestResponse>(res);
  return data.screeningRequest;
}

export async function runScreeningWithCredits(
  applicationId: string
): Promise<{ screeningRequest: ScreeningRequest; screeningCredits: number }> {
  const init = withAuthHeaders({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId }),
  });

  const res = await fetch(`${API_BASE_URL}/api/screenings/run`, init);

  if (res.status === 402) {
    const json = await res.json().catch(() => ({}));
    const err: any = new Error(
      json?.message || "No screening credits available."
    );
    err.code = json?.error || "insufficient_credits";
    err.screeningCredits = json?.screeningCredits;
    throw err;
  }

  const data = await handleResponse<{
    screeningRequest: ScreeningRequest;
    screeningCredits: number;
  }>(res);
  return data;
}

export async function fetchScreeningCredits(): Promise<ScreeningCreditsResponse> {
  const init = withAuthHeaders({
    method: "GET",
  });
  const res = await fetch(`${API_BASE_URL}/api/screenings/credits`, init);
  return handleResponse<ScreeningCreditsResponse>(res);
}

export async function checkoutScreening(id: string): Promise<string> {
  const init = withAuthHeaders({
    method: "POST",
  });

  const res = await fetch(
    `${API_BASE_URL}/api/screenings/${encodeURIComponent(id)}/checkout`,
    init
  );
  const data = await handleResponse<{ url: string }>(res);
  return data.url;
}

export async function getScreening(
  id: string
): Promise<ScreeningRequestResponse> {
  const init = withAuthHeaders({
    method: "GET",
  });

  const res = await fetch(
    `${API_BASE_URL}/api/screenings/${encodeURIComponent(id)}`,
    init
  );
  return handleResponse<ScreeningRequestResponse>(res);
}

export async function downloadScreeningPdf(
  id: string
): Promise<Blob> {
  const init = withAuthHeaders({
    method: "GET",
  });

  const res = await fetch(
    `${API_BASE_URL}/api/screenings/${encodeURIComponent(id)}/report.pdf`,
    init
  );

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
