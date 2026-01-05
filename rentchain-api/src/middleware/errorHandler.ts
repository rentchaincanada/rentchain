import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../lib/httpErrors";
import { jsonError } from "../lib/httpResponse";

export function notFoundHandler(req: Request, res: Response) {
  res.setHeader("x-route-source", "not-found");
  return jsonError(res, 404, "NOT_FOUND", "Not Found", undefined, req.requestId);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  const requestId = req.requestId;

  if (err instanceof ApiError) {
    const message = err.expose ? err.message : "Internal Server Error";
    return jsonError(res, err.status, err.code, message, err.details, requestId);
  }

  if (err?.name === "ZodError") {
    return jsonError(
      res,
      400,
      "VALIDATION_ERROR",
      "Invalid request payload",
      err.flatten?.() ?? err,
      requestId
    );
  }

  console.error("[errorHandler]", { requestId, message: err?.message, stack: err?.stack });

  return jsonError(res, 500, "INTERNAL", "Internal Server Error", undefined, requestId);
}
