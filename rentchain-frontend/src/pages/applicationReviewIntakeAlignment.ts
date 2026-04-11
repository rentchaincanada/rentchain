import type { ApplicationReviewSummary } from "../api/reviewSummaryApi";
import {
  buildLandlordSharePackageCategories,
  type SharePackageCategoryView,
} from "./sharePackageAlignment";

type IntakeMetric = {
  label: string;
  value: string;
  hint: string;
  accent: string;
};

type IntakeItem = {
  label: string;
  status: "available" | "missing";
  detail: string;
};

export type LandlordIntakeAlignmentView = {
  state: "ready_for_review" | "needs_follow_up";
  headline: string;
  detail: string;
  metrics: IntakeMetric[];
  packageCategories: SharePackageCategoryView[];
  missingItems: IntakeItem[];
};

function missingFlagDetails(flags: string[]): IntakeItem[] {
  const groups = new Map<string, string>();
  flags.forEach((flag) => {
    if (flag.startsWith("MISSING_CURRENT_ADDRESS_")) {
      groups.set(
        "Rental history",
        "Rental history details are still incomplete in the information available to review."
      );
      return;
    }
    if (flag === "MISSING_TIME_AT_ADDRESS" || flag === "MISSING_CURRENT_RENT") {
      groups.set(
        "Rental history",
        "Rental history details are still limited in the current intake view."
      );
      return;
    }
    if (
      flag === "MISSING_EMPLOYER_NAME" ||
      flag === "MISSING_JOB_TITLE" ||
      flag === "MISSING_INCOME" ||
      flag === "MISSING_MONTHS_AT_JOB"
    ) {
      groups.set(
        "Profile details",
        "Profile details are not fully available to review yet."
      );
      return;
    }
    if (flag === "MISSING_WORK_REFERENCE_NAME" || flag === "MISSING_WORK_REFERENCE_PHONE") {
      groups.set(
        "Profile details",
        "Supporting profile details are still incomplete in the shared intake data."
      );
      return;
    }
    if (flag === "MISSING_SIGNATURE" || flag === "MISSING_APPLICATION_CONSENT") {
      groups.set(
        "Consent / identity status",
        "Consent or identity status is not fully available in this review package yet."
      );
    }
  });

  return Array.from(groups.entries()).map(([label, detail]) => ({
    label,
    status: "missing",
    detail,
  }));
}

export function buildLandlordIntakeAlignmentView(
  summary: ApplicationReviewSummary
): LandlordIntakeAlignmentView {
  const packageCategories = buildLandlordSharePackageCategories(summary);
  const missingItems = missingFlagDetails(summary.derived.flags);
  const profileAvailable = packageCategories.filter(
    (item) =>
      (item.key === "profile_details" || item.key === "rental_history") &&
      item.status !== "missing"
  ).length;
  const recordsAvailable = packageCategories.filter(
    (item) =>
      (item.key === "documents_records" || item.key === "consent_identity_status") &&
      item.status !== "missing"
  ).length;
  const state = missingItems.length === 0 ? "ready_for_review" : "needs_follow_up";

  return {
    state,
    headline: state === "ready_for_review" ? "Ready for review" : "Needs follow-up",
    detail:
      state === "ready_for_review"
        ? "This intake view only reflects information that is currently available in the authorized review summary."
        : "Some package categories are still missing or incomplete in the information currently available to review.",
    metrics: [
      {
        label: "Profile details",
        value: `${profileAvailable}/2`,
        hint: "Aligned package categories available to review.",
        accent: "#1d4ed8",
      },
      {
        label: "Documents & records",
        value: String(recordsAvailable),
        hint: "High-level package records currently visible to review.",
        accent: "#166534",
      },
      {
        label: "Missing items",
        value: String(missingItems.length),
        hint: "High-level categories that still need follow-up.",
        accent: "#b45309",
      },
      {
        label: "Application readiness",
        value: `${Math.round(summary.derived.completeness.score * 100)}%`,
        hint: "Current review-summary completeness signal.",
        accent: "#7c3aed",
      },
    ],
    packageCategories,
    missingItems,
  };
}
