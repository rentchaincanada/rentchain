import type { Response } from "express";

export function ok(res: Response, data: any = {}, status = 200) {
  return res.status(status).json({ ok: true, ...data });
}

export function jsonError(
  res: Response,
  status: number,
  code: string,
  error?: string,
  details?: any,
  requestId?: string
) {
  const payload: any = { ok: false, code };
  if (error) payload.error = error;
  if (details !== undefined) payload.details = details;
  if (requestId) payload.requestId = requestId;
  return res.status(status).json(payload);
}
