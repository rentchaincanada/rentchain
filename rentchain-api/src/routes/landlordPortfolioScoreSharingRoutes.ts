import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadPortfolioScoreShareState } from "../lib/portfolioScoreSharing/loadPortfolioScoreShareState";
import {
  buildPortfolioScoreSharePath,
  revokePortfolioScoreSharing,
  rotatePortfolioScoreShareToken,
} from "../lib/portfolioScoreSharing/rotatePortfolioScoreShareToken";
import { savePortfolioScoreShareState } from "../lib/portfolioScoreSharing/savePortfolioScoreShareState";

const router = Router();

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function sharePayload(sharing: any) {
  return {
    sharing,
    shareUrl: sharing.visibility === "shareable_link" && sharing.shareToken
      ? buildPortfolioScoreSharePath(sharing.shareToken)
      : null,
  };
}

router.get("/landlord/portfolio-score-sharing", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const portfolioId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!portfolioId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const sharing = await loadPortfolioScoreShareState(portfolioId);
    return res.json(sharePayload(sharing));
  } catch (err: any) {
    console.error("[portfolio-score-sharing] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PORTFOLIO_SCORE_SHARING_FETCH_FAILED" });
  }
});

router.patch("/landlord/portfolio-score-sharing", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const portfolioId = asString(req.user?.landlordId || req.user?.id, 240);
    const visibility = asString(req.body?.visibility, 40).toLowerCase();
    if (!portfolioId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    if (visibility !== "private" && visibility !== "landlord_visible" && visibility !== "shareable_link") {
      return res.status(400).json({ ok: false, error: "INVALID_VISIBILITY" });
    }

    let sharing;
    if (visibility === "shareable_link") {
      const current = await loadPortfolioScoreShareState(portfolioId);
      sharing =
        current.shareToken && current.visibility === "shareable_link"
          ? await savePortfolioScoreShareState({
              portfolioId,
              visibility: "shareable_link",
              shareToken: current.shareToken,
              shareEnabledAt: current.shareEnabledAt || new Date().toISOString(),
              revokedAt: null,
            })
          : await rotatePortfolioScoreShareToken(portfolioId);
    } else {
      sharing = await revokePortfolioScoreSharing(portfolioId, visibility);
    }

    return res.json(sharePayload(sharing));
  } catch (err: any) {
    console.error("[portfolio-score-sharing] update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PORTFOLIO_SCORE_SHARING_UPDATE_FAILED" });
  }
});

router.post("/landlord/portfolio-score-sharing/rotate", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const portfolioId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!portfolioId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const sharing = await rotatePortfolioScoreShareToken(portfolioId);
    return res.json(sharePayload(sharing));
  } catch (err: any) {
    console.error("[portfolio-score-sharing] rotate failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "PORTFOLIO_SCORE_SHARING_ROTATE_FAILED" });
  }
});

export default router;
