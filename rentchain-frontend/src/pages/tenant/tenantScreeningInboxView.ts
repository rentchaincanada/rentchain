import type {
  TenantSafeScreeningNextAction,
  TenantSafeScreeningStatus,
  TenantScreeningRequest,
} from "../../api/tenantScreeningApi";

export type TenantScreeningInboxStatus = TenantSafeScreeningStatus;
export type TenantScreeningInboxNextAction = TenantSafeScreeningNextAction;

export type TenantScreeningInboxItemView = {
  id: string;
  status: TenantScreeningInboxStatus;
  statusLabel: string;
  description: string;
  nextAction: TenantScreeningInboxNextAction;
  nextActionLabel: string;
  providerLabel: string;
  requesterLabel: string;
  propertyContext: string;
  requestContext: string;
  requestedAt: number | null;
  activityAt: number | null;
  consentedAt: number | null;
  consentLabel: string;
};

function resolveProviderLabel(item: TenantScreeningRequest) {
  if (item.consent?.providerLabel) return item.consent.providerLabel;
  if (item.providerLabel) return item.providerLabel;
  if (item.provider === "transunion_redirect") return "TransUnion";
  if (item.provider === "equifax") return "Equifax";
  if (item.provider === "manual") return "Manual review";
  return "Selected screening provider";
}

export function normalizeTenantScreeningStatus(item: TenantScreeningRequest): TenantScreeningInboxStatus {
  if (item.tenantStatus) return item.tenantStatus;
  const rawStatus = String(item.status || "").trim().toLowerCase();
  if (rawStatus === "consent_pending") return "consent_required";
  if (rawStatus === "consented") return "consent_confirmed";
  if (rawStatus === "in_progress" || rawStatus === "requested") return "screening_in_progress";
  if (rawStatus === "completed") return "completed";
  if (rawStatus === "manual_review_required") return "manual_review";
  if (rawStatus === "failed") return "blocked";
  return "unavailable";
}

function statusLabel(status: TenantScreeningInboxStatus) {
  switch (status) {
    case "consent_required":
      return "Consent required";
    case "consent_confirmed":
      return "Consent confirmed";
    case "screening_in_progress":
      return "Screening in progress";
    case "completed":
      return "Screening workflow completed";
    case "manual_review":
      return "Manual review may be required";
    case "blocked":
      return "Screening cannot proceed yet";
    default:
      return "Screening status unavailable";
  }
}

function statusDescription(item: TenantScreeningRequest, status: TenantScreeningInboxStatus) {
  if (item.tenantStatusDescription) return item.tenantStatusDescription;
  switch (status) {
    case "consent_required":
      return "The landlord has requested screening for this application. Your authorization is required before it can proceed.";
    case "consent_confirmed":
      return "Your consent has been recorded. The landlord can continue reviewing your application.";
    case "screening_in_progress":
      return "Screening is in progress.";
    case "completed":
      return "Screening workflow completed.";
    case "manual_review":
      return "This screening may require manual review.";
    case "blocked":
      if (String(item.nextAction || "").trim().toLowerCase() === "provider_activation_pending") {
        return "Your consent may be recorded, but the landlord may still need to complete screening setup.";
      }
      return "Screening cannot proceed yet.";
    default:
      return "Screening status is currently unavailable.";
  }
}

function nextAction(status: TenantScreeningInboxStatus): TenantScreeningInboxNextAction {
  switch (status) {
    case "consent_required":
      return "authorize_screening";
    case "consent_confirmed":
      return "view_status";
    case "screening_in_progress":
      return "view_status";
    case "completed":
      return "no_action_needed";
    case "manual_review":
      return "view_status";
    case "blocked":
      return "wait_for_landlord";
    default:
      return "view_status";
  }
}

function nextActionLabel(action: TenantScreeningInboxNextAction) {
  switch (action) {
    case "authorize_screening":
      return "Authorize screening";
    case "wait_for_landlord":
      return "Wait for landlord";
    case "view_status":
      return "View status";
    default:
      return "No action needed";
  }
}

function propertyContext(item: TenantScreeningRequest) {
  const label = [item.propertyLabel, item.unitLabel].filter(Boolean).join(" - ");
  return label || "Rental application";
}

function requesterLabel(item: TenantScreeningRequest) {
  const label = String(item.requesterDisplayLabel || "").trim();
  return label || "your landlord";
}

function requestContext(item: TenantScreeningRequest) {
  const propertyLabel = propertyContext(item);
  if (propertyLabel === "Rental application") {
    return "Requested for your rental application.";
  }
  return `Requested for ${propertyLabel}.`;
}

function consentLabel(item: TenantScreeningRequest, status: TenantScreeningInboxStatus) {
  if (item.consent?.acceptedAt || item.consentedAt) return "Consent confirmed";
  if (status === "consent_required") return "Consent required";
  return "Consent not needed yet";
}

function latestActivityAt(item: TenantScreeningRequest) {
  return item.completedAt || item.startedAt || item.consentedAt || item.requestedAt || null;
}

export function buildTenantScreeningInboxItemView(item: TenantScreeningRequest): TenantScreeningInboxItemView {
  const status = normalizeTenantScreeningStatus(item);
  const resolvedNextAction = item.tenantNextAction || nextAction(status);
  return {
    id: item.id,
    status,
    statusLabel: item.tenantStatusLabel || statusLabel(status),
    description: statusDescription(item, status),
    nextAction: resolvedNextAction,
    nextActionLabel: nextActionLabel(resolvedNextAction),
    providerLabel: resolveProviderLabel(item),
    requesterLabel: requesterLabel(item),
    propertyContext: propertyContext(item),
    requestContext: requestContext(item),
    requestedAt: item.requestedAt || null,
    activityAt: latestActivityAt(item),
    consentedAt: item.consent?.acceptedAt || item.consentedAt || null,
    consentLabel: consentLabel(item, status),
  };
}

export function buildTenantScreeningDashboardSummary(items: TenantScreeningRequest[]) {
  const ordered = [...items].sort(
    (a, b) =>
      (b.completedAt || b.startedAt || b.consentedAt || b.requestedAt || 0) -
      (a.completedAt || a.startedAt || a.consentedAt || a.requestedAt || 0),
  );
  const views = ordered.map(buildTenantScreeningInboxItemView);
  const pendingConsentCount = views.filter((item) => item.status === "consent_required").length;
  return {
    total: views.length,
    pendingConsentCount,
    latest: views[0] || null,
  };
}
