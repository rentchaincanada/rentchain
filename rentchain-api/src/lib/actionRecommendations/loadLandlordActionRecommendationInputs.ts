import { deriveLandlordPortfolioHealthSummary } from "../portfolioHealth/deriveLandlordPortfolioHealthSummary";
import { loadLandlordPortfolioHealthInputs } from "../portfolioHealth/loadLandlordPortfolioHealthInputs";
import { derivePortfolioScoreExternal } from "../portfolioScoreExternal/derivePortfolioScoreExternal";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export async function loadLandlordActionRecommendationInputs(landlordId: string) {
  const safeLandlordId = asString(landlordId, 240);
  const sharedInputs = await loadLandlordPortfolioHealthInputs(safeLandlordId);

  return {
    portfolioId: safeLandlordId,
    portfolioHealth: deriveLandlordPortfolioHealthSummary(sharedInputs),
    portfolioScore: derivePortfolioScoreExternal(sharedInputs),
  };
}
