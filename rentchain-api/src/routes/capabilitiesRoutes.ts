import { Router } from "express";
import { CAPABILITIES, resolvePlanTier } from "../config/capabilities";
import { db } from "../config/firebase";

const router = Router();

/**
 * Public-ish capabilities endpoint.
 * Keep it safe: do not reveal secrets, just feature flags.
 * If you want it authenticated only, add authenticateJwt middleware here.
 */
router.get("/", (req: any, res) => {
  const planFromToken = resolvePlanTier(req.user?.plan);
  const landlordId =
    req.user?.landlordId || (req.user?.role === "landlord" ? req.user?.id : null);

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

  if (!landlordId) {
    return respondWithPlan(planFromToken);
  }

  return db
    .collection("landlords")
    .doc(String(landlordId))
    .get()
    .then((snap) => {
      const data = snap.exists ? (snap.data() as any) : null;
      const plan = resolvePlanTier(data?.plan || req.user?.plan);
      respondWithPlan(plan);
    })
    .catch(() => {
      respondWithPlan(planFromToken);
    });
});

export default router;
