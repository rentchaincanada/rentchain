import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken, type JwtClaimsV1 } from "../auth/jwt";
import type { Role, Permission } from "../auth/rbac";
import { db } from "../firebase";

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

export async function requireAuth(req: any, res: any, next: any) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing bearer token" });
    }

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
      req.user = baseUser;
      return next();
    }

    const snap = await db.collection("users").doc(baseUser.id).get();
    if (!snap.exists) {
      return res.status(401).json({ ok: false, error: "User not found" });
    }

    const u = snap.data() as any;

    if (u?.disabled === true) {
      return res.status(403).json({ ok: false, error: "Account disabled" });
    }

    if (u?.landlordId && baseUser.landlordId && u.landlordId !== baseUser.landlordId) {
      return res.status(403).json({ ok: false, error: "Landlord scope mismatch" });
    }

    if (u?.tenantId && baseUser.tenantId && u.tenantId !== baseUser.tenantId) {
      return res.status(403).json({ ok: false, error: "Tenant scope mismatch" });
    }

    req.user = {
      id: baseUser.id,
      email: u.email ?? baseUser.email,
      role: (u.role ?? baseUser.role) as Role,
      landlordId: u.landlordId ?? baseUser.landlordId,
      tenantId: u.tenantId ?? baseUser.tenantId,
      permissions: Array.isArray(u.permissions) ? u.permissions : baseUser.permissions,
      revokedPermissions: Array.isArray(u.revokedPermissions) ? u.revokedPermissions : baseUser.revokedPermissions,
    };

    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}
