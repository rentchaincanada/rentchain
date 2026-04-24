export type TenantSafeScreeningStatus =
  | "consent_required"
  | "consent_confirmed"
  | "screening_in_progress"
  | "completed"
  | "manual_review"
  | "blocked"
  | "unavailable";

export type TenantSafeScreeningNextAction =
  | "authorize_screening"
  | "wait_for_landlord"
  | "view_status"
  | "no_action_needed";

type AdapterInput = {
  requestStatus?: string | null;
  nextAction?: string | null;
  consentAcceptedAt?: number | null;
  sessionStatus?: string | null;
  resultStatus?: string | null;
  providerSessionStatus?: string | null;
};

export type TenantSafeScreeningState = {
  tenantStatus: TenantSafeScreeningStatus;
  tenantStatusLabel: string;
  tenantStatusDescription: string;
  tenantNextAction: TenantSafeScreeningNextAction;
};

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function adaptTenantSafeScreeningState(input: AdapterInput): TenantSafeScreeningState {
  const requestStatus = normalize(input.requestStatus);
  const nextAction = normalize(input.nextAction);
  const sessionStatus = normalize(input.sessionStatus);
  const resultStatus = normalize(input.resultStatus);
  const providerSessionStatus = normalize(input.providerSessionStatus);
  const hasAcceptedConsent = Boolean(input.consentAcceptedAt);

  let tenantStatus: TenantSafeScreeningStatus = "unavailable";

  if (
    requestStatus === "manual_review_required" ||
    resultStatus === "manual_review_required" ||
    sessionStatus === "pending_review" ||
    nextAction === "await_manual_review" ||
    providerSessionStatus.includes("manual_review")
  ) {
    tenantStatus = "manual_review";
  } else if (
    requestStatus === "completed" ||
    resultStatus === "completed" ||
    sessionStatus === "completed"
  ) {
    tenantStatus = "completed";
  } else if (
    requestStatus === "failed" ||
    resultStatus === "failed" ||
    nextAction === "provider_activation_pending" ||
    nextAction === "retry_available" ||
    sessionStatus === "expired" ||
    providerSessionStatus.includes("activation_pending")
  ) {
    tenantStatus = "blocked";
  } else if (
    requestStatus === "in_progress" ||
    requestStatus === "requested" ||
    sessionStatus === "in_progress" ||
    sessionStatus === "redirect_pending" ||
    sessionStatus === "consent_received" ||
    sessionStatus === "ready_for_consent" ||
    sessionStatus === "created" ||
    nextAction === "await_redirect_provider_start" ||
    nextAction === "view_result" ||
    nextAction === "await_internal_finalization"
  ) {
    tenantStatus = hasAcceptedConsent || requestStatus !== "requested" ? "screening_in_progress" : "consent_required";
  } else if (
    requestStatus === "consented" ||
    (hasAcceptedConsent && requestStatus !== "completed" && requestStatus !== "manual_review_required")
  ) {
    tenantStatus = "consent_confirmed";
  } else if (
    requestStatus === "consent_pending" ||
    nextAction === "awaiting_applicant_consent"
  ) {
    tenantStatus = "consent_required";
  }

  switch (tenantStatus) {
    case "consent_required":
      return {
        tenantStatus,
        tenantStatusLabel: "Consent required",
        tenantStatusDescription:
          "The landlord has requested screening for this application. Your authorization is required before it can proceed.",
        tenantNextAction: "authorize_screening",
      };
    case "consent_confirmed":
      return {
        tenantStatus,
        tenantStatusLabel: "Consent confirmed",
        tenantStatusDescription:
          "Your consent has been recorded. The landlord can continue reviewing your application.",
        tenantNextAction: "view_status",
      };
    case "screening_in_progress":
      return {
        tenantStatus,
        tenantStatusLabel: "Screening in progress",
        tenantStatusDescription: "Screening is in progress.",
        tenantNextAction: "view_status",
      };
    case "completed":
      return {
        tenantStatus,
        tenantStatusLabel: "Screening workflow completed",
        tenantStatusDescription: "Screening workflow completed.",
        tenantNextAction: "no_action_needed",
      };
    case "manual_review":
      return {
        tenantStatus,
        tenantStatusLabel: "Manual review may be required",
        tenantStatusDescription: "This screening may require manual review.",
        tenantNextAction: "view_status",
      };
    case "blocked":
      return {
        tenantStatus,
        tenantStatusLabel: "Screening cannot proceed yet",
        tenantStatusDescription:
          "Screening cannot proceed yet. The landlord may still need to complete screening setup.",
        tenantNextAction: "wait_for_landlord",
      };
    default:
      return {
        tenantStatus: "unavailable",
        tenantStatusLabel: "Screening status unavailable",
        tenantStatusDescription: "Screening status is currently unavailable.",
        tenantNextAction: "view_status",
      };
  }
}
