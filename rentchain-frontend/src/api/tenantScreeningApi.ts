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
  packageType: string | null;
  payerType: string | null;
  propertyLabel: string | null;
  unitLabel: string | null;
  applicantName: string | null;
  nextAction: string | null;
  consent: {
    id: string;
    viewedAt: number | null;
    acceptedAt: number | null;
    providerDisclosure: string | null;
    disclosureVersion: string | null;
  } | null;
  session: {
    id: string;
    providerKey: string;
    status: string;
    handoffType: "manual" | "redirect";
    redirectUrl: string | null;
    returnUrl: string | null;
    expiresAt: number | null;
  } | null;
  result: {
    id: string;
    status: TenantScreeningResultStatus;
    summary: string | null;
    normalizedDecision: string | null;
    reportAvailable: boolean;
    rawPayloadRef: string | null;
    fullReportStorageRef: string | null;
  } | null;
  summary: {
    status: TenantScreeningStatus;
    provider: string;
    requestedDate: number | null;
    package: string | null;
    summaryResult: string;
    nextActions: string[];
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
  input?: { providerDisclosure?: string; disclosureVersion?: string }
) {
  return tenantApiFetch<{ ok: boolean; screeningRequest: TenantScreeningRequest }>(
    `/tenant/screening/${encodeURIComponent(requestId)}/consent`,
    {
      method: "POST",
      body: {
        viewed: true,
        providerDisclosure: input?.providerDisclosure,
        disclosureVersion: input?.disclosureVersion,
      },
    }
  );
}

export async function acceptTenantScreeningConsent(
  requestId: string,
  input?: { providerDisclosure?: string; disclosureVersion?: string }
) {
  return tenantApiFetch<{ ok: boolean; screeningRequest: TenantScreeningRequest }>(
    `/tenant/screening/${encodeURIComponent(requestId)}/consent`,
    {
      method: "POST",
      body: {
        accepted: true,
        providerDisclosure: input?.providerDisclosure,
        disclosureVersion: input?.disclosureVersion,
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
