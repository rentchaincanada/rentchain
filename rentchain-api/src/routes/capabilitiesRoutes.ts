import { Router } from "express";

const router = Router();

/**
 * Public-ish capabilities endpoint.
 * Keep it safe: do not reveal secrets, just feature flags.
 * If you want it authenticated only, add authenticateJwt middleware here.
 */
router.get("/", (req: any, res) => {
  const plan = req.user?.plan || "public";

  const features = {
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
