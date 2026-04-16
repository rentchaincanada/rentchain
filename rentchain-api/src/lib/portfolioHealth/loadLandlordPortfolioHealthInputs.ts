import { derivePortfolioScore } from "../portfolioScore/derivePortfolioScore";
import { loadPortfolioScoreSignals } from "../portfolioScore/loadPortfolioScoreSignals";
import { derivePortfolioScoreTrend } from "../portfolioScoreHistory/derivePortfolioScoreTrend";
import { loadPortfolioScoreHistory } from "../portfolioScoreHistory/loadPortfolioScoreHistory";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export async function loadLandlordPortfolioHealthInputs(portfolioId: string) {
  const safePortfolioId = asString(portfolioId, 240);
  const [signals, history] = await Promise.all([
    loadPortfolioScoreSignals(safePortfolioId),
    loadPortfolioScoreHistory(safePortfolioId, 12),
  ]);
  const portfolioScore = derivePortfolioScore(signals);
  const portfolioTrend = derivePortfolioScoreTrend(history, safePortfolioId);
  return {
    portfolioId: safePortfolioId,
    portfolioScore,
    portfolioTrend,
  };
}
