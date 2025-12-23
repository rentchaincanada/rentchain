import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./requireAuth";
import type { AuthenticatedUser } from "./authMiddleware";

export function requireRole(required: AuthenticatedUser["role"] | AuthenticatedUser["role"][]) {
  const requiredRoles = Array.isArray(required) ? required : [required];

  return async function requireRoleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    return requireAuth(req, res, () => {
      const user = (req as any).user as AuthenticatedUser | undefined;
      if (!user?.role) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!requiredRoles.includes(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    });
  };
}
