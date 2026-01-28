import { Router } from "express";
import { CAPABILITIES, resolvePlanTier } from "../config/capabilities";

const router = Router();

/**
 * Public-ish capabilities endpoint.
 * Keep it safe: do not reveal secrets, just feature flags.
 * If you want it authenticated only, add authenticateJwt middleware here.
 */
router.get("/", (req: any, res) => {
  const plan = resolvePlanTier(req.user?.plan);
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
});

export default router;
