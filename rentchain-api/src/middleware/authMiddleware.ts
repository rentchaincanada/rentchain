// src/middleware/authMiddleware.ts
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/authConfig";
import { jsonError } from "../lib/httpResponse";
import { isAdminEmail } from "../lib/adminEmails";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "landlord" | "admin" | "tenant";
  landlordId?: string;
  tenantId?: string;
  leaseId?: string;
  plan?: string;
  actorRole?: string | null;
  actorLandlordId?: string | null;
}

export const authenticateJwt: RequestHandler = (req, res, next): void => {
  // Allow auth routes and health to be public
  if (req.path.startsWith("/api/auth/") || req.path === "/api/health") {
    return next();
  }

  const url = req.originalUrl || "";

  // Legacy /health (keep)
  if (url === "/health") {
    res.json({
      ok: true,
      service: "rentchain-api",
      releaseSha: process.env.RELEASE_SHA || "unknown",
      reportingEnabled: process.env.REPORTING_ENABLED === "true",
      reportingDryRun: process.env.REPORTING_DRY_RUN === "true",
    });
    return;
  }

  // Legacy /auth/* passthrough (keep for compatibility)
  if (url.startsWith("/auth/")) {
    return next();
  }

  // Dev-only routes
  if (process.env.NODE_ENV !== "production" && url.startsWith("/api/dev/")) {
    return next();
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    return next();
  }

  // Tenant portal dev bypass (existing behavior)
  const isTenantPortalDev =
    process.env.TENANT_PORTAL_DEV === "1" &&
    String(req.header("x-tenant-portal") || "") === "1" &&
    req.method === "POST" &&
    req.originalUrl.startsWith("/api/action-requests");

  if (isTenantPortalDev) {
    return next();
  }

  const authHeader = req.headers.authorization;

  // If no auth header, continue (routes can enforce auth explicitly)
  if (!authHeader) {
    return next();
  }

  if (!authHeader.startsWith("Bearer ")) {
    jsonError(res, 401, "UNAUTHORIZED", "UNAUTHORIZED", undefined, (req as any).requestId);
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const { sub, email, role, landlordId, tenantId, leaseId, plan, actorRole, actorLandlordId } =
      decoded as any;

    if (!sub || !email) {
      jsonError(res, 401, "UNAUTHORIZED", "UNAUTHORIZED", undefined, (req as any).requestId);
      return;
    }

    const resolvedRole: AuthenticatedUser["role"] = isAdminEmail(email)
      ? "admin"
      : ((role as any) || "landlord");

    (req as any).user = {
      id: String(sub),
      email: String(email),
      role: resolvedRole,
      landlordId:
        landlordId ||
        (resolvedRole === "landlord" || resolvedRole === "admin" ? String(sub) : undefined),
      tenantId: tenantId || undefined,
      leaseId: leaseId || undefined,
      plan: plan ?? "screening",
      actorRole: actorRole ?? null,
      actorLandlordId: actorLandlordId ?? null,
    };

    next();
  } catch (err) {
    console.error("[authenticateJwt] verification failed", err);
    jsonError(res, 401, "UNAUTHORIZED", "UNAUTHORIZED", undefined, (req as any).requestId);
  }
};
