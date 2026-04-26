import type { SharePackageCategoryView } from "./sharePackageAlignment";

export type FollowUpResolutionOverallState =
  | "follow_up_needed"
  | "partly_addressed"
  | "ready_for_rereview";

export type FollowUpResolutionCategoryState = "still_needed" | "addressed";

export type FollowUpResolutionCategory = SharePackageCategoryView & {
  resolutionState: FollowUpResolutionCategoryState;
};

export type FollowUpResolutionView = {
  overallState: FollowUpResolutionOverallState;
  openFollowUpCategories: FollowUpResolutionCategory[];
  addressedCategories: FollowUpResolutionCategory[];
  remainingCategoriesNeedingAttention: string[];
};

function withResolutionState(
  category: SharePackageCategoryView,
  resolutionState: FollowUpResolutionCategoryState
): FollowUpResolutionCategory {
  return {
    ...category,
    resolutionState,
  };
}

export function buildFollowUpResolutionState(
  packageCategories: SharePackageCategoryView[]
): FollowUpResolutionView {
  const openFollowUpCategories = packageCategories
    .filter((category) => category.status === "missing")
    .map((category) => withResolutionState(category, "still_needed"));
  const addressedCategories = packageCategories
    .filter((category) => category.status !== "missing")
    .map((category) => withResolutionState(category, "addressed"));

  const overallState: FollowUpResolutionOverallState =
    openFollowUpCategories.length === 0
      ? "ready_for_rereview"
      : addressedCategories.length > 0
      ? "partly_addressed"
      : "follow_up_needed";

  return {
    overallState,
    openFollowUpCategories,
    addressedCategories,
    remainingCategoriesNeedingAttention: openFollowUpCategories.map((category) => category.label),
  };
}
