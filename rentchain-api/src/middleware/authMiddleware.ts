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
  role: "landlord";
  landlordId?: string;
  plan?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  account?: Account;
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

  if (url === "/health" || url.startsWith("/auth/")) {
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
    return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    const { sub, email, role, landlordId, plan } = decoded as any;

    if (!sub || !email) {
      return jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);
    }

    req.user = {
      id: String(sub),
      email: String(email),
      role: (role as AuthenticatedUser["role"]) || "landlord",
      landlordId: landlordId || String(sub),
      plan: plan ?? "starter",
    };

    next();
  } catch (err) {
    console.error("[authenticateJwt] verification failed", err);
    jsonError(res, 401, "UNAUTHORIZED", "Unauthorized", undefined, req.requestId);
  }
}
