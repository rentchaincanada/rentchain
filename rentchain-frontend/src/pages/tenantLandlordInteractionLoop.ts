import type { SharePackageCategoryKey, SharePackageCategoryView } from "./sharePackageAlignment";
import { buildFollowUpResolutionState, type FollowUpResolutionOverallState } from "./followUpResolutionState";

export type TenantLandlordInteractionLoopState = FollowUpResolutionOverallState;

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
    if (state === "ready_for_rereview") return "Ready for re-review";
    if (state === "partly_addressed") return "Partly addressed";
    return "Follow-up needed";
  }

  if (state === "ready_for_rereview") return "Ready for re-review";
  if (state === "partly_addressed") return "Partly addressed";
  return "Follow-up needed";
}

function describeCategoryList(categories: string[]): string {
  return categories.join(", ");
}

function buildLandlordDetail(
  state: TenantLandlordInteractionLoopState,
  followUpCategories: string[],
  addressedCategories: string[]
): string {
  if (state === "ready_for_rereview") {
    return "The follow-up categories surfaced in this authorized package now appear addressed and are ready for re-review.";
  }
  if (state === "partly_addressed") {
    return `Some follow-up appears addressed already (${describeCategoryList(
      addressedCategories
    )}), while ${describeCategoryList(followUpCategories)} still need follow-up.`;
  }
  return `Follow-up is still needed in ${describeCategoryList(
    followUpCategories
  )} before this package is ready for re-review.`;
}

function buildTenantDetail(
  state: TenantLandlordInteractionLoopState,
  followUpCategories: string[],
  addressedCategories: string[]
): string {
  if (state === "ready_for_rereview") {
    return "Your package now appears ready for re-review based on the categories currently available in your tenant-safe workspace.";
  }
  if (state === "partly_addressed") {
    return `You have already addressed ${describeCategoryList(
      addressedCategories
    )}. ${describeCategoryList(followUpCategories)} still need attention before re-review.`;
  }
  return `A few package categories still need attention before this application looks ready for re-review: ${describeCategoryList(
    followUpCategories
  )}.`;
}

function buildDetail(
  audience: TenantLandlordInteractionLoopAudience,
  state: TenantLandlordInteractionLoopState,
  followUpCategories: string[],
  addressedCategories: string[]
): string {
  if (audience === "landlord") {
    return buildLandlordDetail(state, followUpCategories, addressedCategories);
  }

  return buildTenantDetail(state, followUpCategories, addressedCategories);
}

function buildLandlordNextSteps(
  state: TenantLandlordInteractionLoopState,
  followUpCategories: string[],
  addressedCategories: string[]
): string[] {
  if (state === "ready_for_rereview") {
    return [
      "Review again using the categories that now appear addressed in the current authorized package.",
      "Capture any final review decision separately from this follow-up summary.",
    ];
  }

  if (state === "partly_addressed") {
    return [
      `Review the addressed categories now visible in ${describeCategoryList(addressedCategories)}.`,
      `Keep follow-up active for ${describeCategoryList(followUpCategories)} until those categories are updated.`,
    ];
  }

  return [
    `Request follow-up in ${describeCategoryList(followUpCategories)} using the aligned package categories.`,
    "Review the package again after those categories are updated in the tenant workflow.",
  ];
}

function buildTenantNextSteps(
  state: TenantLandlordInteractionLoopState,
  followUpCategories: string[],
  addressedCategories: string[]
): string[] {
  if (state === "ready_for_rereview") {
    return [
      "Review again from your application readiness page when you are ready.",
      "Keep the addressed categories as they are unless something changes.",
    ];
  }

  if (state === "partly_addressed") {
    return [
      `Keep ${describeCategoryList(addressedCategories)} as they are while you finish ${describeCategoryList(
        followUpCategories
      )}.`,
      `Finish the categories that still need attention so your package can be ready for re-review.`,
    ];
  }

  return [
    `Work through ${describeCategoryList(followUpCategories)} next so your package is easier to review again.`,
    "The categories already addressed can stay as they are while you update the remaining sections.",
  ];
}

export function buildTenantLandlordInteractionLoop(params: {
  audience: TenantLandlordInteractionLoopAudience;
  packageCategories: SharePackageCategoryView[];
}): TenantLandlordInteractionLoopView {
  const resolution = buildFollowUpResolutionState(params.packageCategories);
  const followUpItems = resolution.openFollowUpCategories;
  const addressedItems = resolution.addressedCategories;
  const readyCategories = addressedItems.map((item) => item.label);
  const followUpCategories = resolution.remainingCategoriesNeedingAttention;
  const state: TenantLandlordInteractionLoopState = resolution.overallState;

  const nextSteps =
    params.audience === "landlord"
      ? buildLandlordNextSteps(state, followUpCategories, readyCategories)
      : buildTenantNextSteps(state, followUpCategories, readyCategories);

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
    actionsMap.set("/tenant/application", {
      label: state === "ready_for_rereview" ? "Review again" : "Review your application",
      path: "/tenant/application",
      detail:
        state === "ready_for_rereview"
          ? "Return to your application readiness view and confirm the package is ready for re-review."
          : "Return to your application readiness view and confirm the package is ready to continue.",
      categories:
        state === "ready_for_rereview" ? ["Ready for re-review"] : ["Application readiness"],
    });
  }

  return {
    state,
    headline: buildHeadline(params.audience, state),
    detail: buildDetail(params.audience, state, followUpCategories, readyCategories),
    followUpCategories,
    readyCategories,
    nextSteps,
    actions: Array.from(actionsMap.values()),
  };
}
