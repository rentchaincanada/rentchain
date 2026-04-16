import crypto from "crypto";
import { loadPortfolioScoreShareState } from "./loadPortfolioScoreShareState";
import { savePortfolioScoreShareState } from "./savePortfolioScoreShareState";

function buildShareToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function buildPortfolioScoreSharePath(token: string) {
  return `/portfolio-score/shared/${encodeURIComponent(token)}`;
}

export async function rotatePortfolioScoreShareToken(portfolioId: string) {
  const current = await loadPortfolioScoreShareState(portfolioId);
  const token = buildShareToken();
  return await savePortfolioScoreShareState({
    portfolioId,
    visibility: "shareable_link",
    shareToken: token,
    shareEnabledAt: new Date().toISOString(),
    revokedAt: null,
  });
}

export async function revokePortfolioScoreSharing(portfolioId: string, visibility: "private" | "landlord_visible") {
  const current = await loadPortfolioScoreShareState(portfolioId);
  return await savePortfolioScoreShareState({
    portfolioId,
    visibility,
    shareToken: null,
    shareEnabledAt: current.shareEnabledAt || null,
    revokedAt: new Date().toISOString(),
  });
}
