import { Router } from "express";
import { db } from "../config/firebase";
import { deriveSharedPortfolioScoreView } from "../lib/portfolioScoreSharing/deriveSharedPortfolioScoreView";
import { derivePortfolioScoreExternal } from "../lib/portfolioScoreExternal/derivePortfolioScoreExternal";
import { loadLandlordPortfolioHealthInputs } from "../lib/portfolioHealth/loadLandlordPortfolioHealthInputs";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

router.get("/portfolio-score/shared/:token", async (req: any, res) => {
  try {
    const token = asString(req.params?.token, 240);
    if (!token) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const snap = await db
      .collection("portfolioScoreSharing")
      .where("shareToken", "==", token)
      .where("visibility", "==", "shareable_link")
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const record = snap.docs[0].data() as any;
    const portfolioId = asString(record?.portfolioId, 240);
    if (!portfolioId || record?.revokedAt) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const inputs = await loadLandlordPortfolioHealthInputs(portfolioId);
    const externalScore = derivePortfolioScoreExternal(inputs);
    const portfolioScore = deriveSharedPortfolioScoreView(externalScore);
    if (!portfolioScore) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    return res.json({ portfolioScore });
  } catch (err: any) {
    console.error("[public-portfolio-score] fetch failed", err?.message || err);
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
});

export default router;
