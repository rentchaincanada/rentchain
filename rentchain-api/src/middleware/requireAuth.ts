import type { Request, Response, NextFunction } from "express";
import { runExistingAuth } from "../auth/authAdapter";

/**
 * requireAuth
 * - If req.user exists, allow through.
 * - Otherwise, call existing auth middleware via adapter to populate req.user.
 * - If still unauthenticated, respond 401 JSON.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if ((req as any).user) return next();

    const result = await runExistingAuth(req, res);

    if (res.headersSent) return;

    if (result.ok && (req as any).user) return next();

    return res.status(result.ok ? 401 : result.status).json({ error: "Unauthorized" });
  } catch (_err) {
    if (res.headersSent) return;
    return res.status(401).json({ error: "Unauthorized" });
  }
}
