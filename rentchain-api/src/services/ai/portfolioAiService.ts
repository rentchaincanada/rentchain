import { PortfolioSnapshot, PortfolioAiSummary } from "../../types/models";

const hasAiKey = Boolean(process.env.OPENAI_API_KEY);

export async function generatePortfolioSummary(input: {
  snapshot: PortfolioSnapshot;
}): Promise<PortfolioAiSummary> {
  const { snapshot } = input;

  if (!hasAiKey) {
    return buildDeterministicSummary(snapshot);
  }

  // Stub: real AI provider integration can be added later.
  return buildDeterministicSummary(snapshot);
}

function buildDeterministicSummary(
  snapshot: PortfolioSnapshot
): PortfolioAiSummary {
  const { occupancyPct, overdueTenants, ledgerAnomalies, propertyCount, unitCount } =
    snapshot;

  let healthLabel: PortfolioAiSummary["healthLabel"] = "Stable";
  if (occupancyPct >= 0.95 && overdueTenants === 0) {
    healthLabel = "Excellent";
  } else if (occupancyPct < 0.8 || overdueTenants > 2) {
    healthLabel = "At Risk";
  }

  const summaryText = `You have ${propertyCount} properties and ${unitCount} units with ${Math.round(
    occupancyPct * 100
  )}% occupancy. ${overdueTenants} tenant(s) appear overdue based on ledger activity.`;

  const risks: string[] = [];
  if (occupancyPct < 0.9) {
    risks.push("Occupancy below 90%; consider marketing vacant units.");
  }
  if (overdueTenants > 0) {
    risks.push(`${overdueTenants} tenant(s) show outstanding balances beyond 14 days.`);
  }
  if (ledgerAnomalies.length) {
    risks.push(...ledgerAnomalies.slice(0, 3));
  }

  const opportunities: string[] = [];
  if (occupancyPct >= 0.9) {
    opportunities.push("Strong occupancy; evaluate gentle rent optimizations.");
  } else {
    opportunities.push("Vacancies present; focus on faster turns and listings.");
  }
  if (overdueTenants === 0) {
    opportunities.push("No overdue tenants flagged; maintain consistent reminders.");
  }

  const suggestedActions: string[] = [];
  suggestedActions.push("Review ledger anomalies and confirm recent payments are recorded.");
  if (overdueTenants > 0) {
    suggestedActions.push("Send reminders to overdue tenants and align on payment plans.");
  }
  suggestedActions.push("Refresh vacancy listings and verify unit readiness.");

  return {
    healthLabel,
    summaryText,
    risks,
    opportunities,
    suggestedActions,
  };
}
