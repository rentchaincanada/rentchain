import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordPortfolioHealthInputs } from "../lib/portfolioHealth/loadLandlordPortfolioHealthInputs";
import { derivePortfolioScoreExternal } from "../lib/portfolioScoreExternal/derivePortfolioScoreExternal";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

router.get("/landlord/portfolio-score", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const inputs = await loadLandlordPortfolioHealthInputs(landlordId);
    const portfolioScore = derivePortfolioScoreExternal(inputs);
    return res.json({ portfolioScore });
  } catch (err: any) {
    console.error("[landlord-portfolio-score] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_PORTFOLIO_SCORE_FETCH_FAILED" });
  }
});

export default router;
