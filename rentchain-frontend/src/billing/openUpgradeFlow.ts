import { createBillingPortalSession } from "@/api/billingApi";
import { normalizePlan } from "@/lib/plan";

export async function openUpgradeFlow(params: {
  navigate: (to: string) => void;
  fallbackPath?: string;
  currentPlan?: string | null;
}): Promise<boolean> {
  const { navigate, fallbackPath = "/pricing", currentPlan } = params;
  const normalizedPlan = normalizePlan(currentPlan || "free", "free");

  if (normalizedPlan === "free") {
    navigate(fallbackPath);
    return false;
  }

  try {
    const session = await createBillingPortalSession();
    if (session?.url && typeof window !== "undefined") {
      window.open(session.url, "_blank", "noopener,noreferrer");
      navigate("/billing?upgradeStarted=1");
      return true;
    }
  } catch {
    // fall through to pricing
  }
  navigate(fallbackPath);
  return false;
}
