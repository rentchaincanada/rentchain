import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { loadPortfolioScoreHistory } from "../lib/portfolioScoreHistory/loadPortfolioScoreHistory";
import { derivePortfolioScoreTrend } from "../lib/portfolioScoreHistory/derivePortfolioScoreTrend";
import { savePortfolioScoreSnapshot } from "../lib/portfolioScoreHistory/savePortfolioScoreSnapshot";

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

function parseLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

router.get("/portfolio-score/history", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const portfolioId = asString(req.query?.portfolioId, 240);
    if (!portfolioId) {
      return res.status(400).json({ ok: false, error: "PORTFOLIO_ID_REQUIRED" });
    }

    const history = await loadPortfolioScoreHistory(portfolioId, parseLimit(req.query?.limit));
    return res.json({ history });
  } catch (err: any) {
    console.error("[portfolio-score-history] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PORTFOLIO_SCORE_HISTORY_FETCH_FAILED" });
  }
});

router.get("/portfolio-score/trend", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const portfolioId = asString(req.query?.portfolioId, 240);
    if (!portfolioId) {
      return res.status(400).json({ ok: false, error: "PORTFOLIO_ID_REQUIRED" });
    }

    const history = await loadPortfolioScoreHistory(portfolioId, parseLimit(req.query?.limit));
    const trend = derivePortfolioScoreTrend(history, portfolioId);
    return res.json({ trend });
  } catch (err: any) {
    console.error("[portfolio-score-trend] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PORTFOLIO_SCORE_TREND_FETCH_FAILED" });
  }
});

router.post("/portfolio-score/snapshot", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const portfolioId = asString(req.body?.portfolioId, 240);
    if (!portfolioId) {
      return res.status(400).json({ ok: false, error: "PORTFOLIO_ID_REQUIRED" });
    }

    const snapshot = await savePortfolioScoreSnapshot(portfolioId);
    return res.status(201).json({ snapshot });
  } catch (err: any) {
    console.error("[portfolio-score-snapshot] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PORTFOLIO_SCORE_SNAPSHOT_CREATE_FAILED" });
  }
});

export default router;

