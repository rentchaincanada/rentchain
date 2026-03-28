import type { Request, Response } from "express";
import {
  cancelViewingRequest,
  completeViewingRequest,
  createViewingRequest,
  getViewingRequestForLandlord,
  listViewingRequestsForLandlord,
  proposeViewingSlots,
  selectViewingSlot,
  ViewingServiceError,
} from "./viewingService";

function landlordIdOf(req: any) {
  return String(req.user?.landlordId || req.user?.id || "").trim();
}

function userIdOf(req: any) {
  return String(req.user?.id || req.user?.uid || req.user?.landlordId || "").trim();
}

function handleError(res: Response, error: unknown) {
  if (error instanceof ViewingServiceError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
  }
  return res.status(500).json({
    error: "viewing_request_failed",
    message: "Unable to process the viewing request.",
  });
}

export async function postViewingRequest(req: Request, res: Response) {
  try {
    const data = await createViewingRequest(req.body || {});
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getViewingRequests(req: Request, res: Response) {
  try {
    const data = await listViewingRequestsForLandlord(landlordIdOf(req));
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getViewingRequestById(req: Request, res: Response) {
  try {
    const data = await getViewingRequestForLandlord(String(req.params.id || ""), landlordIdOf(req));
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postProposeViewingSlots(req: Request, res: Response) {
  try {
    const data = await proposeViewingSlots(
      String(req.params.id || ""),
      landlordIdOf(req),
      userIdOf(req),
      req.body || {}
    );
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postSelectViewingSlot(req: Request, res: Response) {
  try {
    const data = await selectViewingSlot(
      String(req.params.id || ""),
      landlordIdOf(req),
      userIdOf(req),
      req.body || {}
    );
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postCompleteViewing(req: Request, res: Response) {
  try {
    const data = await completeViewingRequest(
      String(req.params.id || ""),
      landlordIdOf(req),
      userIdOf(req)
    );
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}

export async function postCancelViewing(req: Request, res: Response) {
  try {
    const data = await cancelViewingRequest(
      String(req.params.id || ""),
      landlordIdOf(req),
      userIdOf(req),
      req.body || {}
    );
    return res.status(200).json(data);
  } catch (error) {
    return handleError(res, error);
  }
}
