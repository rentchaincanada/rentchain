import type { ApplicationReviewSummary } from "../api/reviewSummaryApi";

export type SharePackageCategoryKey =
  | "profile_details"
  | "rental_history"
  | "documents_records"
  | "consent_identity_status"
  | "application_readiness";

export type SharePackageCategoryStatus = "ready" | "partial" | "missing";

export type SharePackageCategoryView = {
  key: SharePackageCategoryKey;
  label: string;
  status: SharePackageCategoryStatus;
  detail: string;
};

export const SHARE_PACKAGE_CATEGORY_LABELS: Record<SharePackageCategoryKey, string> = {
  profile_details: "Profile details",
  rental_history: "Rental history",
  documents_records: "Documents & records",
  consent_identity_status: "Consent / identity status",
  application_readiness: "Application readiness",
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(String(value || "").trim());
}

function hasNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function category(
  key: SharePackageCategoryKey,
  status: SharePackageCategoryStatus,
  detail: string
): SharePackageCategoryView {
  return {
    key,
    label: SHARE_PACKAGE_CATEGORY_LABELS[key],
    status,
    detail,
  };
}

export function buildTenantSharePackageCategories(input: {
  hasProfileBasics: boolean;
  rentalHistoryDetail: string;
  hasRentalHistory: boolean;
  readyDocumentCount: number;
  missingDocumentCount: number;
  identityStatusLabel: string;
  identityVerified: boolean;
  activeGrantCount: number;
  progressPercent: number;
  missingCount: number;
}): SharePackageCategoryView[] {
  const documentStatus: SharePackageCategoryStatus =
    input.readyDocumentCount > 0
      ? input.missingDocumentCount > 0
        ? "partial"
        : "ready"
      : input.missingDocumentCount > 0
      ? "missing"
      : "partial";

  const consentStatus: SharePackageCategoryStatus =
    input.identityVerified && input.activeGrantCount > 0
      ? "ready"
      : input.identityVerified || input.activeGrantCount > 0
      ? "partial"
      : "missing";

  const readinessStatus: SharePackageCategoryStatus =
    input.missingCount === 0 && input.progressPercent >= 80
      ? "ready"
      : input.progressPercent > 0
      ? "partial"
      : "missing";

  return [
    category(
      "profile_details",
      input.hasProfileBasics ? "ready" : "missing",
      input.hasProfileBasics
        ? "Your core profile details are organized in this package."
        : "Add the missing basics in your profile before sharing this package."
    ),
    category(
      "rental_history",
      input.hasRentalHistory ? "ready" : "missing",
      input.hasRentalHistory
        ? input.rentalHistoryDetail
        : "Rental history details will appear here when they are connected to your profile."
    ),
    category(
      "documents_records",
      documentStatus,
      input.readyDocumentCount > 0
        ? `${input.readyDocumentCount} document${input.readyDocumentCount === 1 ? "" : "s"} are part of your package${input.missingDocumentCount > 0 ? `, with ${input.missingDocumentCount} still needing attention.` : "."}`
        : input.missingDocumentCount > 0
        ? `${input.missingDocumentCount} document item${input.missingDocumentCount === 1 ? "" : "s"} still need attention before this package feels complete.`
        : "Documents and records will appear here when they are available in your profile.",
    ),
    category(
      "consent_identity_status",
      consentStatus,
      input.identityVerified && input.activeGrantCount > 0
        ? `Identity is verified and ${input.activeGrantCount} supported share record${input.activeGrantCount === 1 ? "" : "s"} are active.`
        : input.identityVerified
        ? "Your identity status is ready, and you can review sharing from your access workspace."
        : input.activeGrantCount > 0
        ? `${input.activeGrantCount} supported share record${input.activeGrantCount === 1 ? "" : "s"} are active. ${input.identityStatusLabel}`
        : input.identityStatusLabel,
    ),
    category(
      "application_readiness",
      readinessStatus,
      input.missingCount === 0
        ? `Your package is ${input.progressPercent}% ready based on the current application checklist.`
        : `${input.progressPercent}% ready with ${input.missingCount} item${input.missingCount === 1 ? "" : "s"} still needing attention.`,
    ),
  ];
}

export function buildLandlordSharePackageCategories(
  summary: ApplicationReviewSummary
): SharePackageCategoryView[] {
  const profileSignals = [
    hasText(summary.applicant.name),
    hasText(summary.applicant.email),
    hasText(summary.employment.employerName),
    hasText(summary.employment.jobTitle),
  ].filter(Boolean).length;

  const rentalSignals = [
    hasText(summary.applicant.currentAddressLine),
    hasText(summary.applicant.city),
    hasText(summary.applicant.provinceState),
    hasNumber(summary.applicant.timeAtCurrentAddressMonths),
    hasNumber(summary.applicant.currentRentAmountCents),
  ].filter(Boolean).length;

  const recordSignals = [
    hasText(summary.compliance.applicationConsentVersion) || hasText(summary.compliance.applicationConsentAcceptedAt),
    hasText(summary.compliance.signatureType) || hasText(summary.compliance.signedAt),
    hasText(summary.screening.referenceId) || hasText(summary.screening.provider),
  ].filter(Boolean).length;

  const consentSignals = [
    hasText(summary.compliance.applicationConsentVersion) || hasText(summary.compliance.applicationConsentAcceptedAt),
    hasText(summary.compliance.signatureType) || hasText(summary.compliance.signedAt),
    summary.screening.status !== "not_run",
  ].filter(Boolean).length;

  const readinessStatus: SharePackageCategoryStatus =
    summary.derived.flags.length === 0 && summary.derived.completeness.score >= 0.8
      ? "ready"
      : summary.derived.completeness.score > 0
      ? "partial"
      : "missing";

  return [
    category(
      "profile_details",
      profileSignals >= 3 ? "ready" : profileSignals > 0 ? "partial" : "missing",
      profileSignals >= 3
        ? "Profile details are available to review in this package."
        : profileSignals > 0
        ? "Some profile details are available, but the package is still incomplete."
        : "Profile details are still limited in the current authorized review summary.",
    ),
    category(
      "rental_history",
      rentalSignals >= 3 ? "ready" : rentalSignals > 0 ? "partial" : "missing",
      rentalSignals >= 3
        ? "Rental history details are available to review."
        : rentalSignals > 0
        ? "Some rental history details are visible, but this category is still incomplete."
        : "Rental history details are not yet available in this review package.",
    ),
    category(
      "documents_records",
      recordSignals >= 2 ? "ready" : recordSignals > 0 ? "partial" : "missing",
      recordSignals >= 2
        ? "Documents and records are available to review at a high level."
        : recordSignals > 0
        ? "Some package records are available to review, with more still missing."
        : "Documents and records are not yet available in this review package.",
    ),
    category(
      "consent_identity_status",
      consentSignals >= 2 ? "ready" : consentSignals > 0 ? "partial" : "missing",
      consentSignals >= 2
        ? "Consent and identity-related status records are available to review."
        : consentSignals > 0
        ? "Some consent or identity status is available, but it is not yet complete."
        : "Consent or identity status is not yet visible in this review package.",
    ),
    category(
      "application_readiness",
      readinessStatus,
      readinessStatus === "ready"
        ? `This package is ready for review at ${Math.round(summary.derived.completeness.score * 100)}% completeness.`
        : readinessStatus === "partial"
        ? `${Math.round(summary.derived.completeness.score * 100)}% completeness with ${summary.derived.flags.length} category gap${summary.derived.flags.length === 1 ? "" : "s"} still surfaced.`
        : "Application readiness is not yet available from the current review summary.",
    ),
  ];
}
