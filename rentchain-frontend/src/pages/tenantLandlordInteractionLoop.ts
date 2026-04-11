import type { SharePackageCategoryKey, SharePackageCategoryView } from "./sharePackageAlignment";

export type TenantLandlordInteractionLoopState =
  | "ready_for_review"
  | "follow_up_needed"
  | "ready_for_rereview";

export type TenantLandlordInteractionLoopAudience = "tenant" | "landlord";

export type TenantLandlordInteractionLoopAction = {
  label: string;
  path: string;
  detail: string;
  categories: string[];
};

export type TenantLandlordInteractionLoopView = {
  state: TenantLandlordInteractionLoopState;
  headline: string;
  detail: string;
  followUpCategories: string[];
  readyCategories: string[];
  nextSteps: string[];
  actions: TenantLandlordInteractionLoopAction[];
};

const CATEGORY_ACTIONS: Record<
  SharePackageCategoryKey,
  { label: string; path: string; detail: string }
> = {
  profile_details: {
    label: "Update your profile",
    path: "/tenant/profile",
    detail: "Review your saved profile details and fill in anything still missing.",
  },
  rental_history: {
    label: "Update your profile",
    path: "/tenant/profile",
    detail: "Review your rental history details so the shared package stays consistent.",
  },
  documents_records: {
    label: "Add missing documents",
    path: "/tenant/attachments",
    detail: "Add or organize the documents and records that still need attention.",
  },
  consent_identity_status: {
    label: "Review access",
    path: "/tenant/access",
    detail: "Check your access and identity-related status before the next review.",
  },
  application_readiness: {
    label: "Review your application",
    path: "/tenant/application",
    detail: "Return to your application readiness view and confirm the package is ready to continue.",
  },
};

function buildHeadline(
  audience: TenantLandlordInteractionLoopAudience,
  state: TenantLandlordInteractionLoopState
): string {
  if (audience === "landlord") {
    if (state === "ready_for_review") return "Ready to review";
    if (state === "ready_for_rereview") return "Ready for re-review";
    return "Follow-up needed";
  }

  if (state === "ready_for_review") return "Ready to continue";
  if (state === "ready_for_rereview") return "Ready for re-review";
  return "Follow-up requested";
}

function buildDetail(
  audience: TenantLandlordInteractionLoopAudience,
  state: TenantLandlordInteractionLoopState,
  followUpCategories: string[]
): string {
  if (audience === "landlord") {
    if (state === "ready_for_review") {
      return "The aligned package categories are organized enough to review now using the information currently available.";
    }
    if (state === "ready_for_rereview") {
      return "Most package categories are in place, with only a few partly available sections left to confirm before final review.";
    }
    return `Follow-up is still needed in ${followUpCategories.join(", ")} before this package feels complete.`;
  }

  if (state === "ready_for_review") {
    return "Your current package categories look organized enough to continue with review from your saved profile.";
  }
  if (state === "ready_for_rereview") {
    return "You have enough in place to return for re-review, with only a few sections still needing a final pass.";
  }
  return `A few package categories still need attention before this application feels ready to share again: ${followUpCategories.join(", ")}.`;
}

export function buildTenantLandlordInteractionLoop(params: {
  audience: TenantLandlordInteractionLoopAudience;
  packageCategories: SharePackageCategoryView[];
}): TenantLandlordInteractionLoopView {
  const followUpItems = params.packageCategories.filter((item) => item.status !== "ready");
  const missingItems = followUpItems.filter((item) => item.status === "missing");
  const readyCategories = params.packageCategories
    .filter((item) => item.status === "ready")
    .map((item) => item.label);
  const followUpCategories = followUpItems.map((item) => item.label);

  let state: TenantLandlordInteractionLoopState = "ready_for_review";
  if (followUpItems.length > 0) {
    state = missingItems.length > 0 ? "follow_up_needed" : "ready_for_rereview";
  }

  const nextSteps: string[] = [];
  if (params.audience === "landlord") {
    if (readyCategories.length > 0) {
      nextSteps.push("Review the categories already available now so the current package can move forward without guesswork.");
    }
    if (followUpCategories.length > 0) {
      nextSteps.push(`Request follow-up in ${followUpCategories.join(", ")} using the aligned package categories.`);
      nextSteps.push("Re-review the package after those categories are updated in the tenant workflow.");
    }
    if (nextSteps.length === 0) {
      nextSteps.push("Review the available package and capture your decision in the summary when you are ready.");
    }
  } else {
    if (followUpCategories.length > 0) {
      nextSteps.push(`Work through ${followUpCategories.join(", ")} next so your package is easier to re-review.`);
    }
    if (readyCategories.length > 0) {
      nextSteps.push("Keep the categories that are already ready as they are while you update the remaining sections.");
    }
    if (nextSteps.length === 0) {
      nextSteps.push("Continue with your application and review what is already ready to share.");
    }
  }

  const actionsMap = new Map<string, TenantLandlordInteractionLoopAction>();
  if (params.audience === "tenant") {
    followUpItems.forEach((item) => {
      const config = CATEGORY_ACTIONS[item.key];
      const existing = actionsMap.get(config.path);
      if (existing) {
        existing.categories.push(item.label);
        return;
      }
      actionsMap.set(config.path, {
        label: config.label,
        path: config.path,
        detail: config.detail,
        categories: [item.label],
      });
    });
    if (!actionsMap.has("/tenant/application")) {
      actionsMap.set("/tenant/application", {
        label: "Review your application",
        path: "/tenant/application",
        detail: "Return to your application readiness view before continuing.",
        categories: ["Application readiness"],
      });
    }
  }

  return {
    state,
    headline: buildHeadline(params.audience, state),
    detail: buildDetail(params.audience, state, followUpCategories),
    followUpCategories,
    readyCategories,
    nextSteps,
    actions: Array.from(actionsMap.values()),
  };
}
