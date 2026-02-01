import { Router } from "express";
import { CAPABILITIES, resolvePlanTier } from "../config/capabilities";
import { resolveLandlordAndTier } from "../lib/landlordResolver";

const router = Router();

/**
 * Public-ish capabilities endpoint.
 * Keep it safe: do not reveal secrets, just feature flags.
 * If you want it authenticated only, add authenticateJwt middleware here.
 */
router.get("/", (req: any, res) => {
  const respondWithPlan = (plan: ReturnType<typeof resolvePlanTier>) => {
    const features = {
      ...CAPABILITIES[plan],
      microLive: false,
      tenantPdfReport: false,
      creditHistoryExport: false,
      dashboardAiSummary: true,
      tenantInvites: true,
      ledgerV2: true,
      waitlistEmail: true,
    };

    res.json({
      ok: true,
      plan,
      features,
      ts: Date.now(),
    });
  };
  resolveLandlordAndTier(req.user)
    .then((resolved) => {
      respondWithPlan(resolved.tier);
    })
    .catch(() => {
      const planFromToken = resolvePlanTier(req.user?.plan);
      respondWithPlan(planFromToken);
    });
});

router.get("/_debug", async (req: any, res) => {
  const tokenLandlordId = req.user?.landlordId || req.user?.id || null;
  const allowSelf = Boolean(req.query?.landlordId) && String(req.query.landlordId) === String(tokenLandlordId || "");
  if (req.user?.role !== "admin" && !allowSelf) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  const tokenPlan = resolvePlanTier(req.user?.plan);
  const resolved = await resolveLandlordAndTier(req.user);

  return res.json({
    ok: true,
    tokenPlan,
    tokenLandlordId,
    resolvedLandlordId: resolved.landlordIdResolved,
    landlordDocId: resolved.landlordDocId,
    landlordPlan: resolved.landlordPlan,
    returnedTier: resolved.tier,
    source: resolved.source,
  });
});

export default router;
