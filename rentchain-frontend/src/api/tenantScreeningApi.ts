import { tenantApiFetch } from "./tenantApiFetch";

export type TenantScreeningStatus =
  | "requested"
  | "consent_pending"
  | "consented"
  | "in_progress"
  | "completed"
  | "inconclusive"
  | "failed"
  | "manual_review_required";

export type TenantScreeningResultStatus =
  | "pending"
  | "completed"
  | "inconclusive"
  | "failed"
  | "manual_review_required";

export type TenantScreeningReturnState =
  | "completed"
  | "pending"
  | "action_needed"
  | "expired"
  | "unable_to_complete"
  | "callback_received_but_not_finalized";

export type TenantScreeningSessionStatus =
  | "created"
  | "ready_for_consent"
  | "consent_received"
  | "redirect_pending"
  | "in_progress"
  | "pending_review"
  | "completed"
  | "inconclusive"
  | "failed"
  | "expired";

export type TenantScreeningRequest = {
  id: string;
  rentalApplicationId: string | null;
  status: TenantScreeningStatus;
  normalizedResultStatus: TenantScreeningResultStatus;
  requestedAt: number | null;
  consentedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  provider: string | null;
  providerLabel?: string | null;
  packageType: string | null;
  payerType: string | null;
  propertyLabel: string | null;
  unitLabel: string | null;
  applicantName: string | null;
  nextAction: string | null;
  consent: {
    id: string;
    requestId?: string;
    tenantId?: string | null;
    applicantId?: string | null;
    rentalApplicationId?: string | null;
    landlordId?: string | null;
    propertyId?: string | null;
    providerKey?: string | null;
    providerLabel?: string | null;
    consentVersion?: string | null;
    consentTextSummary?: string | null;
    viewedAt: number | null;
    acceptedAt: number | null;
    acceptedBy?: string | null;
    providerDisclosure: string | null;
    disclosureVersion: string | null;
  } | null;
  session: {
    id: string;
    providerKey: string;
    status: TenantScreeningSessionStatus;
    providerSessionStatus?: string | null;
    handoffType: "manual" | "redirect";
    redirectUrl: string | null;
    returnUrl: string | null;
    expiresAt: number | null;
    redirect?: {
      eligible: boolean;
      prepared: boolean;
      preparedAt: number | null;
      lastUpdatedAt: number | null;
      status: "not_applicable" | "prepared" | "blocked" | "expired" | "consumed";
      activationEnabled: boolean;
    } | null;
    returnState?: TenantScreeningReturnState | null;
    callbackReceivedAt?: number | null;
  } | null;
  result: {
    id: string;
    status: TenantScreeningResultStatus;
    summary: string | null;
    normalizedDecision: string | null;
    identityVerified?: boolean | null;
    creditIncluded?: boolean | null;
    incomeIncluded?: boolean | null;
    fraudFlags?: string[];
    providerStatusMapped?: string | null;
    reportAvailability?: {
      summaryAvailable: boolean;
      fullReportAvailable: boolean;
    } | null;
    reportAvailable: boolean;
  } | null;
  returnFlow?: {
    state: TenantScreeningReturnState;
    callbackReceivedAt: number | null;
    resolvedAt: number | null;
    isFinalized: boolean;
  } | null;
  summary: {
    status: TenantScreeningStatus;
    provider: string;
    requestedDate: number | null;
    package: string | null;
    summaryResult: string;
    nextActions: string[];
    returnState?: TenantScreeningReturnState;
  };
  auditTrail: Array<{
    id: string;
    eventType: string | null;
    actorRole: string | null;
    createdAt: number | null;
    metadata: Record<string, unknown>;
  }>;
};

export async function listTenantScreenings() {
  return tenantApiFetch<{ ok: boolean; items: TenantScreeningRequest[] }>("/tenant/screening");
}

export async function getTenantScreeningStatus(requestId: string) {
  return tenantApiFetch<{ ok: boolean; screeningRequest: TenantScreeningRequest }>(
    `/tenant/screening/${encodeURIComponent(requestId)}/status`
  );
}

export async function markTenantScreeningViewed(
  requestId: string,
  input?: { providerDisclosure?: string; disclosureVersion?: string; consentSummary?: string }
) {
  return tenantApiFetch<{ ok: boolean; screeningRequest: TenantScreeningRequest }>(
    `/tenant/screening/${encodeURIComponent(requestId)}/consent`,
    {
      method: "POST",
      body: {
        viewed: true,
        providerDisclosure: input?.providerDisclosure,
        disclosureVersion: input?.disclosureVersion,
        consentSummary: input?.consentSummary,
      },
    }
  );
}

export async function acceptTenantScreeningConsent(
  requestId: string,
  input?: { providerDisclosure?: string; disclosureVersion?: string; consentSummary?: string }
) {
  return tenantApiFetch<{ ok: boolean; screeningRequest: TenantScreeningRequest }>(
    `/tenant/screening/${encodeURIComponent(requestId)}/consent`,
    {
      method: "POST",
      body: {
        accepted: true,
        providerDisclosure: input?.providerDisclosure,
        disclosureVersion: input?.disclosureVersion,
        consentSummary: input?.consentSummary,
      },
    }
  );
}

export async function startTenantScreening(requestId: string) {
  return tenantApiFetch<{ ok: boolean; screeningRequest: TenantScreeningRequest }>(
    `/tenant/screening/${encodeURIComponent(requestId)}/start`,
    {
      method: "POST",
    }
  );
}

export async function retryTenantScreening(requestId: string) {
  return tenantApiFetch<{ ok: boolean; screeningRequest: TenantScreeningRequest }>(
    `/tenant/screening/${encodeURIComponent(requestId)}/retry`,
    {
      method: "POST",
    }
  );
}

export async function markTenantScreeningMessageRead(requestId: string) {
  return tenantApiFetch<{ ok: boolean }>(`/tenant/messages/screening/${encodeURIComponent(requestId)}/read`, {
    method: "POST",
  });
}
