import { useMemo } from "react";
import { useAuth } from "@/context/useAuth";
import { useCapabilities } from "@/hooks/useCapabilities";
import { normalizePlan } from "@/lib/plan";
import { resolveRequiredPlan } from "@/lib/upgradePrompt";

function hasFeature(features: Record<string, boolean>, keys: string[]) {
  return keys.some((key) => Boolean(features[key]));
}

export function useEntitlements() {
  const { user } = useAuth();
  const { caps, features, loading } = useCapabilities();

  return useMemo(() => {
    const role = String(user?.actorRole || user?.role || "").toLowerCase();
    const isAdmin = role === "admin";
    const featureMap = features || {};
    const plan = normalizePlan(caps?.plan || user?.plan || null);
    const hasPaidScreeningPlan = plan === "starter" || plan === "pro" || plan === "elite";

    const canScreen =
      isAdmin || hasPaidScreeningPlan || hasFeature(featureMap, ["screening", "screening_pay_per_use"]);
    const canViewScreeningHistory =
      isAdmin || hasFeature(featureMap, ["screening_history", "screening", "screening_pay_per_use"]);
    const canExportPdf = isAdmin || hasFeature(featureMap, ["pdf_export", "exports_basic", "tenantPdfReport"]);
    const hasMoveInReadiness = isAdmin || hasFeature(featureMap, ["move_in_readiness", "tenant_invites"]);
    const canUseWorkOrders = isAdmin || hasFeature(featureMap, ["work_orders", "maintenance"]);
    const canViewReviewSummary = isAdmin || hasFeature(featureMap, ["review_summary", "pdf_export", "exports_basic"]);
    const canViewPortfolioHealthSummary = isAdmin || hasFeature(featureMap, ["portfolio_health_summary"]);
    const canViewPortfolioScore = isAdmin || hasFeature(featureMap, [
      "portfolio_score",
      "portfolio_dashboard",
      "portfolio_analytics",
    ]);
    const canViewActionRecommendations = isAdmin || hasFeature(featureMap, [
      "portfolio_action_recommendations",
      "ai_summaries",
      "portfolio_analytics",
    ]);

    return {
      loading,
      plan,
      role,
      isAdmin,
      capabilities: featureMap,
      hasCapability: (key: string) => isAdmin || Boolean(featureMap[key]),
      requiredPlanFor: (key: string) => resolveRequiredPlan(key, plan) || "pro",
      canScreen,
      canViewScreeningHistory,
      canExportPdf,
      hasMoveInReadiness,
      canUseWorkOrders,
      canViewReviewSummary,
      canViewPortfolioHealthSummary,
      canViewPortfolioScore,
      canViewActionRecommendations,
    };
  }, [caps?.plan, features, loading, user?.actorRole, user?.plan, user?.role]);
}

export type UseEntitlementsResult = ReturnType<typeof useEntitlements>;
