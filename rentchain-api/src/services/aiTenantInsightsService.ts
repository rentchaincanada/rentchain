// src/services/aiTenantInsightsService.ts
import {
  TenantRecord,
  TenantPaymentDto,
  TenantLedgerEventDto,
} from "./tenantDetailsService";

export type TenantRiskLevel = "Low" | "Medium" | "High";

export interface TenantAiInsight {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  detail: string;
  category?: "risk" | "payments" | "behavior" | "recommendation";
}

/**
 * Fake AI engine for dev mode.
 * Later we can swap internals to call a real LLM without changing the rest of the app.
 */
export async function generateFakeTenantInsights(
  tenant: TenantRecord | null,
  payments: TenantPaymentDto[],
  ledger: TenantLedgerEventDto[]
): Promise<TenantAiInsight[]> {
  const insights: TenantAiInsight[] = [];

  if (!tenant) {
    return [
      {
        id: "no-tenant",
        title: "No tenant selected",
        severity: "info",
        detail: "Select a tenant to see AI-generated insights about their payment behaviour and risk.",
        category: "behavior",
      },
    ];
  }

  const monthlyRent = tenant.monthlyRent ?? 0;
  const balance = tenant.balance ?? 0;
  const numPayments = payments.length;

  // --- Determine a simple risk level ---
  let riskLevel: TenantRiskLevel = "Low";
  let score = 82; // out of 100

  if (balance > 0) {
    riskLevel = "Medium";
    score = 68;
    if (monthlyRent && balance > monthlyRent) {
      riskLevel = "High";
      score = 54;
    }
  } else if (numPayments === 0) {
    riskLevel = "Medium";
    score = 60;
  }

  // Risk summary
  insights.push({
    id: "risk-summary",
    title: `Risk level: ${riskLevel}`,
    severity: riskLevel === "High" ? "critical" : riskLevel === "Medium" ? "warning" : "info",
    detail:
      riskLevel === "High"
        ? "Outstanding balance is higher than a typical month’s rent. This tenant may require closer monitoring and proactive communication."
        : riskLevel === "Medium"
        ? "Either there is limited payment history or a small running balance. Continue monitoring but no urgent action is required."
        : "This tenant currently presents a low risk based on payment history and outstanding balance.",
    category: "risk",
  });

  // Payment behaviour insight
  if (numPayments === 0) {
    insights.push({
      id: "payment-history-none",
      title: "Limited payment history",
      severity: "warning",
      detail:
        "No rent payments have been recorded in this system yet. AI will provide stronger behavioural insights once a few months of payments exist.",
      category: "payments",
    });
  } else {
    const lastPayment = payments[0];
    insights.push({
      id: "payment-history-basic",
      title: "Payment pattern detected",
      severity: balance > 0 ? "warning" : "info",
      detail:
        balance > 0
          ? `Recent payments are being recorded, but the tenant still shows an outstanding balance of $${balance.toFixed(
              2
            )}. Consider confirming whether a repayment plan or catch-up schedule is needed.`
          : `Payments appear to be recorded regularly. The most recent payment was on ${lastPayment.paidAt} for $${lastPayment.amount.toFixed(
              2
            )}.`,
      category: "payments",
    });
  }

  // Ledger behaviour insight
  if (ledger.length > 0) {
    const numEvents = ledger.length;
    const numCharges = ledger.filter((e) => e.amount > 0).length;
    const numCredits = ledger.filter((e) => e.amount < 0).length;

    insights.push({
      id: "ledger-activity",
      title: "Ledger activity overview",
      severity: "info",
      detail: `There are ${numEvents} ledger events recorded for this tenant (${numCharges} charges and ${numCredits} credits/adjustments). This history can be used to support future decisions or discussions.`,
      category: "behavior",
    });
  }

  // Recommendation insight
  if (riskLevel === "High") {
    insights.push({
      id: "recommendation-high",
      title: "Recommended next step",
      severity: "critical",
      detail:
        "Schedule a check-in with the tenant and review a simple payment plan. Consider sending automated reminders 3–5 days before the next due date until the balance is reduced.",
      category: "recommendation",
    });
  } else if (riskLevel === "Medium") {
    insights.push({
      id: "recommendation-medium",
      title: "Recommended next step",
      severity: "warning",
      detail:
        "Monitor payments over the next 1–2 months. If more late or partial payments appear, consider applying late fees consistently and sending earlier reminders.",
      category: "recommendation",
    });
  } else {
    insights.push({
      id: "recommendation-low",
      title: "Recommended next step",
      severity: "info",
      detail:
        "This tenant appears stable. You could consider rewarding on-time payment streaks with small gestures (e.g., a thank-you note or minor upgrade) to encourage long-term retention.",
      category: "recommendation",
    });
  }

  // Decorative: overall summary item
  insights.push({
    id: "overall-score",
    title: "AI score (dev mode)",
    severity: "info",
    detail: `Development-mode AI estimates an overall stability score of ${score}/100 based on balance, payment count, and ledger activity. In production, this will be replaced by a real model.`,
    category: "risk",
  });

  return insights;
}
