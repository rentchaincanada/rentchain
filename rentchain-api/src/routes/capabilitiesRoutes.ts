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

function buildFeatures(plan: ReturnType<typeof resolvePlanTier>) {
  return {
    ...CAPABILITIES[plan],
    microLive: false,
    tenantPdfReport: false,
    creditHistoryExport: false,
    dashboardAiSummary: true,
    tenantInvites: true,
    ledgerV2: true,
    waitlistEmail: true,
  };
}

router.get("/", async (req: any, res) => {
  try {
    const resolved = await resolveLandlordAndTier(req.user);
    const tier = resolved.tier;
    return res.json({
      ok: true,
      plan: tier,
      features: buildFeatures(tier),
      ts: Date.now(),
    });
  } catch (err: any) {
    const tokenPlan = resolvePlanTier(req.user?.plan);
    console.warn("[capabilities] resolver fallback", {
      tokenLandlordId: req.user?.landlordId || null,
      tokenPlan,
      err: err?.message || String(err),
    });
    return res.json({
      ok: true,
      plan: tokenPlan,
      features: buildFeatures(tokenPlan),
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
