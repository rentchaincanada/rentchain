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
  try {
    const data = await connectTransUnion(landlordIdOf(req), userIdOf(req), req.body || {});
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postTransUnionUpdateCredentials(req: Request, res: Response) {
  try {
    const data = await updateTransUnionCredentials(landlordIdOf(req), userIdOf(req), req.body || {});
    return res.status(200).json(data);
  } catch (error) {
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

export async function requireTransUnionConnectedForScreening(landlordId: string) {
  await assertTransUnionConnectedForScreening(landlordId);
}
