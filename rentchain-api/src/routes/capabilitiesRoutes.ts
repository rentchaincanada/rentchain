import { Router } from "express";
import { CAPABILITIES, resolvePlanTier } from "../config/capabilities";
import { resolveLandlordAndTier } from "../lib/landlordResolver";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/**
 * Public capabilities endpoint.
 * Safe for unauthenticated requests: returns only plan + feature flags.
 */
router.use(authenticateJwt);

function buildFeatures(plan: ReturnType<typeof resolvePlanTier>, isAdmin = false) {
  const planFeatures = CAPABILITIES[plan];
  const base = {
    ...planFeatures,
    screening: Boolean(planFeatures.screening || planFeatures.screening_pay_per_use),
    screening_history: Boolean(
      planFeatures.screening_history || planFeatures.screening || planFeatures.screening_pay_per_use
    ),
    pdf_export: Boolean(planFeatures.pdf_export || planFeatures.exports_basic),
    move_in_readiness: Boolean(planFeatures.move_in_readiness || planFeatures.tenant_invites),
    work_orders: Boolean(planFeatures.work_orders || planFeatures.maintenance),
    review_summary: Boolean(planFeatures.review_summary || planFeatures.pdf_export || planFeatures.exports_basic),
    microLive: false,
    tenantPdfReport: Boolean(planFeatures.pdf_export || planFeatures.exports_basic),
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
  if (!req.user) {
    return res.json({
      ok: true,
      plan: "free",
      features: buildFeatures("free", false),
      ts: Date.now(),
    });
  }

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

router.get("/_debug", requireAuth, async (req: any, res) => {
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
