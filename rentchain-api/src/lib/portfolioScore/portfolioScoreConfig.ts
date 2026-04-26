import type { PortfolioScoreComponent, PortfolioScoreGrade } from "./portfolioScoreTypes";

type ComponentKey = PortfolioScoreComponent["key"];

export const PORTFOLIO_SCORE_COMPONENT_WEIGHTS: Record<ComponentKey, number> = {
  workflow_completion: 0.25,
  screening_reliability: 0.2,
  maintenance_stability: 0.15,
  automation_health: 0.1,
  policy_friction: 0.1,
  exception_burden: 0.2,
};

export const PORTFOLIO_SCORE_GRADE_BANDS: Array<{
  grade: PortfolioScoreGrade;
  minimumScore: number;
}> = [
  { grade: "A", minimumScore: 90 },
  { grade: "B", minimumScore: 80 },
  { grade: "C", minimumScore: 70 },
  { grade: "D", minimumScore: 60 },
  { grade: "E", minimumScore: 0 },
];

export const PORTFOLIO_SCORE_STATUS_BANDS = {
  healthy: 85,
  watch: 70,
};

export const PORTFOLIO_SCORE_SPARSE_DATA_THRESHOLD = 5;
export const PORTFOLIO_SCORE_SPARSE_DATA_BASELINE = 75;

