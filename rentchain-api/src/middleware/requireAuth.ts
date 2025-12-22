import type { Request, Response, NextFunction } from "express";

/**
 * requireAuth (compat wrapper)
 * - If req.user exists, do nothing.
 * - Else, fail with 401.
 *
 * NOTE:
 * - This intentionally does NOT verify JWT. Your existing auth system should do that.
 * - Use this wrapper ONLY on routes where existing auth middleware is already applied globally
 *   OR where upstream middleware sets req.user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.user) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
