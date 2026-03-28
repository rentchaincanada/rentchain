import type { Request, Response } from "express";
import {
  cancelAdminScreeningOperation,
  completeAdminScreeningOperation,
  getAdminScreeningOperation,
  getScreeningStatusForApplication,
  listAdminScreeningOperations,
  requestManualScreeningForApplication,
  ScreeningOpsError,
  startAdminScreeningOperation,
} from "./screeningOpsService";

function handleError(res: Response, error: unknown) {
  if (error instanceof ScreeningOpsError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
  }
  const message = error instanceof Error ? error.message : "Internal error";
  return res.status(500).json({
    error: "internal_error",
    message,
  });
}

export async function postManualScreeningRequest(req: Request, res: Response) {
  try {
    const result = await requestManualScreeningForApplication((req as any).user, req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getManualScreeningStatus(req: Request, res: Response) {
  try {
    const status = await getScreeningStatusForApplication((req as any).user, req.params.id);
    return res.status(200).json(status);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getAdminScreeningOps(req: Request, res: Response) {
  try {
    const operations = await listAdminScreeningOperations(String(req.query?.status || "").trim());
    return res.status(200).json({ operations });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getAdminScreeningOp(req: Request, res: Response) {
  try {
    const operation = await getAdminScreeningOperation(req.params.id);
    return res.status(200).json({ operation });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postAdminScreeningOpStart(req: Request, res: Response) {
  try {
    const operation = await startAdminScreeningOperation(req.params.id, (req as any).user);
    return res.status(200).json({ operation });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postAdminScreeningOpComplete(req: Request, res: Response) {
  try {
    const operation = await completeAdminScreeningOperation(
      req.params.id,
      req.body || {},
      (req as any).user
    );
    return res.status(200).json({ operation });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postAdminScreeningOpCancel(req: Request, res: Response) {
  try {
    const operation = await cancelAdminScreeningOperation(
      req.params.id,
      req.body || {},
      (req as any).user
    );
    return res.status(200).json({ operation });
  } catch (error) {
    return handleError(res, error);
  }
}
