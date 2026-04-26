import type { TenantIdentitySummary } from "../../services/tenantPortal/tenantProfileService";

export type LandlordTrustReadiness = "limited" | "emerging" | "ready" | "strong";
export type LandlordTrustRecommendedNextAction =
  | "review_application"
  | "request_missing_info"
  | "review_screening_status"
  | "review_documents"
  | "prepare_lease"
  | "no_action";
export type LandlordTrustDecisionSupportLevel = "low" | "medium" | "high";

export type LandlordTrustContext = {
  trustReadiness: LandlordTrustReadiness;
  trustLabel: string;
  trustDescription: string;
  positiveSignals: string[];
  missingSignals: string[];
  cautionSignals: string[];
  recommendedNextAction: LandlordTrustRecommendedNextAction;
  decisionSupportLevel: LandlordTrustDecisionSupportLevel;
};

type Input = {
  tenantIdentitySummary: TenantIdentitySummary | null;
  completenessScore: number | null;
  completenessFlags: string[];
  screeningStatus: string | null | undefined;
  applicationReusable?: boolean | null;
};

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeScreeningStatus(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isScreeningComplete(status: string) {
  return status === "complete" || status === "completed" || status === "paid";
}

function isScreeningPending(status: string) {
  return [
    "not_run",
    "not_started",
    "pending",
    "in_progress",
    "external_pending",
    "unpaid",
    "consent_pending",
  ].includes(status);
}

function groupMissingFlags(flags: string[]) {
  const missingSignals: string[] = [];
  const cautionSignals: string[] = [];

  const hasAddressGap = flags.some(
    (flag) =>
      flag.startsWith("MISSING_CURRENT_ADDRESS_") ||
      flag === "MISSING_TIME_AT_ADDRESS" ||
      flag === "MISSING_CURRENT_RENT",
  );
  const hasEmploymentGap = flags.some((flag) =>
    ["MISSING_EMPLOYER_NAME", "MISSING_JOB_TITLE", "MISSING_INCOME", "MISSING_MONTHS_AT_JOB"].includes(flag),
  );
  const hasReferenceGap = flags.some((flag) =>
    ["MISSING_WORK_REFERENCE_NAME", "MISSING_WORK_REFERENCE_PHONE"].includes(flag),
  );
  const hasConsentGap = flags.some((flag) =>
    ["MISSING_SIGNATURE", "MISSING_APPLICATION_CONSENT"].includes(flag),
  );

  if (hasAddressGap) {
    missingSignals.push("Rental history details are still incomplete.");
  }
  if (hasEmploymentGap) {
    missingSignals.push("Employment or income details are still incomplete.");
  }
  if (hasReferenceGap) {
    missingSignals.push("Supporting reference details are still incomplete.");
  }
  if (hasConsentGap) {
    cautionSignals.push("Consent or identity confirmation is still limited in the current review package.");
  }

  return {
    missingSignals,
    cautionSignals,
  };
}

function deriveRecommendedNextAction(params: {
  trustReadiness: LandlordTrustReadiness;
  missingSignals: string[];
  cautionSignals: string[];
  screeningStatus: string;
  verificationLevel: TenantIdentitySummary["verification"]["level"] | null;
}) {
  const { trustReadiness, missingSignals, cautionSignals, screeningStatus, verificationLevel } = params;

  if (missingSignals.length > 0) return "request_missing_info" as const;
  if (isScreeningPending(screeningStatus)) return "review_screening_status" as const;
  if (verificationLevel === "none" || cautionSignals.some((item) => item.toLowerCase().includes("supporting records"))) {
    return "review_documents" as const;
  }
  if (trustReadiness === "strong" && isScreeningComplete(screeningStatus)) return "prepare_lease" as const;
  if (trustReadiness === "limited") return "request_missing_info" as const;
  if (trustReadiness === "emerging") return "review_application" as const;
  if (trustReadiness === "ready") return "review_application" as const;
  return "no_action" as const;
}

function deriveCopy(params: {
  trustReadiness: LandlordTrustReadiness;
  recommendedNextAction: LandlordTrustRecommendedNextAction;
}) {
  const { trustReadiness, recommendedNextAction } = params;

  if (trustReadiness === "strong") {
    return {
      trustLabel: "Strong supporting context",
      trustDescription:
        recommendedNextAction === "prepare_lease"
          ? "Application information and supporting identity signals are well organized for the landlord’s next review step."
          : "Supporting identity and application signals are well organized in the current review package.",
      decisionSupportLevel: "high" as LandlordTrustDecisionSupportLevel,
    };
  }

  if (trustReadiness === "ready") {
    return {
      trustLabel: "Ready for review",
      trustDescription:
        "Application information appears organized enough for review, with only limited follow-up signals still visible.",
      decisionSupportLevel: "medium" as LandlordTrustDecisionSupportLevel,
    };
  }

  if (trustReadiness === "emerging") {
    return {
      trustLabel: "Emerging supporting signals",
      trustDescription:
        "Some useful identity and application signals are available, but the file still benefits from a closer landlord review.",
      decisionSupportLevel: "medium" as LandlordTrustDecisionSupportLevel,
    };
  }

  return {
    trustLabel: "Limited supporting signals",
    trustDescription:
      "The current review package still has limited supporting context, so follow-up is advisable before the next landlord step.",
    decisionSupportLevel: "low" as LandlordTrustDecisionSupportLevel,
  };
}

export function deriveLandlordTrustContext(input: Input): LandlordTrustContext {
  const tenantIdentitySummary = input.tenantIdentitySummary || null;
  const completenessScore =
    typeof input.completenessScore === "number" && Number.isFinite(input.completenessScore)
      ? input.completenessScore
      : 0;
  const completenessFlags = Array.isArray(input.completenessFlags) ? input.completenessFlags : [];
  const screeningStatus = normalizeScreeningStatus(input.screeningStatus);
  const applicationReusable = input.applicationReusable === true;
  const identityStatus = tenantIdentitySummary?.identityStatus || "limited";
  const verificationLevel = tenantIdentitySummary?.verification?.level || "none";

  const groupedFlags = groupMissingFlags(completenessFlags);
  const positiveSignals: string[] = [];
  const cautionSignals = [...groupedFlags.cautionSignals];

  if (identityStatus === "ready" || identityStatus === "verified") {
    positiveSignals.push("Identity profile is organized for landlord review.");
  }
  if (verificationLevel === "partial" || verificationLevel === "strong") {
    positiveSignals.push("Identity profile has stronger supporting signals.");
  }
  if (applicationReusable) {
    positiveSignals.push("Application information is reusable and mostly organized.");
  }
  if (completenessScore >= 0.8) {
    positiveSignals.push("Application information is mostly complete.");
  }
  if (isScreeningComplete(screeningStatus)) {
    positiveSignals.push("Screening status is available as a normalized signal.");
  } else if (isScreeningPending(screeningStatus)) {
    cautionSignals.push("Screening is not complete yet in the current normalized status view.");
  }
  if (verificationLevel === "none") {
    cautionSignals.push("Supporting records are still limited in the current review package.");
  }

  let trustReadiness: LandlordTrustReadiness = "limited";
  if (
    (identityStatus === "verified" || identityStatus === "ready") &&
    verificationLevel === "strong" &&
    applicationReusable &&
    completenessScore >= 0.85 &&
    isScreeningComplete(screeningStatus)
  ) {
    trustReadiness = "strong";
  } else if (
    (identityStatus === "ready" || identityStatus === "verified") &&
    completenessScore >= 0.75 &&
    groupedFlags.missingSignals.length === 0
  ) {
    trustReadiness = "ready";
  } else if (
    identityStatus !== "limited" ||
    verificationLevel !== "none" ||
    completenessScore >= 0.45 ||
    applicationReusable
  ) {
    trustReadiness = "emerging";
  }

  const recommendedNextAction = deriveRecommendedNextAction({
    trustReadiness,
    missingSignals: groupedFlags.missingSignals,
    cautionSignals,
    screeningStatus,
    verificationLevel,
  });

  const copy = deriveCopy({
    trustReadiness,
    recommendedNextAction,
  });

  return {
    trustReadiness,
    trustLabel: copy.trustLabel,
    trustDescription: copy.trustDescription,
    positiveSignals: unique(positiveSignals),
    missingSignals: unique(groupedFlags.missingSignals),
    cautionSignals: unique(cautionSignals),
    recommendedNextAction,
    decisionSupportLevel: copy.decisionSupportLevel,
  };
}
