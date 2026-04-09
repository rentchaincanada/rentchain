import { Router } from "express";
import { runIdentityOracle } from "../services/identityOracle/identityOracleService";

const router = Router();

function requireInternalJobToken(req: any, res: any, next: any) {
  const expected = String(process.env.INTERNAL_JOB_TOKEN || "").trim();
  const received = String(req.headers["x-internal-job-token"] || "").trim();
  if (!expected || received !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  return next();
}

// This route intentionally stays internal-only and mounted under /api/internal
// to follow the repo's existing job-token execution pattern.
router.post("/identity-oracle/run", requireInternalJobToken, async (req: any, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await runIdentityOracle({
      propertyId: body?.propertyId,
      identifier: body?.identifier,
      identifierType: body?.identifierType,
      province: body?.province,
      municipality: body?.municipality,
      actorId: body?.actorId,
      actorType: body?.actorType,
    });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    const statusCode =
      typeof err?.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500
        ? err.statusCode
        : 500;

    if (statusCode >= 500) {
      console.error("[identity-oracle] failed", err?.message || err);
    }

    return res.status(statusCode).json({
      ok: false,
      error: statusCode >= 500 ? "identity_oracle_failed" : String(err?.message || "bad_request"),
    });
  }
});

export default router;
