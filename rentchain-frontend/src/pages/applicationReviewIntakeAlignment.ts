import type { ApplicationReviewSummary } from "../api/reviewSummaryApi";

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
  profileItems: IntakeItem[];
  recordItems: IntakeItem[];
  missingItems: IntakeItem[];
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(String(value || "").trim());
}

function moneyProvided(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function statusLabel(available: boolean): IntakeItem["status"] {
  return available ? "available" : "missing";
}

function missingFlagDetails(flags: string[]): IntakeItem[] {
  const groups = new Map<string, string>();
  flags.forEach((flag) => {
    if (flag.startsWith("MISSING_CURRENT_ADDRESS_")) {
      groups.set(
        "Current address",
        "Current address details are still incomplete in the information available to review."
      );
      return;
    }
    if (flag === "MISSING_TIME_AT_ADDRESS" || flag === "MISSING_CURRENT_RENT") {
      groups.set(
        "Current housing details",
        "Housing history details are still limited in the current intake view."
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
        "Employment & income",
        "Employment or income details are not fully available to review yet."
      );
      return;
    }
    if (flag === "MISSING_WORK_REFERENCE_NAME" || flag === "MISSING_WORK_REFERENCE_PHONE") {
      groups.set(
        "Work reference",
        "A full work reference is not yet available in the shared intake data."
      );
      return;
    }
    if (flag === "MISSING_SIGNATURE") {
      groups.set(
        "Signature record",
        "A signed application record is not available in this review summary yet."
      );
      return;
    }
    if (flag === "MISSING_APPLICATION_CONSENT") {
      groups.set(
        "Consent record",
        "An application consent record is not available in this review summary yet."
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
  const profileItems: IntakeItem[] = [
    {
      label: "Shared profile details",
      status: statusLabel(hasText(summary.applicant.name) || hasText(summary.applicant.email)),
      detail:
        hasText(summary.applicant.name) || hasText(summary.applicant.email)
          ? "Core applicant identity and contact details are available to review."
          : "Core applicant identity details are still limited in this intake view.",
    },
    {
      label: "Address history",
      status: statusLabel(
        hasText(summary.applicant.currentAddressLine) &&
          hasText(summary.applicant.city) &&
          hasText(summary.applicant.provinceState)
      ),
      detail:
        hasText(summary.applicant.currentAddressLine) &&
        hasText(summary.applicant.city) &&
        hasText(summary.applicant.provinceState)
          ? "Current address details are available to review."
          : "Address history details are still incomplete in the shared intake data.",
    },
    {
      label: "Employment & income",
      status: statusLabel(
        hasText(summary.employment.employerName) &&
          hasText(summary.employment.jobTitle) &&
          moneyProvided(summary.employment.incomeAmountCents) &&
          hasText(summary.employment.incomeFrequency)
      ),
      detail:
        hasText(summary.employment.employerName) &&
        hasText(summary.employment.jobTitle) &&
        moneyProvided(summary.employment.incomeAmountCents) &&
        hasText(summary.employment.incomeFrequency)
          ? "Employment and income details are available to review."
          : "Employment or income details still need follow-up.",
    },
    {
      label: "Work reference",
      status: statusLabel(hasText(summary.reference.name) && hasText(summary.reference.phone)),
      detail:
        hasText(summary.reference.name) && hasText(summary.reference.phone)
          ? "A work reference is available to review."
          : "A full work reference is not yet available in this intake view.",
    },
  ];

  const recordItems: IntakeItem[] = [
    {
      label: "Consent record",
      status: statusLabel(
        hasText(summary.compliance.applicationConsentVersion) ||
          hasText(summary.compliance.applicationConsentAcceptedAt)
      ),
      detail:
        hasText(summary.compliance.applicationConsentVersion) ||
        hasText(summary.compliance.applicationConsentAcceptedAt)
          ? "An application consent record is available to review."
          : "No application consent record is visible in this summary yet.",
    },
    {
      label: "Signature record",
      status: statusLabel(hasText(summary.compliance.signatureType) || hasText(summary.compliance.signedAt)),
      detail:
        hasText(summary.compliance.signatureType) || hasText(summary.compliance.signedAt)
          ? "A signed application record is available to review."
          : "A signed application record is not visible in this summary yet.",
    },
    {
      label: "Screening reference",
      status: statusLabel(hasText(summary.screening.referenceId) || hasText(summary.screening.provider)),
      detail:
        hasText(summary.screening.referenceId) || hasText(summary.screening.provider)
          ? "A screening or verification record is available in the current intake view."
          : "No screening or verification record is visible yet.",
    },
  ];

  const missingItems = missingFlagDetails(summary.derived.flags);
  const profileAvailable = profileItems.filter((item) => item.status === "available").length;
  const recordsAvailable = recordItems.filter((item) => item.status === "available").length;
  const state = missingItems.length === 0 ? "ready_for_review" : "needs_follow_up";

  return {
    state,
    headline: state === "ready_for_review" ? "Ready for review" : "Needs follow-up",
    detail:
      state === "ready_for_review"
        ? "This intake view only reflects information that is currently available in the authorized review summary."
        : "Some categories are still missing or incomplete in the information currently available to review.",
    metrics: [
      {
        label: "Shared profile details",
        value: `${profileAvailable}/${profileItems.length}`,
        hint: "High-level profile categories available to review.",
        accent: "#1d4ed8",
      },
      {
        label: "Shared documents & records",
        value: String(recordsAvailable),
        hint: "Visible consent, signature, or screening records.",
        accent: "#166534",
      },
      {
        label: "Missing items",
        value: String(missingItems.length),
        hint: "High-level categories that still need follow-up.",
        accent: "#b45309",
      },
      {
        label: "Completeness",
        value: `${Math.round(summary.derived.completeness.score * 100)}%`,
        hint: "Current review-summary completeness signal.",
        accent: "#7c3aed",
      },
    ],
    profileItems,
    recordItems,
    missingItems,
  };
}
