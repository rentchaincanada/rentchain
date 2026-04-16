import { PORTFOLIO_SCORE_TREND_DELTA_THRESHOLD } from "./portfolioScoreHistoryConstants";
import type { PortfolioScoreSnapshotV1, PortfolioScoreTrendV1 } from "./portfolioScoreHistoryTypes";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function compareSnapshotsDescending(a: PortfolioScoreSnapshotV1, b: PortfolioScoreSnapshotV1) {
  return Date.parse(b.snapshotAt) - Date.parse(a.snapshotAt);
}

function componentSummary(key: string, direction: "up" | "down" | "flat") {
  if (key === "screening_reliability") {
    return direction === "down"
      ? "Screening reconciliation issues reduced reliability."
      : direction === "up"
      ? "Screening reconciliation reliability improved."
      : "Screening reliability stayed stable.";
  }
  if (key === "exception_burden") {
    return direction === "down"
      ? "Exception burden increased and weighed on the score."
      : direction === "up"
      ? "Exception burden eased versus the previous snapshot."
      : "Exception burden stayed stable.";
  }
  if (key === "maintenance_stability") {
    return direction === "down"
      ? "Maintenance reopen or stall signals reduced stability."
      : direction === "up"
      ? "Maintenance stability improved across recent workflows."
      : "Maintenance stability stayed stable.";
  }
  if (key === "automation_health") {
    return direction === "down"
      ? "Automation skips increased or successful execution fell."
      : direction === "up"
      ? "Automation execution quality improved."
      : "Automation health stayed stable.";
  }
  if (key === "policy_friction") {
    return direction === "down"
      ? "Policy reviews or blocks increased friction."
      : direction === "up"
      ? "Policy friction eased versus the previous snapshot."
      : "Policy friction stayed stable.";
  }
  return direction === "down"
    ? "Workflow completion declined versus the previous snapshot."
    : direction === "up"
    ? "Workflow completion improved versus the previous snapshot."
    : "Workflow completion stayed stable.";
}

export function derivePortfolioScoreTrend(
  snapshots: PortfolioScoreSnapshotV1[],
  portfolioId?: string
): PortfolioScoreTrendV1 {
  const history = [...(snapshots || [])].sort(compareSnapshotsDescending);
  const latest = history[0] || null;
  const previous = history[1] || null;
  const safePortfolioId = portfolioId || latest?.portfolioId || previous?.portfolioId || "";
  const generatedAt = new Date().toISOString();

  if (!latest || !previous) {
    return {
      version: "v1",
      portfolioId: safePortfolioId,
      generatedAt,
      latest,
      previous,
      direction: "insufficient_data",
      deltaScore: null,
      deltaGrade: null,
      summary: {
        headline: latest
          ? "More score history is needed before a trend can be established."
          : "No portfolio score history is available yet.",
        notes: latest
          ? ["Create at least one more snapshot to compare score direction and component movement."]
          : ["Create the first snapshot to start tracking portfolio score movement over time."],
      },
      movers: [],
      history,
    };
  }

  const deltaScore = round(latest.score - previous.score);
  const direction =
    deltaScore > PORTFOLIO_SCORE_TREND_DELTA_THRESHOLD
      ? "up"
      : deltaScore < -PORTFOLIO_SCORE_TREND_DELTA_THRESHOLD
      ? "down"
      : "flat";

  const previousByKey = new Map(previous.componentScores.map((component) => [component.key, component]));
  const movers = latest.componentScores
    .map((component) => {
      const previousComponent = previousByKey.get(component.key);
      const deltaNormalizedScore = round(component.normalizedScore - (previousComponent?.normalizedScore || 0));
      const deltaContribution = round(component.contribution - (previousComponent?.contribution || 0));
      const moverDirection: "up" | "down" | "flat" =
        deltaContribution > 0 ? "up" : deltaContribution < 0 ? "down" : "flat";
      return {
        key: component.key,
        deltaNormalizedScore,
        deltaContribution,
        direction: moverDirection,
        summary: componentSummary(component.key, moverDirection),
      };
    })
    .sort((a, b) => Math.abs(b.deltaContribution) - Math.abs(a.deltaContribution));

  const topMover = movers[0];
  const headline =
    direction === "up"
      ? "Portfolio score improved versus the previous snapshot."
      : direction === "down"
      ? "Portfolio score declined versus the previous snapshot."
      : "Portfolio score is broadly stable versus the previous snapshot.";

  const notes: string[] = [];
  if (topMover && topMover.direction !== "flat") {
    notes.push(topMover.summary);
  }
  if (latest.metrics.criticalTriageCount > previous.metrics.criticalTriageCount) {
    notes.push("Critical triage burden increased since the previous snapshot.");
  } else if (latest.metrics.criticalTriageCount < previous.metrics.criticalTriageCount) {
    notes.push("Critical triage burden decreased since the previous snapshot.");
  }
  if (latest.metrics.reconciliationIssueCount > previous.metrics.reconciliationIssueCount) {
    notes.push("Reconciliation issue burden increased.");
  } else if (latest.metrics.reconciliationIssueCount < previous.metrics.reconciliationIssueCount) {
    notes.push("Reconciliation issue burden decreased.");
  }
  if (!notes.length) {
    notes.push("Component movement stayed within a narrow operating band.");
  }

  return {
    version: "v1",
    portfolioId: safePortfolioId,
    generatedAt,
    latest,
    previous,
    direction,
    deltaScore,
    deltaGrade: latest.grade === previous.grade ? null : `${previous.grade} -> ${latest.grade}`,
    summary: {
      headline,
      notes,
    },
    movers: movers.filter((mover) => Math.abs(mover.deltaContribution) > 0),
    history,
  };
}
