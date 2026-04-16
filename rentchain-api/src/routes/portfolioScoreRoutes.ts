import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { loadPortfolioScoreSignals } from "../lib/portfolioScore/loadPortfolioScoreSignals";
import { derivePortfolioScore } from "../lib/portfolioScore/derivePortfolioScore";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function normalizeRole(req: any): "admin" | "landlord" | "other" {
  const role = asString(req.user?.actorRole || req.user?.role, 40).toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  return "other";
}

router.get("/portfolio-score", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const portfolioId = asString(req.query?.portfolioId, 240);
    if (!portfolioId) {
      return res.status(400).json({ ok: false, error: "PORTFOLIO_ID_REQUIRED" });
    }

    const signals = await loadPortfolioScoreSignals(portfolioId);
    const portfolioScore = derivePortfolioScore(signals);
    return res.json({ portfolioScore });
  } catch (err: any) {
    console.error("[portfolio-score] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PORTFOLIO_SCORE_FETCH_FAILED" });
  }
});

export default router;

