import { apiFetch } from "@/lib/apiClient";

export type StartCheckoutArgs = {
  tier?: "starter" | "pro" | "business";
  interval?: "monthly" | "yearly" | "month" | "year";
  requiredPlan?: string;
  featureKey: string;
  source?: string;
  redirectTo?: string;
};

function normalizeTier(input?: string): "starter" | "pro" | "business" | "free" | null {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "free" || raw === "screening") return "free";
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "business" || raw === "elite" || raw === "enterprise") return "business";
  return null;
}

function normalizeInterval(input?: string): "monthly" | "yearly" {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "year" || raw === "yearly" || raw === "annual" || raw === "annually") return "yearly";
  if (raw === "month" || raw === "monthly") return "monthly";
  return "monthly";
}

function sanitizeRedirectTo(raw: string) {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.includes("://")) return fallback;
  return raw;
}

function showCheckoutError(message: string) {
  if (typeof window === "undefined") {
    console.error(message);
    return;
  }
  const toast = (window as any)?.toast;
  if (toast && typeof toast.error === "function") {
    toast.error(message);
    return;
  }
  window.alert(message);
}

export async function startCheckout({
  tier,
  interval,
  requiredPlan,
  featureKey,
  source,
  redirectTo,
}: StartCheckoutArgs) {
  const resolvedTier =
    normalizeTier(tier) || normalizeTier(requiredPlan) || "pro";
  if (resolvedTier === "free") {
    showCheckoutError("No upgrade required for this feature.");
    return;
  }
  const resolvedInterval = normalizeInterval(interval);
  const safeSource = String(source || "unknown").trim() || "unknown";
  const safeFeature = String(featureKey || "unknown").trim() || "unknown";
  const fallbackRedirect =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/dashboard";
  const safeRedirectTo = sanitizeRedirectTo(redirectTo || fallbackRedirect);

  try {
    const res: any = await apiFetch("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        tier: resolvedTier,
        interval: resolvedInterval,
        featureKey: safeFeature,
        source: safeSource,
        redirectTo: safeRedirectTo,
      }),
    });
    const url = res?.url || res?.checkoutUrl;
    if (url && typeof window !== "undefined") {
      window.location.assign(url);
      return;
    }
    showCheckoutError("Unable to start checkout. Please try again.");
  } catch (err: any) {
    showCheckoutError(err?.message || "Unable to start checkout. Please try again.");
  }
}
