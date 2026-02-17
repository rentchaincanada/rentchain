import { createBillingPortalSession } from "@/api/billingApi";

export async function openUpgradeFlow(params: {
  navigate: (to: string) => void;
  fallbackPath?: string;
}): Promise<boolean> {
  const { navigate, fallbackPath = "/pricing" } = params;
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
