import { buildScreeningPolicyRequest } from "./policy/policyAdapters";
import { evaluatePolicy } from "./policy/policyEvaluator";
import {
  buildScreeningMonetizationSummary,
  normalizeScreeningMonetizationState,
  type ScreeningMonetizationEligibility,
  type ScreeningMonetizationFulfillmentStatus,
  type ScreeningMonetizationPaymentStatus,
  type ScreeningMonetizationQuoteStatus,
} from "../services/screening/screeningMonetizationService";

export const SCREENING_CONSENT_VERSION = "v1.0";

const ELIGIBLE_SCREENING_APPLICATION_STATUSES = ["SUBMITTED", "IN_REVIEW"];

export type ScreeningCheckoutExecutionInputMissingField =
  | "applicationStatus"
  | "consentTimestamp"
  | "consentVersion"
  | "applicationData"
  | "screeningQuote";

export type ScreeningCheckoutExecutionInput = {
  applicationId: string | null;
  propertyId: string | null;
  unitId: string | null;
  applicantEmail: string | null;
  applicationStatus: string | null;
  eligibility: ScreeningMonetizationEligibility;
  eligibilityReasonCode: string | null;
  consentVersion: string | null;
  consentTimestamp: string | null;
  quoteId: string | null;
  quoteGeneratedAt: string | null;
  quoteExpiresAt: string | null;
  quoteStatus: ScreeningMonetizationQuoteStatus;
  paymentStatus: ScreeningMonetizationPaymentStatus;
  fulfillmentStatus: ScreeningMonetizationFulfillmentStatus;
  blockingReason: string | null;
  policyOutcome: "allow" | "block" | "review" | "defer" | null;
  canStartCheckout: boolean;
};

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function consentFromApplication(application?: any) {
  return application?.consent || {};
}

export function evaluateScreeningApplicationEligibility(application: any) {
  const status = String(application?.status || "").toUpperCase();
  if (!ELIGIBLE_SCREENING_APPLICATION_STATUSES.includes(status)) {
    return {
      eligible: false,
      detail: "Application must be submitted before screening.",
      reasonCode: "APPLICATION_STATUS_NOT_READY",
    };
  }
  const consent = consentFromApplication(application);
  if (!consent?.creditConsent || !consent?.referenceConsent) {
    return {
      eligible: false,
      detail: "Consent for credit and references is required.",
      reasonCode: "MISSING_CONSENT",
    };
  }
  const dob = String(application?.applicant?.dob || "").trim();
  const sin = String(
    application?.applicant?.sinLast4 ||
      application?.applicant?.sin ||
      application?.applicantProfile?.sinLast4 ||
      application?.applicantProfile?.sin ||
      ""
  ).trim();
  const currentAddress = String(application?.residentialHistory?.[0]?.address || "").trim();
  if ((!dob && !sin) || !currentAddress) {
    return {
      eligible: false,
      detail: "DOB (or SIN) and current address are required.",
      reasonCode: "MISSING_TENANT_PROFILE",
    };
  }
  return { eligible: true, detail: null, reasonCode: "ELIGIBLE" };
}

export function resolveScreeningConsentPayload(body: any, application?: any) {
  const payload = body && typeof body === "object" ? body : {};
  const nestedConsent = payload?.consent && typeof payload.consent === "object" ? payload.consent : {};
  const consent = Object.keys(nestedConsent).length ? nestedConsent : payload;
  const appConsent = consentFromApplication(application);
  const timestamp = String(consent?.timestamp || appConsent?.acceptedAt || "").trim();
  const version = String(consent?.version || appConsent?.version || SCREENING_CONSENT_VERSION).trim();
  const textHash = consent?.textHash
    ? String(consent.textHash).trim()
    : appConsent?.textHash
    ? String(appConsent.textHash).trim()
    : null;
  return {
    given: Boolean(consent?.given || (appConsent?.creditConsent === true && appConsent?.referenceConsent === true)),
    timestamp,
    version,
    textHash,
  };
}

export function validateScreeningConsentPayload(consent: ReturnType<typeof resolveScreeningConsentPayload>) {
  if (!consent.given) return { ok: false, error: "consent_required" };
  if (!consent.timestamp) return { ok: false, error: "consent_missing_timestamp" };
  if (consent.version !== SCREENING_CONSENT_VERSION) return { ok: false, error: "consent_version_mismatch" };
  return { ok: true };
}

function deriveScreeningApplicationDataComplete(application: any) {
  const applicant = application?.applicant || {};
  const residentialHistory = Array.isArray(application?.residentialHistory) ? application.residentialHistory : [];
  return Boolean(
    asString(applicant?.firstName, 120) &&
      asString(applicant?.lastName, 120) &&
      asString(applicant?.email, 240) &&
      asString(applicant?.dob, 40) &&
      residentialHistory.length > 0
  );
}

