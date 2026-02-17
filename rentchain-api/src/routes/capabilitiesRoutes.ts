import { Router } from "express";
import { CAPABILITIES, resolvePlanTier } from "../config/capabilities";
import { resolveLandlordAndTier } from "../lib/landlordResolver";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/**
 * Public-ish capabilities endpoint.
 * Keep it safe: do not reveal secrets, just feature flags.
 * If you want it authenticated only, add authenticateJwt middleware here.
 */
router.use(authenticateJwt, requireAuth);

function buildFeatures(plan: ReturnType<typeof resolvePlanTier>, isAdmin = false) {
  const base = {
    ...CAPABILITIES[plan],
    microLive: false,
    tenantPdfReport: false,
    creditHistoryExport: false,
    dashboardAiSummary: true,
    tenantInvites: true,
    ledgerV2: true,
    waitlistEmail: true,
  };
  if (!isAdmin) return base;
  return Object.fromEntries(Object.keys(base).map((key) => [key, true]));
}

router.get("/", async (req: any, res) => {
  const isAdmin = String(req.user?.role || "").toLowerCase() === "admin";
  try {
    const resolved = await resolveLandlordAndTier(req.user);
    const capTier = isAdmin ? "elite" : resolved.tier;
    const planLabel = isAdmin ? "elite" : capTier;
    return res.json({
      ok: true,
      plan: planLabel,
      features: buildFeatures(capTier, isAdmin),
      ts: Date.now(),
    });
  } catch (err: any) {
    const tokenPlan = resolvePlanTier(req.user?.plan);
    const capTier = isAdmin ? "elite" : tokenPlan;
    const planLabel = isAdmin ? "elite" : capTier;
    console.warn("[capabilities] resolver fallback", {
      tokenLandlordId: req.user?.landlordId || null,
      tokenPlan,
      err: err?.message || String(err),
    });
    return res.json({
      ok: true,
      plan: planLabel,
      features: buildFeatures(capTier, isAdmin),
      ts: Date.now(),
    });
  }
});

router.get("/_debug", async (req: any, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  const tokenPlan = resolvePlanTier(req.user?.plan);
  const tokenLandlordId = req.user?.landlordId || req.user?.id || null;
  const resolved = await resolveLandlordAndTier(req.user);

  return res.json({
    ok: true,
    tokenPlan: req.user?.plan || tokenPlan,
    tokenLandlordId,
    resolvedTier: resolved.tier,
    resolvedLandlordId: resolved.landlordIdResolved,
    landlordDocId: resolved.landlordDocId,
    landlordPlanRaw: resolved.landlordPlanRaw,
    source: resolved.source,
  });
});

export default router;
