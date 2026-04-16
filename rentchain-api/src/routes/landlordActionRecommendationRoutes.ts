import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordActionRecommendationInputs } from "../lib/actionRecommendations/loadLandlordActionRecommendationInputs";
import { deriveLandlordActionRecommendations } from "../lib/actionRecommendations/deriveLandlordActionRecommendations";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

router.get("/landlord/action-recommendations", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const inputs = await loadLandlordActionRecommendationInputs(landlordId);
    const recommendations = deriveLandlordActionRecommendations(inputs);
    return res.json({ recommendations });
  } catch (err: any) {
    console.error("[landlord-action-recommendations] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_ACTION_RECOMMENDATIONS_FETCH_FAILED" });
  }
});

export default router;
