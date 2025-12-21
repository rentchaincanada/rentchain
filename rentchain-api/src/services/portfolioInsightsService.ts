// src/services/portfolioInsightsService.ts
import { db } from "../config/firebase";
import { getTenantsList, TenantRecord } from "./tenantDetailsService";

export type PortfolioInsightSeverity = "info" | "warning" | "critical";

export interface PortfolioAiInsight {
  id: string;
  title: string;
  severity: PortfolioInsightSeverity;
  detail: string;
  category?: "cashflow" | "risk" | "collections" | "operations";
}

export interface PortfolioAiInsightsResponse {
  generatedAt: string;
  summary: string;
  metrics: {
    totalTenants: number;
    lowRiskTenants: number;
    mediumRiskTenants: number;
    highRiskTenants: number;
    totalMonthlyRent: number;
    totalOutstandingBalance: number;
    paymentsLast30Days: number;
    paymentsLast30DaysAmount: number;
  };
  insights: PortfolioAiInsight[];
}

// Helper to parse YYYY-MM-DD style strings safely
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export async function buildPortfolioInsightsResponse(): Promise<PortfolioAiInsightsResponse> {
  // 1) Get tenants (service already handles Firestore vs fallback)
  const tenants: TenantRecord[] = await getTenantsList();

  // Risk counts + financials
  let lowRiskTenants = 0;
  let mediumRiskTenants = 0;
  let highRiskTenants = 0;
  let totalMonthlyRent = 0;
  let totalOutstandingBalance = 0;

  tenants.forEach((t) => {
    const risk = (t.riskLevel ?? "Low") as string;
    if (risk === "High") highRiskTenants++;
    else if (risk === "Medium") mediumRiskTenants++;
    else lowRiskTenants++;

    totalMonthlyRent += Number(t.monthlyRent ?? 0);
    totalOutstandingBalance += Number(t.balance ?? 0);
  });

  const totalTenants = tenants.length;

  // 2) Payments snapshot (basic, but enough for “AI-style” insights)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let paymentsLast30Days = 0;
  let paymentsLast30DaysAmount = 0;

  try {
    const snap = await db.collection("payments").get();

    snap.forEach((doc) => {
      const data = doc.data() as any;
      const paidAtStr: string | undefined = data.paidAt;
      const dt = parseDate(paidAtStr);
      if (!dt) return;

      if (dt >= thirtyDaysAgo && dt <= now) {
        paymentsLast30Days++;
        paymentsLast30DaysAmount += Number(data.amount ?? 0);
      }
    });
  } catch (err) {
    console.error("[portfolioInsightsService] error reading payments", err);
  }

  // 3) Build fake-AI narrative & insights

  const metrics = {
    totalTenants,
    lowRiskTenants,
    mediumRiskTenants,
    highRiskTenants,
    totalMonthlyRent,
    totalOutstandingBalance,
    paymentsLast30Days,
    paymentsLast30DaysAmount,
  };

  const insights: PortfolioAiInsight[] = [];

  // Cashflow / collections insight
  insights.push({
    id: "collections-overview",
    title: "Collections health snapshot",
    severity:
      totalOutstandingBalance > totalMonthlyRent * 0.75
        ? "critical"
        : totalOutstandingBalance > totalMonthlyRent * 0.3
        ? "warning"
        : "info",
    detail:
      totalOutstandingBalance === 0
        ? "No outstanding tenant balances are currently recorded. Portfolio collections appear fully up to date in the system."
        : `Total recorded outstanding balance is $${totalOutstandingBalance.toFixed(
            2
          )}, compared to a monthly rent roll of $${totalMonthlyRent.toFixed(
            2
          )}. This suggests that ${(
            (totalOutstandingBalance / (totalMonthlyRent || 1)) *
            100
          ).toFixed(
            1
          )}% of one month's rent is currently in arrears. Monitor tenants with running balances and consider consistent late-fee and reminder policies.`,
    category: "collections",
  });

  // Risk mix insight
  insights.push({
    id: "risk-mix",
    title: "Risk distribution across tenants",
    severity: highRiskTenants > 0 ? "warning" : "info",
    detail:
      totalTenants === 0
        ? "No tenants are loaded yet. Once tenants are added, RentChain will summarize risk levels across your portfolio."
        : `Out of ${totalTenants} tenants, ${lowRiskTenants} are tagged as low risk, ${mediumRiskTenants} as medium risk, and ${highRiskTenants} as high risk. Focus attention on the high-risk group and verify whether their payment plans and communication are up to date.`,
    category: "risk",
  });

  // Payment velocity insight
  insights.push({
    id: "payment-velocity",
    title: "Recent payment activity",
    severity:
      paymentsLast30Days === 0
        ? "warning"
        : paymentsLast30DaysAmount >= totalMonthlyRent
        ? "info"
        : "warning",
    detail:
      paymentsLast30Days === 0
        ? "No rent payments have been recorded in the last 30 days. Confirm whether this is expected (e.g., new system, seasonal gap) or whether some payments are being missed in the ledger."
        : `In the last 30 days, ${paymentsLast30Days} payments were recorded, totaling $${paymentsLast30DaysAmount.toFixed(
            2
          )}. Compare this to your expected monthly rent roll of $${totalMonthlyRent.toFixed(
            2
          )} to decide whether any properties require follow-up.`,
    category: "cashflow",
  });

  // Operational recommendation
  insights.push({
    id: "ops-recommendation",
    title: "Recommended operational focus",
    severity:
      highRiskTenants > 0 || totalOutstandingBalance > totalMonthlyRent * 0.75
        ? "critical"
        : "info",
    detail:
      highRiskTenants > 0 || totalOutstandingBalance > totalMonthlyRent * 0.75
        ? "The combination of higher-risk tenants and elevated outstanding balances suggests it may be time to standardize your reminder cadence, late-fee policies, and repayment plans. Consider using RentChain to flag tenants that need proactive outreach each month."
        : "Portfolio risk and balances currently look manageable. This may be a good time to review lease renewals, upcoming expiries, or value-add improvements rather than collections triage.",
    category: "operations",
  });

  // High-level summary string
  const summaryParts: string[] = [];

  if (totalTenants === 0) {
    summaryParts.push(
      "No tenants are loaded yet. Once your first property and tenant records are added, this panel will summarize risk, cashflow, and collection health for the entire portfolio."
    );
  } else {
    summaryParts.push(
      `You currently have ${totalTenants} active tenants with an estimated monthly rent roll of $${totalMonthlyRent.toFixed(
        2
      )}.`
    );

    if (totalOutstandingBalance === 0) {
      summaryParts.push("No outstanding balances are recorded at this time.");
    } else {
      summaryParts.push(
        `Recorded outstanding balances total $${totalOutstandingBalance.toFixed(
          2
        )}.`
      );
    }

    if (paymentsLast30Days > 0) {
      summaryParts.push(
        `${paymentsLast30Days} payments have been logged in the last 30 days, totaling $${paymentsLast30DaysAmount.toFixed(
          2
        )}.`
      );
    } else {
      summaryParts.push(
        "No payments have been logged in the last 30 days, which may indicate either a new system setup or missing entries."
      );
    }
  }

  const response: PortfolioAiInsightsResponse = {
    generatedAt: new Date().toISOString(),
    summary: summaryParts.join(" "),
    metrics,
    insights,
  };

  return response;
}
