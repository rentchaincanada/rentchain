import type { Request, Response, NextFunction } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";

export type ExistingAuthRunResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function runMiddleware(
  mw: (req: Request, res: Response, next: NextFunction) => any,
  req: Request,
  res: Response
) {
  return new Promise<void>((resolve, reject) => {
    try {
      mw(req, res, (err?: any) => {
        if (err) reject(err);
        else resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Calls existing auth middleware to attach req.user.
 * - If it ends the response itself on failure, we detect that via headersSent.
 */
export async function runExistingAuth(
  req: Request,
  res: Response
): Promise<ExistingAuthRunResult> {
  try {
    if ((req as any).user) return { ok: true };

    await runMiddleware(authenticateJwt as any, req, res);

    if (res.headersSent) {
      return { ok: false, status: res.statusCode || 401, error: "Unauthorized" };
    }

    const anyReq = req as any;
    if (anyReq.user) return { ok: true };
    if (!anyReq.user && (anyReq.auth || anyReq.claims)) {
      anyReq.user = anyReq.auth || anyReq.claims;
      return { ok: true };
    }

    return { ok: false, status: 401, error: "Unauthorized" };
  } catch (_err) {
    if (!res.headersSent) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    return { ok: false, status: res.statusCode || 401, error: "Unauthorized" };
  }
}
