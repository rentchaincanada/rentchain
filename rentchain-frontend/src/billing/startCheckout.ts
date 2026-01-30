import { apiFetch } from "@/lib/apiClient";

export type StartCheckoutArgs = {
  requiredPlan?: string;
  featureKey: string;
  source?: string;
  redirectTo?: string;
};

function normalizePlanKey(plan?: string): "starter" | "pro" | "elite" | null {
  const raw = String(plan || "").trim().toLowerCase();
  if (!raw || raw === "free" || raw === "screening") return "starter";
  if (raw === "starter" || raw === "core") return "starter";
  if (raw === "pro") return "pro";
  if (raw === "business" || raw === "elite" || raw === "enterprise") return "elite";
  return null;
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
  requiredPlan,
  featureKey,
  source,
  redirectTo,
}: StartCheckoutArgs) {
  const planKey = normalizePlanKey(requiredPlan) || "starter";
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
        plan: planKey,
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
