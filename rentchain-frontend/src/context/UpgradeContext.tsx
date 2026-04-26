import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { UpgradeModal, type UpgradeReason } from "../components/billing/UpgradeModal";
import { UpgradePromptModal } from "../components/billing/UpgradePromptModal";
import { normalizePlanName, resolveRequiredPlan } from "../lib/upgradePrompt";
import { getCachedCapabilities } from "../lib/entitlements";
import { isPlanAtLeast, normalizePlan } from "../lib/plan";
import { useAuth } from "./AuthContext";
import { track } from "@/lib/analytics";

type UpgradeContextValue = {
  openUpgrade: (
    reason:
      | UpgradeReason
      | {
          reason: UpgradeReason;
          copy?: { title?: string; body?: string };
          plan?: string;
          ctaLabel?: string;
        }
  ) => void;
  clearUpgradePrompt: () => void;
};

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const { user, ready, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<UpgradeReason>("propertiesMax");
  const [copy, setCopy] = useState<{ title?: string; body?: string } | undefined>(undefined);
  const [plan, setPlan] = useState<string>("free");
  const [ctaLabel, setCtaLabel] = useState<string | undefined>(undefined);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptFeatureKey, setPromptFeatureKey] = useState<string>("screening");
  const [promptCurrentPlan, setPromptCurrentPlan] = useState<string | undefined>(undefined);
  const [promptRequiredPlan, setPromptRequiredPlan] = useState<string | undefined>(undefined);
  const [promptSource, setPromptSource] = useState<string | undefined>(undefined);
  const [promptRedirectTo, setPromptRedirectTo] = useState<string | undefined>(undefined);

  const openUpgrade = useCallback<UpgradeContextValue["openUpgrade"]>((r) => {
    if (typeof r === "string") {
      setReason(r);
      setCopy(undefined);
      setCtaLabel(undefined);
      setPlan(normalizePlan(user?.plan || "free"));
    } else {
      setReason(r.reason);
      setCopy(r.copy);
      setPlan(normalizePlan(r.plan || user?.plan || "free"));
      setCtaLabel(r.ctaLabel);
    }
    setOpen(true);
  }, [user?.plan]);

  const closeUpgradeModal = useCallback(() => {
    setOpen(false);
  }, []);

  const closePromptModal = useCallback(() => {
    setPromptOpen(false);
  }, []);

  const clearUpgradePrompt = useCallback(() => {
    setPromptOpen(false);
    setPromptFeatureKey("screening");
    setPromptCurrentPlan(undefined);
    setPromptRequiredPlan(undefined);
    setPromptSource(undefined);
    setPromptRedirectTo(undefined);
  }, []);

  const handleUpgradeEvent = useCallback((evt: Event) => {
    if (!ready || isLoading || !user?.id) return;
    const roleLower = String(user?.actorRole || user?.role || "").toLowerCase();
    if (roleLower === "admin") return;
    const detail = (evt as CustomEvent<any>).detail || {};
    const featureKey = String(detail.featureKey || detail.limitType || detail.capability || "").trim();
    if (!featureKey) return;
    const cachedPlan = getCachedCapabilities()?.plan;
    const currentPlan = normalizePlan(detail.currentPlan || detail.plan || cachedPlan || user?.plan || "free");
    const requiredPlan = normalizePlanName(detail.requiredPlan) || resolveRequiredPlan(featureKey, currentPlan);
    if (requiredPlan === "free") return;
    if (!requiredPlan) return;
    if (isPlanAtLeast(currentPlan, normalizePlan(requiredPlan))) return;
    const now = Date.now();
    if (typeof window !== "undefined") {
      const userKey = user?.id ? `upgradePromptLastShown:${user.id}` : "upgradePromptLastShown:anon";
      const lastShown = Number(localStorage.getItem(userKey) || "0");
      if (lastShown && now - lastShown < 3600_000) {
        return;
      }
      localStorage.setItem(userKey, String(now));
    }
    const source = detail.source || "unknown";
    const fallbackRedirect =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/dashboard";
    const redirectTo = detail.redirectTo || fallbackRedirect;
    track("upgrade_prompt_viewed", {
      featureKey,
      currentPlan,
      requiredPlan,
      source,
      presentation: "modal",
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    setPromptFeatureKey(featureKey);
    setPromptCurrentPlan(currentPlan);
    setPromptRequiredPlan(requiredPlan);
    setPromptSource(source);
    setPromptRedirectTo(redirectTo);
    setPromptOpen(true);
  }, [user?.id, user?.role, user?.actorRole, user?.plan, ready, isLoading]);

  const ctxValue = useMemo(
    () => ({ openUpgrade, clearUpgradePrompt }),
    [openUpgrade, clearUpgradePrompt]
  );

  useEffect(() => {
    window.addEventListener("upgrade:prompt", handleUpgradeEvent as EventListener);
    window.addEventListener("upgrade:plan-limit", handleUpgradeEvent as EventListener);
    return () => {
      window.removeEventListener("upgrade:prompt", handleUpgradeEvent as EventListener);
      window.removeEventListener("upgrade:plan-limit", handleUpgradeEvent as EventListener);
    };
  }, [handleUpgradeEvent]);

  return (
    <UpgradeContext.Provider value={ctxValue}>
      <>
        {children}
        <UpgradeModal
          open={open}
          reason={reason}
          copy={copy}
          currentPlan={plan}
          ctaLabel={ctaLabel}
          onClose={closeUpgradeModal}
        />
        <UpgradePromptModal
          open={promptOpen}
          featureKey={promptFeatureKey}
          currentPlan={promptCurrentPlan}
          requiredPlan={promptRequiredPlan}
          source={promptSource}
          redirectTo={promptRedirectTo}
          onClose={closePromptModal}
        />
      </>
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error("useUpgrade must be used within UpgradeProvider");
  return ctx;
}
