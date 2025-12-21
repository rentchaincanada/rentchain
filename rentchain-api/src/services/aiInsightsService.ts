// src/services/aiInsightsService.ts

export type AiSeverity = "info" | "warning" | "critical";

export interface AiInsight {
  id: string;
  title: string;
  severity: AiSeverity;
  body: string;
  tags?: string[];
}

export interface DashboardAiInsightsResponse {
  summary: string;
  insights: AiInsight[];
  generatedAt: string;
}

export interface TenantAiInsightsResponse {
  tenantId: string;
  summary: string;
  insights: AiInsight[];
  generatedAt: string;
}

/**
 * Very simple ID helper so we don't need any extra deps.
 */
function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/**
 * Portfolio-level "AI" – for now, rule-based / static text.
 * Later we plug in real LLM calls and live data.
 */
export async function getDashboardAiInsights(): Promise<DashboardAiInsightsResponse> {
  const now = new Date().toISOString();

  const insights: AiInsight[] = [
    {
      id: makeId("dash"),
      title: "Collections look stable",
      severity: "info",
      body:
        "Recent payments are flowing through the API and auto-ledger. " +
        "You can now rely on the system as a single source of truth for tenant payments and balances.",
      tags: ["collections", "stability"],
    },
    {
      id: makeId("dash"),
      title: "Watch partially paid tenants",
      severity: "warning",
      body:
        "At least one tenant shows a partial payment pattern. " +
        "In a future version, RentChain can automatically flag these and nudge follow-ups.",
      tags: ["risk", "partial-payments"],
    },
    {
      id: makeId("dash"),
      title: "Ledger engine is live",
      severity: "info",
      body:
        "Every recorded payment can now emit a ledger event. " +
        "This is the foundation for credit reporting, AI risk scoring, and on-chain proofs.",
      tags: ["ledger", "foundation"],
    },
  ];

  return {
    summary:
      "Portfolio looks generally stable with emerging signals around partial payments and late fees.",
    insights,
    generatedAt: now,
  };
}

/**
 * Tenant-level "AI" – for now it's just a friendly rules-based message.
 * Later we'll read the real tenant ledger & payments and summarize.
 */
export async function getTenantAiInsights(
  tenantId: string
): Promise<TenantAiInsightsResponse> {
  const now = new Date().toISOString();

  // Super simple logic for now. We make t1 feel a bit more 'real'.
  const isDemoTenant = tenantId === "t1";

  const baseInsights: AiInsight[] = [];

  if (isDemoTenant) {
    baseInsights.push(
      {
        id: makeId("tenant"),
        title: "Partial payment behaviour",
        severity: "warning",
        body:
          "This tenant recently made a partial payment against the current month’s rent. " +
          "Monitor follow-up payments and consider a gentle reminder about the remaining balance.",
        tags: ["partial-payment", "collections"],
      },
      {
        id: makeId("tenant"),
        title: "Late fee recently applied",
        severity: "info",
        body:
          "A late fee was recently added to the ledger. " +
          "Track how quickly the tenant clears this to understand future credit risk.",
        tags: ["late-fee", "risk"],
      },
      {
        id: makeId("tenant"),
        title: "Good candidate for soft-credit reporting",
        severity: "info",
        body:
          "Because payments are now tracked in RentChain, this tenant could be included in " +
          "future credit-reporting programs once your on-chain / bureau integrations are enabled.",
        tags: ["credit-reporting", "on-chain"],
      }
    );
  } else {
    baseInsights.push(
      {
        id: makeId("tenant"),
        title: "Payment history not yet analyzed",
        severity: "info",
        body:
          "AI insights are enabled, but this tenant doesn’t have enough structured ledger history yet. " +
          "As more payments and charges are recorded, RentChain will generate richer risk and behaviour insights.",
        tags: ["insufficient-data"],
      },
      {
        id: makeId("tenant"),
        title: "Use this tenant as a test case",
        severity: "info",
        body:
          "Try recording a few charges and payments for this tenant. " +
          "Future versions will automatically summarize patterns like consistency, lateness, and partial pays.",
        tags: ["testing", "onboarding"],
      }
    );
  }

  return {
    tenantId,
    summary:
      isDemoTenant
        ? "This tenant is showing early warning signs around partial payments and late fees."
        : "AI is ready for this tenant once more ledger history is available.",
    insights: baseInsights,
    generatedAt: now,
  };
}
