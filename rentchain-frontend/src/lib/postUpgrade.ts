import { planLabel, type PaidPlan } from "@/lib/plan";

const POST_UPGRADE_STATE_KEY = "rentchain.postUpgrade";

export type PostUpgradeState = {
  plan: PaidPlan;
  ts: number;
};

export type PostUpgradeAction = {
  label: string;
  to: string;
};

export type PostUpgradeContent = {
  title: string;
  benefitSummary: string;
  unlockedFeatures: string[];
  dashboardBanner: string;
  primaryAction: PostUpgradeAction;
  secondaryAction: PostUpgradeAction;
};

export function getPostUpgradeContent(plan: PaidPlan): PostUpgradeContent {
  if (plan === "starter") {
    return {
      title: `You're now on ${planLabel(plan)}`,
      benefitSummary: "You can now invite tenants and send secure application links from RentChain.",
      unlockedFeatures: ["Tenant invites", "Application links", "Stronger workflow handoff"],
      dashboardBanner: "You're now on Starter — tenant invites and application links are unlocked.",
      primaryAction: {
        label: "Send your first application",
        to: "/applications?openSendApplication=1&autoSelectProperty=1&upgradeConfirmed=1&highlight=applications",
      },
      secondaryAction: {
        label: "Invite a tenant",
        to: "/tenants?invite=1&upgradeConfirmed=1&highlight=tenants",
      },
    };
  }

  if (plan === "pro") {
    return {
      title: `You're now on ${planLabel(plan)}`,
      benefitSummary: "You can now run stronger screening, review, and export workflows with less friction.",
      unlockedFeatures: ["Screening workflow", "Review and history tools", "Export-ready controls"],
      dashboardBanner: "You're now on Pro — screening workflows, exports, and stronger review tools are unlocked.",
      primaryAction: {
        label: "Start screening a tenant",
        to: "/applications?upgradeConfirmed=1&highlight=screening",
      },
      secondaryAction: {
        label: "Invite a tenant",
        to: "/tenants?invite=1&upgradeConfirmed=1&highlight=tenants",
      },
    };
  }

  return {
    title: `You're now on ${planLabel(plan)}`,
    benefitSummary: "You can now review portfolio performance and move into deeper oversight across your workspace.",
    unlockedFeatures: ["Portfolio health", "Portfolio score", "Recommended actions"],
    dashboardBanner: "You're now on Elite — portfolio health and deeper oversight views are unlocked.",
    primaryAction: {
      label: "Review your portfolio performance",
      to: "/portfolio-health?upgradeConfirmed=1&highlight=portfolio",
    },
    secondaryAction: {
      label: "Invite a tenant",
      to: "/tenants?invite=1&upgradeConfirmed=1&highlight=tenants",
    },
  };
}

export function setPostUpgradeState(plan: PaidPlan) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    POST_UPGRADE_STATE_KEY,
    JSON.stringify({
      plan,
      ts: Date.now(),
    } satisfies PostUpgradeState)
  );
}

export function getPostUpgradeState(): PostUpgradeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(POST_UPGRADE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostUpgradeState;
    if (!parsed?.plan || !["starter", "pro", "elite"].includes(parsed.plan)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPostUpgradeState() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(POST_UPGRADE_STATE_KEY);
}
