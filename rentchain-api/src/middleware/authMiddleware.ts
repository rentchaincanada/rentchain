// src/middleware/authMiddleware.ts
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/authConfig";
import type { Account } from "../types/account";
import type { Usage } from "../types/account";
import { DEV_DEFAULT_PLAN } from "../config/devFlags";
import { jsonError } from "../lib/httpResponse";

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

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  account?: Account;
  requestId?: string;
  integrity?: {
    ok: boolean;
    before?: Usage;
    after?: Usage;
  };
}

export function authenticateJwt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.path.startsWith("/api/auth/") || req.path === "/api/health") {
    return next();
  }
  const url = req.originalUrl || "";

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

  if (url.startsWith("/auth/")) {
    return next();
  }

  if (process.env.NODE_ENV !== "production" && url.startsWith("/api/dev/")) {
    return next();
  }

  if (req.method === "OPTIONS") {
    return next();
  }

  const isTenantPortalDev =
    process.env.TENANT_PORTAL_DEV === "1" &&
    String(req.header("x-tenant-portal") || "") === "1" &&
    req.method === "POST" &&
    req.originalUrl.startsWith("/api/action-requests");

  if (isTenantPortalDev) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  if (!authHeader.startsWith("Bearer ")) {
    jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const { sub, email, role, landlordId, tenantId, leaseId, plan, actorRole, actorLandlordId } = decoded as any;

    if (!sub || !email) {
      jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);
      return;
    }

    req.user = {
      id: String(sub),
      email: String(email),
      role: (role as AuthenticatedUser["role"]) || "landlord",
      landlordId: landlordId || (role === "landlord" || role === "admin" ? String(sub) : undefined),
      tenantId: tenantId || undefined,
      leaseId: leaseId || undefined,
      plan: plan ?? "starter",
      actorRole: actorRole ?? null,
      actorLandlordId: actorLandlordId ?? null,
    };

    next();
  } catch (err) {
    console.error("[authenticateJwt] verification failed", err);
    jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);
  }
}
