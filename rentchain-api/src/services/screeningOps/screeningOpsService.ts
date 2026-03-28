import {
  assertTransUnionConnectedForScreening,
  getTransUnionIntegrationPublic,
} from "../integrations/transunion/transunionService";
import {
  createScreeningOperation,
  getLatestScreeningOperationForApplication,
  getScreeningOperationById,
  listScreeningOperations,
  updateScreeningOperation,
} from "./screeningOpsRepository";
import type {
  ScreeningOperation,
  ScreeningOperationCancelInput,
  ScreeningOperationCompleteInput,
  ScreeningStatusView,
} from "./screeningOpsTypes";
import { db } from "../../config/firebase";

type Actor = {
  id: string;
  role: string;
  landlordId: string | null;
};

type ApplicationRecord = {
  id: string;
  landlordId: string;
  propertyId?: string | null;
  unitId?: string | null;
  applicant?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export class ScreeningOpsError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeActor(user: any): Actor {
  const role = String(user?.role || "").trim().toLowerCase();
  return {
    id: String(user?.id || user?.sub || "").trim(),
    role,
    landlordId: String(user?.landlordId || user?.id || "").trim() || null,
  };
}

function applicantName(application: ApplicationRecord): string | null {
  const first = String(application?.applicant?.firstName || "").trim();
  const last = String(application?.applicant?.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  return full || null;
}

function sanitizeString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function sanitizeFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function ensureAllowedStatus(
  operation: ScreeningOperation,
  allowed: ScreeningOperation["status"][]
) {
  if (allowed.includes(operation.status)) return;
  throw new ScreeningOpsError(
    409,
    "invalid_status_transition",
    `Cannot transition screening from ${operation.status}.`
  );
}

function buildStatusView(
  operation: ScreeningOperation | null,
  transunionConnected: boolean,
  applicationId: string
): ScreeningStatusView {
  if (!operation) {
    if (!transunionConnected) {
      return {
        status: "blocked_transunion_not_connected",
        provider: null,
        requestedAt: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        resultSummary: null,
        resultFlags: [],
        reportAvailable: false,
        reportUrl: null,
        reportExportId: null,
        actionLabel: "Connect TransUnion",
        actionPath: `/applications?applicationId=${encodeURIComponent(applicationId)}&openTransUnionConnect=1`,
        operationId: null,
      };
    }
    return {
      status: "not_started",
      provider: null,
      requestedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      resultSummary: null,
      resultFlags: [],
      reportAvailable: false,
      reportUrl: null,
      reportExportId: null,
      actionLabel: "Start Screening",
      actionPath: `/applications?applicationId=${encodeURIComponent(applicationId)}`,
      operationId: null,
    };
  }

  return {
    status: operation.status,
    provider: operation.provider,
    requestedAt: operation.requestedAt || null,
    startedAt: operation.startedAt || null,
    completedAt: operation.completedAt || null,
    cancelledAt: operation.cancelledAt || null,
    resultSummary: operation.resultSummary || null,
    resultFlags: operation.resultFlags || [],
    reportAvailable: Boolean(operation.reportUrl || operation.reportExportId),
    reportUrl: operation.reportUrl || null,
    reportExportId: operation.reportExportId || null,
    actionLabel:
      operation.status === "completed"
        ? "Review Decision"
        : operation.status === "cancelled"
        ? "Start Screening"
        : "View Application",
    actionPath:
      operation.status === "completed"
        ? `/applications/${encodeURIComponent(applicationId)}/review-summary`
        : `/applications?applicationId=${encodeURIComponent(applicationId)}`,
    operationId: operation.id,
  };
}

async function getApplicationOrThrow(applicationId: string): Promise<ApplicationRecord> {
  const snap = await db.collection("rentalApplications").doc(applicationId).get();
  if (!snap.exists) {
    throw new ScreeningOpsError(404, "screening_not_found", "Application not found.");
  }
  const data = snap.data() as any;
  return {
    id: snap.id,
    landlordId: String(data?.landlordId || "").trim(),
    propertyId: sanitizeString(data?.propertyId),
    unitId: sanitizeString(data?.unitId),
    applicant: data?.applicant || null,
  };
}

async function getOwnedApplicationForActor(user: any, applicationId: string) {
  const actor = normalizeActor(user);
  if (actor.role !== "landlord" && actor.role !== "admin") {
    throw new ScreeningOpsError(403, "forbidden", "Forbidden");
  }
  if (actor.role !== "admin" && !actor.landlordId) {
    throw new ScreeningOpsError(403, "forbidden", "Forbidden");
  }
  const application = await getApplicationOrThrow(applicationId);
  if (actor.role !== "admin" && application.landlordId !== actor.landlordId) {
    throw new ScreeningOpsError(403, "forbidden", "Forbidden");
  }
  return { actor, application };
}

export async function requestManualScreeningForApplication(user: any, applicationId: string) {
  const { actor, application } = await getOwnedApplicationForActor(user, applicationId);

  try {
    await assertTransUnionConnectedForScreening(application.landlordId);
  } catch (error: any) {
    const code = String(error?.code || "");
    if (code === "transunion_not_connected") {
      throw new ScreeningOpsError(
        409,
        "transunion_not_connected",
        "Connect your TransUnion membership before starting screening."
      );
    }
    throw error;
  }

  const latest = await getLatestScreeningOperationForApplication(applicationId);
  if (latest && ["requested", "in_progress", "completed"].includes(latest.status)) {
    return {
      operation: latest,
      status: buildStatusView(latest, true, applicationId),
    };
  }

  const operation = await createScreeningOperation({
    applicationId,
    landlordId: application.landlordId,
    propertyId: application.propertyId || null,
    unitId: application.unitId || null,
    applicantName: applicantName(application),
    updatedByUserId: actor.id || actor.landlordId || null,
  });

  return {
    operation,
    status: buildStatusView(operation, true, applicationId),
  };
}

export async function getScreeningStatusForApplication(user: any, applicationId: string) {
  const { application } = await getOwnedApplicationForActor(user, applicationId);
  const [latest, transunion] = await Promise.all([
    getLatestScreeningOperationForApplication(applicationId),
    getTransUnionIntegrationPublic(application.landlordId).catch(() => ({
      provider: "transunion" as const,
      status: "not_connected",
      version: 1,
    })),
  ]);
  return buildStatusView(latest, transunion.status === "connected", applicationId);
}

export async function listAdminScreeningOperations(status?: string | null) {
  return listScreeningOperations({
    status: sanitizeString(status) as ScreeningOperation["status"] | null,
  });
}

export async function getAdminScreeningOperation(id: string) {
  const operation = await getScreeningOperationById(id);
  if (!operation) {
    throw new ScreeningOpsError(404, "screening_not_found", "Screening operation not found.");
  }
  return operation;
}

export async function startAdminScreeningOperation(id: string, user: any) {
  const operation = await getAdminScreeningOperation(id);
  ensureAllowedStatus(operation, ["requested"]);
  const actor = normalizeActor(user);
  return updateScreeningOperation(id, {
    status: "in_progress",
    startedAt: new Date().toISOString(),
    updatedByUserId: actor.id || actor.landlordId,
  });
}

export async function completeAdminScreeningOperation(
  id: string,
  input: ScreeningOperationCompleteInput,
  user: any
) {
  const operation = await getAdminScreeningOperation(id);
  ensureAllowedStatus(operation, ["requested", "in_progress"]);
  const actor = normalizeActor(user);
  return updateScreeningOperation(id, {
    status: "completed",
    startedAt: operation.startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    cancelledAt: null,
    cancelledReason: null,
    resultSummary: sanitizeString(input.resultSummary),
    resultFlags: sanitizeFlags(input.resultFlags),
    reportUrl: sanitizeString(input.reportUrl),
    reportExportId: sanitizeString(input.reportExportId),
    operatorNotes: sanitizeString(input.operatorNotes),
    updatedByUserId: actor.id || actor.landlordId,
  });
}

export async function cancelAdminScreeningOperation(
  id: string,
  input: ScreeningOperationCancelInput,
  user: any
) {
  const operation = await getAdminScreeningOperation(id);
  ensureAllowedStatus(operation, ["requested", "in_progress"]);
  const actor = normalizeActor(user);
  return updateScreeningOperation(id, {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    completedAt: null,
    cancelledReason: sanitizeString(input.cancelledReason),
    updatedByUserId: actor.id || actor.landlordId,
  });
}