export function deriveScreeningCheckoutExecutionInputSnapshot(params: {
  application: any;
  latestOrder?: any;
  now?: number;
}) {
  const application = params.application || {};
  const latestOrder = params.latestOrder || null;
  const now = typeof params.now === "number" ? params.now : Date.now();
  const eligibilityCheck = evaluateScreeningApplicationEligibility(application);
  const consent = resolveScreeningConsentPayload({}, application);
  const consentCheck = validateScreeningConsentPayload(consent);
  const monetizationEligibility: ScreeningMonetizationEligibility = eligibilityCheck.eligible ? "eligible" : "ineligible";
  const monetizationState = normalizeScreeningMonetizationState({
    application,
    latestOrder,
    eligibility: monetizationEligibility,
    now,
  });
  const monetizationSummary = buildScreeningMonetizationSummary(monetizationState);
  const policyRequest = buildScreeningPolicyRequest({
    action: "start_checkout",
    actorRole: "landlord",
    actorUserId: null,
    applicationId: asString(application?.id, 240),
    eligibility: eligibilityCheck,
    application,
    consentComplete: consentCheck.ok,
    providerReady: true,
  });
  const policyResult = evaluatePolicy(policyRequest);

  const missingFields: ScreeningCheckoutExecutionInputMissingField[] = [];
  if (!ELIGIBLE_SCREENING_APPLICATION_STATUSES.includes(String(application?.status || "").toUpperCase())) {
    missingFields.push("applicationStatus");
  }
  if (!consent.timestamp) {
    missingFields.push("consentTimestamp");
  }
  if (consent.version !== SCREENING_CONSENT_VERSION) {
    missingFields.push("consentVersion");
  }
  if (!deriveScreeningApplicationDataComplete(application)) {
    missingFields.push("applicationData");
  }
  if (monetizationState.quoteStatus !== "generated") {
    missingFields.push("screeningQuote");
  }

  const input: ScreeningCheckoutExecutionInput = {
    applicationId: asString(application?.id, 240) || null,
    propertyId: asString(application?.propertyId, 240) || null,
    unitId: asString(application?.unitId, 240) || null,
    applicantEmail: asString(application?.applicant?.email, 240) || null,
    applicationStatus: asString(application?.status, 80) || null,
    eligibility: monetizationState.eligibility,
    eligibilityReasonCode: eligibilityCheck.reasonCode || null,
    consentVersion: consent.version || null,
    consentTimestamp: consent.timestamp || null,
    quoteId: monetizationState.quoteId || null,
    quoteGeneratedAt: monetizationState.quoteGeneratedAt || null,
    quoteExpiresAt: monetizationState.quoteExpiresAt || null,
    quoteStatus: monetizationState.quoteStatus,
    paymentStatus: monetizationState.paymentStatus,
    fulfillmentStatus: monetizationState.fulfillmentStatus,
    blockingReason: monetizationSummary.blockingReason || null,
    policyOutcome: policyResult.outcome || null,
    canStartCheckout: monetizationSummary.canStartCheckout,
  };

  if (monetizationSummary.blockingReason === "SCREENING_ALREADY_PAID") {
    return {
      state: "partial" as const,
      reason: "This application already has a paid or completed screening.",
      missingFields: [] as ScreeningCheckoutExecutionInputMissingField[],
      input,
    };
  }
  if (monetizationSummary.blockingReason === "SCREENING_ORDER_ALREADY_CREATED") {
    return {
      state: "partial" as const,
      reason: "This application already has a screening order in progress.",
      missingFields: [] as ScreeningCheckoutExecutionInputMissingField[],
      input,
    };
  }
  if (monetizationSummary.blockingReason === "SCREENING_CHECKOUT_ALREADY_EXISTS") {
    return {
      state: "partial" as const,
      reason: "This application already has an active screening checkout.",
      missingFields: [] as ScreeningCheckoutExecutionInputMissingField[],
      input,
    };
  }
  if (missingFields.length > 0) {
    return {
      state: "partial" as const,
      reason: `This screening checkout still needs canonical readiness fields: ${missingFields.join(", ")}.`,
      missingFields,
      input,
    };
  }
  if (policyResult.outcome !== "allow") {
    return {
      state: "partial" as const,
      reason:
        policyResult.reasons[0]?.message ||
        "This screening checkout still needs manual review before it is execution-ready.",
      missingFields: [] as ScreeningCheckoutExecutionInputMissingField[],
      input,
    };
  }
  return {
    state: "complete" as const,
    reason: null,
    missingFields: [] as ScreeningCheckoutExecutionInputMissingField[],
    input,
  };
}
