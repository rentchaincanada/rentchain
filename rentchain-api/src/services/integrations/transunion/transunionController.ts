import type { Request, Response } from "express";
import {
  TransUnionServiceError,
  assertTransUnionConnectedForScreening,
  connectTransUnion,
  disconnectTransUnion,
  getTransUnionIntegrationPublic,
  requestTransUnionOnboarding,
  updateTransUnionCredentials,
} from "./transunionService";
import {
  TRANSUNION_USAGE_EVENT_TYPES,
  writeTransUnionUsageEvent,
} from "../../screening/transUnionUsageEvents";

function landlordIdOf(req: any): string {
  return String(req.user?.landlordId || req.user?.id || "").trim();
}

function userIdOf(req: any): string {
  return String(req.user?.id || req.user?.uid || req.user?.landlordId || "").trim();
}

function handleError(res: Response, error: unknown) {
  if (error instanceof TransUnionServiceError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
  }
  return res.status(500).json({
    error: "transunion_integration_failed",
    message: "Unable to process the TransUnion request.",
  });
}

function safeReason(error: unknown): string | null {
  if (error instanceof TransUnionServiceError) return error.code;
  const fallback = String((error as any)?.code || (error as any)?.message || "").trim().toLowerCase();
  return fallback ? fallback.slice(0, 120) : null;
}

export async function getTransUnionIntegration(req: Request, res: Response) {
  try {
    const data = await getTransUnionIntegrationPublic(landlordIdOf(req));
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postTransUnionOnboardingRequest(req: Request, res: Response) {
  try {
    const data = await requestTransUnionOnboarding(landlordIdOf(req), userIdOf(req), req.body || {});
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postTransUnionConnect(req: Request, res: Response) {
  const landlordId = landlordIdOf(req);
  const userId = userIdOf(req);
  try {
    await writeTransUnionUsageEvent({
      eventType: "tu_credentials_submitted",
      landlordId,
      userId,
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      sourceSurface: String((req.body as any)?.sourceSurface || "connect_modal"),
    });
    const data = await connectTransUnion(landlordId, userId, req.body || {});
    await writeTransUnionUsageEvent({
      eventType: "screening_permissible_purpose_confirmed",
      landlordId,
      userId,
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      sourceSurface: String((req.body as any)?.sourceSurface || "connect_modal"),
      status: "confirmed",
    });
    await writeTransUnionUsageEvent({
      eventType: "tu_connected",
      landlordId,
      userId,
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      sourceSurface: String((req.body as any)?.sourceSurface || "connect_modal"),
      status: "connected",
    });
    return res.status(200).json(data);
  } catch (error) {
    await writeTransUnionUsageEvent({
      eventType: "tu_connection_failed",
      landlordId,
      userId,
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      sourceSurface: String((req.body as any)?.sourceSurface || "connect_modal"),
      reason: safeReason(error),
      status: "failed",
    }).catch(() => undefined);
    return handleError(res, error);
  }
}

export async function postTransUnionUpdateCredentials(req: Request, res: Response) {
  const landlordId = landlordIdOf(req);
  const userId = userIdOf(req);
  try {
    await writeTransUnionUsageEvent({
      eventType: "tu_credentials_submitted",
      landlordId,
      userId,
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      sourceSurface: String((req.body as any)?.sourceSurface || "update_credentials_modal"),
    });
    const data = await updateTransUnionCredentials(landlordId, userId, req.body || {});
    await writeTransUnionUsageEvent({
      eventType: "screening_permissible_purpose_confirmed",
      landlordId,
      userId,
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      sourceSurface: String((req.body as any)?.sourceSurface || "update_credentials_modal"),
      status: "confirmed",
    });
    await writeTransUnionUsageEvent({
      eventType: "tu_connected",
      landlordId,
      userId,
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      sourceSurface: String((req.body as any)?.sourceSurface || "update_credentials_modal"),
      status: "connected",
    });
    return res.status(200).json(data);
  } catch (error) {
    await writeTransUnionUsageEvent({
      eventType: "tu_connection_failed",
      landlordId,
      userId,
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      sourceSurface: String((req.body as any)?.sourceSurface || "update_credentials_modal"),
      reason: safeReason(error),
      status: "failed",
    }).catch(() => undefined);
    return handleError(res, error);
  }
}

export async function postTransUnionDisconnect(req: Request, res: Response) {
  try {
    const data = await disconnectTransUnion(landlordIdOf(req), userIdOf(req));
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postTransUnionUsageEvent(req: Request, res: Response) {
  const eventType = String((req.body as any)?.eventType || "").trim() as
    | (typeof TRANSUNION_USAGE_EVENT_TYPES)[number]
    | "";
  const allowed = new Set([
    "tu_option_viewed",
    "tu_get_access_clicked",
    "tu_have_credentials_clicked",
  ]);
  if (!allowed.has(eventType as any)) {
    return res.status(400).json({ ok: false, error: "invalid_event_type" });
  }
  try {
    await writeTransUnionUsageEvent({
      eventType: eventType as any,
      landlordId: landlordIdOf(req),
      userId: userIdOf(req),
      actorRole: String((req as any).user?.role || "landlord").toLowerCase(),
      applicationId: String((req.body as any)?.applicationId || "").trim() || null,
      propertyId: String((req.body as any)?.propertyId || "").trim() || null,
      sourceSurface: String((req.body as any)?.sourceSurface || "").trim() || "applications_page",
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function requireTransUnionConnectedForScreening(landlordId: string) {
  await assertTransUnionConnectedForScreening(landlordId);
}
