import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type SubscriptionPlan = "starter" | "core" | "pro" | "elite";

type SubscriptionFeatures = {
  plan: SubscriptionPlan;

  // Core functional areas
  hasTenants: boolean;
  hasProperties: boolean;
  hasApplications: boolean;

  // Advanced features
  hasTenantAI: boolean;
  hasPropertyAI: boolean;
  hasPortfolioAI: boolean;
  hasOnChainRelay: boolean;
  hasTenantReports: boolean;
};

type SubscriptionContextValue = {
  plan: SubscriptionPlan;
  features: SubscriptionFeatures;
  setPlan: (plan: SubscriptionPlan) => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null
);

function computeFeatures(plan: SubscriptionPlan): SubscriptionFeatures {
  const planRank: Record<SubscriptionPlan, number> = {
    starter: 0,
    core: 1,
    pro: 2,
    elite: 3,
  };

  const rank = planRank[plan];
  const atLeast = (min: SubscriptionPlan) => rank >= planRank[min];

  return {
    plan,

    hasTenants: true,
    hasProperties: atLeast("core"),
    hasApplications: atLeast("core"),

    hasTenantAI: atLeast("pro"),
    hasPropertyAI: atLeast("pro"),
    hasPortfolioAI: atLeast("pro"),
    hasOnChainRelay: atLeast("elite"),
    hasTenantReports: atLeast("starter"),
  };
}

export const SubscriptionProvider: React.FC<{
  initialPlan?: SubscriptionPlan;
  children: ReactNode;
}> = ({ initialPlan = "pro", children }) => {
  const [plan, setPlan] = useState<SubscriptionPlan>(initialPlan);

  const features = useMemo(() => computeFeatures(plan), [plan]);

  const value: SubscriptionContextValue = useMemo(
    () => ({
      plan,
      features,
      setPlan,
    }),
    [plan, features]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }
  return ctx;
}
