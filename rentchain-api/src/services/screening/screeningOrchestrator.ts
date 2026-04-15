import { db } from "../../config/firebase";
import type { ScreeningResultSummary } from "./providers/types";
import { writeScreeningEvent } from "./screeningEvents";
import { writeCanonicalEvent } from "../../lib/events/buildEvent";
import { buildScreeningMonetizationPatch } from "./screeningMonetizationService";

type ScreeningStatus =
  | "unpaid"
  | "paid"
  | "processing"
  | "complete"
  | "failed"
  | "ineligible"
  | "not_ready"
  | "ready"
  | "requested"
  | "completed";

type ScreeningFailure = { code: string; detail?: string };

const RESULTS_COLLECTION = "screeningResults";

export async function beginScreening(
  applicationId: string,
  actorUser?: any
): Promise<{ ok: boolean; status?: ScreeningStatus; error?: string; idempotent?: boolean }> {
  const appRef = db.collection("rentalApplications").doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) {
    return { ok: false, error: "not_found" };
  }
  const data = snap.data() as any;
  const status = String(data?.screeningStatus || "").toLowerCase() as ScreeningStatus;
  if (status === "processing") {
    return { ok: true, status: "processing", idempotent: true };
  }
  if (status !== "paid") {
    return { ok: false, error: "invalid_state", status };
  }

  const now = Date.now();
  await appRef.set(
    {
      screeningStatus: "processing",
      screeningStartedAt: now,
      screeningProvider: "manual",
      screeningLastUpdatedAt: now,
      screeningMonetization: buildScreeningMonetizationPatch({
        current: data?.screeningMonetization,
        eligibility: "eligible",
        paymentStatus: "paid",
        fulfillmentStatus: "ordered",
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
    },
    { merge: true }
  );

  await writeScreeningEvent({
    applicationId,
    landlordId: data?.landlordId || null,
    type: "processing_started",
    at: now,
    meta: { status: "processing" },
    actor: String(actorUser?.role || "").toLowerCase() === "admin" ? "admin" : "system",
  });

  return { ok: true, status: "processing", idempotent: false };
}

export async function markScreeningComplete(
  applicationId: string,
  payload: { summary: ScreeningResultSummary; reportText?: string },
  actorUser?: any
): Promise<{ ok: boolean; resultId?: string; error?: string; idempotent?: boolean }> {
  const appRef = db.collection("rentalApplications").doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) {
    return { ok: false, error: "not_found" };
  }

  const data = snap.data() as any;
  const existingStatus = String(data?.screeningStatus || "").toLowerCase();
  if (existingStatus === "complete" && data?.screeningResultId) {
    return { ok: true, resultId: String(data.screeningResultId), idempotent: true };
  }

  const now = Date.now();
  const resultRef = db.collection(RESULTS_COLLECTION).doc();
  const summary: ScreeningResultSummary = {
    ...payload.summary,
    updatedAt: payload.summary.updatedAt ?? now,
  };

  await resultRef.set({
    applicationId,
    landlordId: data?.landlordId || null,
    status: "complete",
    provider: data?.screeningProvider || "manual",
    createdAt: now,
    updatedAt: now,
    summary,
    reportText: payload.reportText || null,
  });

  await appRef.set(
    {
      screeningStatus: "complete",
      screeningCompletedAt: now,
      screeningResultId: resultRef.id,
      screeningResultSummary: summary,
      screeningLastUpdatedAt: now,
      screeningMonetization: buildScreeningMonetizationPatch({
        current: data?.screeningMonetization,
        eligibility: "eligible",
        paymentStatus: "paid",
        fulfillmentStatus: "completed",
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
    },
    { merge: true }
  );

  await writeScreeningEvent({
    applicationId,
    landlordId: data?.landlordId || null,
    type: "completed",
    at: now,
    meta: { status: "complete" },
    actor: String(actorUser?.role || "").toLowerCase() === "admin" ? "admin" : "system",
  });
  await writeCanonicalEvent({
    domain: "screening",
    action: "completed",
    status: "complete",
    actor: {
      type: String(actorUser?.role || "").toLowerCase() === "admin" ? "admin" : "system",
      role: String(actorUser?.role || "").trim() || "system",
      id: String(actorUser?.id || "").trim() || null,
    },
    resource: {
      type: "rental_application",
      id: applicationId,
    },
    occurredAt: now,
    visibility: "internal",
    summary: "Screening completed",
    metadata: {
      landlordId: data?.landlordId || null,
      resultId: resultRef.id,
      provider: data?.screeningProvider || "manual",
    },
  });

  return { ok: true, resultId: resultRef.id, idempotent: false };
}

export async function markScreeningFailed(
  applicationId: string,
  failure: ScreeningFailure,
  actorUser?: any
): Promise<{ ok: boolean; error?: string; idempotent?: boolean }> {
  const appRef = db.collection("rentalApplications").doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) {
    return { ok: false, error: "not_found" };
  }
  const data = snap.data() as any;
  const existingStatus = String(data?.screeningStatus || "").toLowerCase();
  if (existingStatus === "failed") {
    return { ok: true, idempotent: true };
  }

  const now = Date.now();
  await appRef.set(
    {
      screeningStatus: "failed",
      screeningFailedAt: now,
      screeningFailureCode: failure.code,
      screeningFailureDetail: failure.detail || null,
      screeningLastUpdatedAt: now,
      screeningMonetization: buildScreeningMonetizationPatch({
        current: data?.screeningMonetization,
        eligibility: "eligible",
        paymentStatus: "failed",
        fulfillmentStatus: "blocked",
        lastErrorCode: "SCREENING_MONETIZATION_BLOCKED",
        lastErrorMessage: failure.detail || failure.code,
      }),
    },
    { merge: true }
  );

  await writeScreeningEvent({
    applicationId,
    landlordId: data?.landlordId || null,
    type: "failed",
    at: now,
    meta: { status: "failed", reasonCode: failure.code },
    actor: String(actorUser?.role || "").toLowerCase() === "admin" ? "admin" : "system",
  });

  return { ok: true, idempotent: false };
}

export const __testing = {
  RESULTS_COLLECTION,
};
