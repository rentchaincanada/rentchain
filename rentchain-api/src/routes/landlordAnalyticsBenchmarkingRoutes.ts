import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsBenchmarking } from "../services/landlord/landlordAnalyticsBenchmarking";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

router.get("/landlord/analytics/benchmarking", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const result = await loadLandlordAnalyticsBenchmarking({
      landlordId,
      period: req.query?.period,
      propertyId: req.query?.propertyId,
    });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[landlord-analytics-benchmarking] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_ANALYTICS_BENCHMARKING_FETCH_FAILED" });
  }
});

export default router;
