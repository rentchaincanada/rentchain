import { useEffect, useMemo, useState } from "react";
import { fetchSubscriptionStatus } from "@/api/billingApi";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useAuth } from "@/context/useAuth";

type PlanTier = "free" | "starter" | "pro" | "elite";
type BillingInterval = "month" | "year" | null;

type BillingStatus = {
  tier: PlanTier;
  interval: BillingInterval;
  renewalDate: string | null;
  isLoading: boolean;
};

type SubscriptionDetail = {
  interval: BillingInterval;
  renewalDate: string | null;
};

const DEFAULT_STATUS: BillingStatus = {
  tier: "free",
  interval: null,
  renewalDate: null,
  isLoading: true,
};

const planFromString = (raw?: string | null): PlanTier | null => {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "pro" || value === "professional") return "pro";
  if (value === "elite" || value === "business" || value === "enterprise") return "elite";
  if (value === "starter" || value === "core") return "starter";
  if (value === "screening" || value === "free") return "free";
  return null;
};

const intervalFromString = (raw?: string | null): BillingInterval => {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "month" || value === "monthly") return "month";
  if (value === "year" || value === "yearly" || value === "annual") return "year";
  return null;
};

const parseDate = (value: unknown): string | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

export function useBillingStatus(): BillingStatus {
  const { caps, loading: capsLoading } = useCapabilities();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionDetail>({
    interval: null,
    renewalDate: null,
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchSubscriptionStatus()
      .then((raw: any) => {
        if (!active) return;
        const interval = intervalFromString(
          raw?.interval || raw?.billingInterval || raw?.period || null
        );
        const renewalDate = parseDate(
          raw?.renewalDate || raw?.currentPeriodEnd || raw?.nextBillingAt || null
        );
        setSubscription({ interval, renewalDate });
      })
      .catch(() => {
        if (!active) return;
        setSubscription({ interval: null, renewalDate: null });
      })
      .finally(() => {
        if (active) setSubscriptionLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const roleLower = String(user?.actorRole || user?.role || "").trim().toLowerCase();
    if (roleLower === "admin") {
      return {
        tier: "elite" as PlanTier,
        interval: subscription.interval,
        renewalDate: subscription.renewalDate,
        isLoading: capsLoading || subscriptionLoading,
      };
    }

    const tier =
      planFromString(caps?.plan) ||
      planFromString(user?.plan) ||
      planFromString((user as any)?.subscriptionPlan) ||
      "free";

    return {
      tier,
      interval: subscription.interval,
      renewalDate: subscription.renewalDate,
      isLoading: capsLoading || subscriptionLoading,
    };
  }, [
    caps?.plan,
    capsLoading,
    subscription.interval,
    subscription.renewalDate,
    subscriptionLoading,
    user?.plan,
    user?.role,
    user?.actorRole,
  ]);
}

export function billingTierLabel(tier?: string | null): string {
  const normalized = planFromString(tier) || "free";
  if (normalized === "free") return "Free";
  if (normalized === "starter") return "Starter";
  if (normalized === "pro") return "Pro";
  return "Elite";
}
