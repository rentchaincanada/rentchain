import { apiFetch } from "./apiFetch";

export type ProviderNeutralScreeningStatus =
  | "pending"
  | "provider_pending"
  | "completed"
  | "manual_completed"
  | "failed"
  | "expired";

export type ScreeningConsentProjection = {
  consentId: string;
  tenantId: string;
  landlordId: string;
  unitId: string;
  status: "active" | "revoked";
  grantedAt: string;
  revokedAt: string | null;
};

export type ScreeningRequestProjection = {
  requestId: string;
  unitId: string;
  tenantId: string;
  status: ProviderNeutralScreeningStatus;
  initiatedAt: string;
  resultReceivedAt: string | null;
  decisionStatus: "not_started" | "approve" | "deny" | "review_needed";
  manualReportUploadedAt: string | null;
};

export type ScreeningResultProjection = {
  requestId: string;
  riskScore: number | null;
  decisionRecommendation: "approve" | "deny" | "review_needed" | null;
  summary: string | null;
  flags: string[];
};

export async function grantScreeningConsent(input: {
  tenantId: string;
  landlordId: string;
  unitId: string;
}) {
  return apiFetch<{ ok: true; consent: ScreeningConsentProjection }>(
    `/tenant/${encodeURIComponent(input.tenantId)}/screeningConsent`,
    {
      method: "POST",
      body: {
        landlordId: input.landlordId,
        unitId: input.unitId,
      },
    },
  );
}

export async function revokeScreeningConsent(tenantId: string, consentId: string) {
  return apiFetch<{ ok: true; consent: ScreeningConsentProjection }>(
    `/tenant/${encodeURIComponent(tenantId)}/screeningConsent/${encodeURIComponent(consentId)}`,
    { method: "DELETE" },
  );
}

export async function listScreeningConsents(tenantId: string) {
  return apiFetch<{ ok: true; consents: ScreeningConsentProjection[] }>(
    `/tenant/${encodeURIComponent(tenantId)}/screeningConsent`,
  );
}

export async function initiateScreeningRequest(input: {
  unitId: string;
  tenantId: string;
  consentId: string;
  providerId?: string;
}) {
  return apiFetch<{ ok: true; requestId: string; status: ProviderNeutralScreeningStatus; initiatedAt: string }>(
    `/landlord/units/${encodeURIComponent(input.unitId)}/screeningRequest`,
    {
      method: "POST",
      body: {
        tenantId: input.tenantId,
        consentId: input.consentId,
        providerId: input.providerId || undefined,
      },
    },
  );
}

export async function listScreeningRequests(unitId: string) {
  return apiFetch<{ ok: true; requests: ScreeningRequestProjection[] }>(
    `/landlord/units/${encodeURIComponent(unitId)}/screeningRequest`,
  );
}

export async function getScreeningRequest(unitId: string, requestId: string) {
  return apiFetch<{ ok: true; request: ScreeningRequestProjection }>(
    `/landlord/units/${encodeURIComponent(unitId)}/screeningRequest/${encodeURIComponent(requestId)}`,
  );
}

export async function getScreeningResult(unitId: string, requestId: string) {
  return apiFetch<{ ok: true; result: ScreeningResultProjection }>(
    `/landlord/units/${encodeURIComponent(unitId)}/screeningRequest/${encodeURIComponent(requestId)}/result`,
    { allow404: true },
  );
}

export async function recordScreeningDecision(input: {
  unitId: string;
  requestId: string;
  decision: "approve" | "deny" | "review_needed";
  reason: string;
  notes?: string;
}) {
  return apiFetch<{ ok: true; decisionId: string; decisionStatus: string; decidedAt: string }>(
    `/landlord/units/${encodeURIComponent(input.unitId)}/screeningRequest/${encodeURIComponent(input.requestId)}/decision`,
    {
      method: "POST",
      body: {
        decision: input.decision,
        reason: input.reason,
        notes: input.notes || "",
      },
    },
  );
}

export async function uploadManualScreeningReport(input: {
  unitId: string;
  requestId: string;
  file: File;
}) {
  const body = new FormData();
  body.append("file", input.file);
  return apiFetch<{ ok: true; reportUrl: string; uploadedAt: string }>(
    `/landlord/units/${encodeURIComponent(input.unitId)}/screeningRequest/${encodeURIComponent(input.requestId)}/manualReport`,
    {
      method: "POST",
      body,
    },
  );
}
