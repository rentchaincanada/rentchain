import { apiFetch } from "./apiFetch";
import type { PortfolioScoreExternalV1 } from "./landlordPortfolioScoreApi";

export type PortfolioScoreSharedViewV1 = PortfolioScoreExternalV1;

export async function fetchSharedPortfolioScore(token: string): Promise<{
  portfolioScore: PortfolioScoreSharedViewV1;
}> {
  return await apiFetch(`/portfolio-score/shared/${encodeURIComponent(token)}`);
}
