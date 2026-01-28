import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { fetchMe } from "../api/meApi";

export type SubscriptionPlan = "screening" | "starter" | "core" | "pro" | "elite";

type SubscriptionFeatures = {
  plan: SubscriptionPlan;
  caps: {
    properties: number;
    units: number;
  };
  can: {
    addProperty: boolean;
    addUnits: (unitsToAdd: number) => boolean;
  };

  // Advanced features
  hasTenants: boolean;
  hasProperties: boolean;
  hasApplications: boolean;
  hasTenantAI: boolean;
  hasPropertyAI: boolean;
  hasPortfolioAI: boolean;
  hasOnChainRelay: boolean;
  hasTenantReports: boolean;
};

type SubscriptionContextValue = {
  plan: SubscriptionPlan;
  features: SubscriptionFeatures;
  loading: boolean;
  setPlan: (plan: SubscriptionPlan) => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null
);

function computeFeatures(plan: SubscriptionPlan): SubscriptionFeatures {
  const capsByPlan: Record<
    SubscriptionPlan,
    { properties: number; units: number }
  > = {
    screening: { properties: Infinity, units: Infinity },
    starter: { properties: Infinity, units: Infinity },
    core: { properties: Infinity, units: Infinity },
    pro: { properties: Infinity, units: Infinity },
    elite: { properties: Infinity, units: Infinity },
  };

  const caps = capsByPlan[plan] || capsByPlan.starter;
  const planRank: Record<SubscriptionPlan, number> = {
    screening: 0,
    starter: 1,
    core: 1,
    pro: 2,
    elite: 3,
  };
  const atLeast = (min: SubscriptionPlan) => planRank[plan] >= planRank[min];

  return {
    plan,
    caps,
    can: {
      addProperty: true, // allow opening; enforcement happens on submit
      addUnits: (unitsToAdd: number) =>
        Number.isFinite(caps.units)
          ? unitsToAdd <= caps.units
          : true,
    },

    hasTenants: true,
    hasProperties: true,
    hasApplications: true,
    hasTenantAI: atLeast("pro"),
    hasPropertyAI: atLeast("pro"),
    hasPortfolioAI: atLeast("pro"),
    hasOnChainRelay: atLeast("elite"),
    hasTenantReports: atLeast("starter"),
  };
}

export function SubscriptionProvider({
  children,
  initialPlan = "screening",
}: {
  children: ReactNode;
  initialPlan?: SubscriptionPlan;
}) {
  const [plan, setPlan] = useState<SubscriptionPlan>(initialPlan);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then((me) => {
        const p = me?.plan;
        if (p === "screening" || p === "starter" || p === "core" || p === "pro" || p === "elite") {
          setPlan(p);
          return;
        }

        if (me?.role === "landlord") {
          setPlan("screening");
        }
      })
      .catch(() => {
        // ignore fetch errors; keep current plan
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const features = useMemo(() => computeFeatures(plan), [plan]);

  return (
    <SubscriptionContext.Provider value={{ plan, features, loading, setPlan }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }
  return ctx;
}
