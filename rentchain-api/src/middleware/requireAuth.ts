import type { Request, Response, NextFunction } from "express";
import type { Role, Permission } from "../auth/rbac";
import { verifyAuthToken, type JwtClaimsV1 } from "../auth/jwt";
import { db } from "../config/firebase";

type HydratedUser = {
  id: string;
  email?: string;
  role: Role;
  landlordId?: string;
  tenantId?: string;
  permissions?: Permission[];
  revokedPermissions?: Permission[];
};

function getBearerToken(req: any): string | null {
  const raw = req.headers?.authorization || req.headers?.Authorization;
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized: token required" });

    const claims: JwtClaimsV1 = verifyAuthToken(token);

    const baseUser: HydratedUser = {
      id: claims.sub,
      email: claims.email,
      role: claims.role,
      landlordId: claims.landlordId,
      tenantId: claims.tenantId,
      permissions: claims.permissions ?? [],
      revokedPermissions: claims.revokedPermissions ?? [],
    };

    const hydrate = String(process.env.AUTH_HYDRATE_FROM_DB || "").toLowerCase() === "true";
    if (!hydrate) {
      (req as any).user = baseUser;
      return next();
    }

    const snap = await db.collection("users").doc(baseUser.id).get();
    if (!snap.exists) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const u = snap.data() as any;

    if (u?.disabled === true) {
      return res.status(403).json({ error: "Account disabled" });
    }

    const hydrated: HydratedUser = {
      id: baseUser.id,
      email: u?.email ?? baseUser.email,
      role: (u?.role ?? baseUser.role) as Role,
      landlordId: u?.landlordId ?? baseUser.landlordId,
      tenantId: u?.tenantId ?? baseUser.tenantId,
      permissions: Array.isArray(u?.permissions) ? (u.permissions as Permission[]) : baseUser.permissions,
      revokedPermissions: Array.isArray(u?.revokedPermissions)
        ? (u.revokedPermissions as Permission[])
        : baseUser.revokedPermissions,
    };

    (req as any).user = hydrated;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
