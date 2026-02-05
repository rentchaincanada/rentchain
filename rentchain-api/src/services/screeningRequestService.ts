import { v4 as uuid } from "uuid";
import type { Application } from "../types/applications";
import {
  ScreeningReportSummary,
  ScreeningRequest,
  EncryptedPayload,
} from "../types/screening";
import {
  SCREENING_CURRENCY,
  SCREENING_PRICE_CENTS,
} from "../config/screeningConfig";
import { getApplicationById, saveApplication } from "./applicationsService";
import { encrypt } from "./encryptionService";
import type { CreditProviderResult } from "./screening/providers/providerTypes";

const SCREENING_REQUESTS: ScreeningRequest[] = [];
export const SCREENING_REQUESTS_INTERNAL = SCREENING_REQUESTS;

function normalizedPriceCents(): number {
  const parsed = Number(SCREENING_PRICE_CENTS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1999;
  }
  return Math.floor(parsed);
}

function normalizedCurrency(): string {
  return (SCREENING_CURRENCY || "cad").toLowerCase();
}

function retentionDays(): number {
  const parsed = Number(process.env.SCREENING_RETENTION_DAYS);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }
  return Math.floor(parsed);
}

export function getScreeningRequestById(
  id: string
): ScreeningRequest | undefined {
  return SCREENING_REQUESTS.find((req) => req.id === id);
}

export function getScreeningRequestForApplication(
  applicationId?: string
): ScreeningRequest | undefined {
  if (!applicationId) return undefined;
  return SCREENING_REQUESTS.find((req) => req.applicationId === applicationId);
}

export function createScreeningRequestForApplication(options: {
  applicationId: string;
  landlordId: string;
  landlordEmail?: string;
  providerOverride?: string;
}): ScreeningRequest {
  const screeningRequest: ScreeningRequest = {
    id: uuid(),
    applicationId: options.applicationId,
    landlordId: options.landlordId,
    landlordEmail: options.landlordEmail,
    status: "requested",
    createdAt: new Date().toISOString(),
    priceCents: normalizedPriceCents(),
    currency: normalizedCurrency(),
    providerOverride: options.providerOverride,
  };

  SCREENING_REQUESTS.push(screeningRequest);
  updateApplicationScreeningStatus(
    options.applicationId,
    "requested",
    screeningRequest.id
  );

  return screeningRequest;
}

export function markScreeningPaid(
  screeningRequestId: string
): ScreeningRequest | undefined {
  const screeningRequest = getScreeningRequestById(screeningRequestId);
  if (!screeningRequest) {
    return undefined;
  }

  screeningRequest.status = "paid";
  screeningRequest.paidAt = new Date().toISOString();
  updateApplicationScreeningStatus(
    screeningRequest.applicationId,
    "paid",
    screeningRequest.id
  );

  return screeningRequest;
}

export function markScreeningFailed(
  screeningRequestId: string,
  reason: string
): ScreeningRequest | undefined {
  const screeningRequest = getScreeningRequestById(screeningRequestId);
  if (!screeningRequest) {
    return undefined;
  }

  screeningRequest.status = "failed";
  screeningRequest.failureReason = reason;
  updateApplicationScreeningStatus(
    screeningRequest.applicationId,
    "failed",
    screeningRequest.id
  );

  return screeningRequest;
}

export function completeScreening(
  screeningRequestId: string
): ScreeningRequest | undefined {
  const screeningRequest = getScreeningRequestById(screeningRequestId);
  if (!screeningRequest) {
    return undefined;
  }

  const applicationId = screeningRequest.applicationId || "";
  const summary =
    screeningRequest.reportSummary ||
    buildStubReportSummary(applicationId);
  const completedAt = new Date().toISOString();
  screeningRequest.reportSummary = summary;
  screeningRequest.encryptedPayload = encryptProviderPayload({
    provider: "stubbed_screening",
    status: "completed",
    report: summary,
    applicationId,
    completedAt,
  });
  screeningRequest.status = "completed";
  screeningRequest.completedAt = completedAt;
  screeningRequest.deleteAfterAt = calculateDeleteAfterAt(
    screeningRequest.completedAt
  );

  updateApplicationScreeningStatus(applicationId, "completed", screeningRequest.id);

  return screeningRequest;
}

export function updateApplicationScreeningStatus(
  applicationId: string | undefined,
  status: Application["screeningStatus"],
  screeningRequestId?: string
): Application | undefined {
  if (!applicationId) return undefined;
  const application = getApplicationById(applicationId);
  if (!application) {
    return undefined;
  }

  const updated: Application = {
    ...application,
    screeningStatus: status,
    screeningRequestId: screeningRequestId ?? application.screeningRequestId,
  };

  return saveApplication(updated);
}

