import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsAlerts } from "../services/landlord/landlordAnalyticsAlerts";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

router.get("/landlord/analytics/alerts", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const result = await loadLandlordAnalyticsAlerts({
      landlordId,
      period: req.query?.period,
      propertyId: req.query?.propertyId,
      status: req.query?.status,
    });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[landlord-analytics-alerts] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_ANALYTICS_ALERTS_FETCH_FAILED" });
  }
});

export default router;
