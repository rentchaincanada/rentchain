import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedUser } from "./authMiddleware";

/**
 * Ensures tenant routes only use the tenantId embedded in the token.
 * Rejects requests missing tenantId or where role is not "tenant".
 * Assumes upstream auth/role middleware has already run.
 */
export function validateTenantScope(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthenticatedUser | undefined;
  if (!user || user.role !== "tenant") {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!user.tenantId) {
    return res.status(401).json({ error: "Unauthorized: tenantId required" });
  }
  // Attach resolved tenantId to request for downstream handlers (read-only usage only)
  (req as any).tenantId = user.tenantId;
  return next();
}