function buildStubReportSummary(
  applicationId: string
): ScreeningReportSummary {
  return {
    headline: "Screening complete (stubbed provider)",
    highlights: [
      "Identity validated and application reviewed.",
      "No critical adverse records detected in stubbed data.",
      "Recommend verifying employer references before lease signing.",
    ],
    createdAt: new Date().toISOString(),
    applicationId,
  };
}

function calculateDeleteAfterAt(completedAt: string): string {
  const date = new Date(completedAt);
  date.setDate(date.getDate() + retentionDays());
  return date.toISOString();
}

function encryptProviderPayload(
  payload: Record<string, any>
): EncryptedPayload | undefined {
  try {
    return encrypt(JSON.stringify(payload));
  } catch (err: any) {
    console.error("[screening] Failed to encrypt provider payload", {
      message: err?.message,
    });
    return undefined;
  }
}

export function sanitizeScreeningResponse(
  screeningRequest: ScreeningRequest
): ScreeningRequest {
  return {
    id: screeningRequest.id,
    applicationId: screeningRequest.applicationId,
    landlordId: screeningRequest.landlordId,
    status: screeningRequest.status,
    createdAt: screeningRequest.createdAt,
    paidAt: screeningRequest.paidAt,
    completedAt: screeningRequest.completedAt,
    deleteAfterAt: screeningRequest.deleteAfterAt,
    priceCents: screeningRequest.priceCents,
    currency: screeningRequest.currency,
    reportSummary: screeningRequest.reportSummary,
    providerName: screeningRequest.providerName,
    providerReferenceId: screeningRequest.providerReferenceId,
    failureReason: screeningRequest.failureReason,
    lastProviderDurationMs: screeningRequest.lastProviderDurationMs,
    lastWebhookEventId: screeningRequest.lastWebhookEventId,
    providerOverride: screeningRequest.providerOverride,
  };
}

export function purgeExpiredScreenings(now = new Date()): {
  purgedIds: string[];
  purgedCount: number;
} {
  const cutoff = now.getTime();
  const purgedIds: string[] = [];

  SCREENING_REQUESTS.forEach((request) => {
    const deleteAfter = request.deleteAfterAt
      ? Date.parse(request.deleteAfterAt)
      : NaN;
    if (!Number.isFinite(deleteAfter) || deleteAfter > cutoff) {
      return;
    }

    if (request.encryptedPayload || request.creditReport) {
      purgedIds.push(request.id);
    }

    request.encryptedPayload = undefined;
    request.creditReport = undefined;
  });

  return { purgedIds, purgedCount: purgedIds.length };
}

export function applyProviderResult(
  screeningRequestId: string,
  result: CreditProviderResult,
  durationMs?: number
): ScreeningRequest | undefined {
  const screeningRequest = getScreeningRequestById(screeningRequestId);
  if (!screeningRequest) {
    return undefined;
  }

  const highlights =
    result.highlights && result.highlights.length
      ? result.highlights
      : result.summaryText
      ? [result.summaryText]
      : ["Credit report completed."];
  const completedAt = result.generatedAt || new Date().toISOString();
  const summary: ScreeningReportSummary = {
    headline: result.summaryText || "Credit report ready",
    highlights,
    createdAt: completedAt,
    applicationId: screeningRequest.applicationId,
    providerName: result.providerName,
    providerReferenceId: result.providerReferenceId,
    score: result.score,
    riskBand: result.riskBand,
  };

  try {
    screeningRequest.encryptedPayload = encrypt(
      JSON.stringify(result.rawPayload || {})
    );
  } catch (err: any) {
    console.error("[screening] Failed to encrypt provider payload", {
      message: err?.message,
    });
    screeningRequest.encryptedPayload = undefined;
  }

  screeningRequest.reportSummary = summary;
  screeningRequest.status = "completed";
  screeningRequest.providerName = result.providerName;
  screeningRequest.providerReferenceId = result.providerReferenceId;
  screeningRequest.completedAt = completedAt;
  screeningRequest.failureReason = undefined;
  screeningRequest.deleteAfterAt = calculateDeleteAfterAt(completedAt);
  if (typeof durationMs === "number") {
    screeningRequest.lastProviderDurationMs = durationMs;
  }

  updateApplicationScreeningStatus(
    screeningRequest.applicationId,
    "completed",
    screeningRequest.id
  );

  return screeningRequest;
}

let lastProviderErrorAt: string | null = null;

export function setLastProviderError(timestamp: string): void {
  lastProviderErrorAt = timestamp;
}

export function getLastProviderErrorAt(): string | null {
  return lastProviderErrorAt;
}
