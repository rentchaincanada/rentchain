import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken, type JwtClaimsV1 } from "../auth/jwt";
import { buildCanonicalSessionUserFromClaims } from "../services/sessionUserService";

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
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }

    const claims: JwtClaimsV1 = verifyAuthToken(token);

    req.__entitlementsCache = req.__entitlementsCache || {};
    const hydratedUser = await buildCanonicalSessionUserFromClaims(claims, {
      requestCache: req.__entitlementsCache,
    });
    req.user = hydratedUser;
    req.entitlements = hydratedUser.entitlements;

    next();
  } catch (error: any) {
    const code = String(error?.message || "").toUpperCase();
    if (code === "ACCOUNT_DISABLED") {
      return res.status(403).json({ ok: false, error: "Account disabled" });
    }
    if (code === "LANDLORD_SCOPE_MISMATCH") {
      return res.status(403).json({ ok: false, error: "Landlord scope mismatch" });
    }
    if (code === "TENANT_SCOPE_MISMATCH") {
      return res.status(403).json({ ok: false, error: "Tenant scope mismatch" });
    }
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }
}
