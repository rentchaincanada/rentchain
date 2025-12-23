import { apiFetch } from "./http";

export async function getTenantReportingConsent() {
  return apiFetch<{ status: string; consentId?: string }>("tenant/reporting/consent");
}

export async function grantTenantReportingConsent(landlordId: string) {
  return apiFetch<{ status: string }>("tenant/reporting/consent/grant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landlordId }),
  });
}

export async function revokeTenantReportingConsent(landlordId: string) {
  return apiFetch<{ status: string }>("tenant/reporting/consent/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landlordId }),
  });
}

export async function inviteTenantForReporting(tenantId: string) {
  return apiFetch<{ status: string; consentUrl: string }>("landlord/reporting/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId }),
  });
}

export async function queueReporting(tenantId: string, months = 12) {
  return apiFetch<{ ok: boolean; created: number }>("landlord/reporting/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, months }),
  });
}

export async function getReportingStatus(tenantId: string) {
  return apiFetch<{
    consentStatus: string;
    lastSubmission: any;
    submissions: any[];
  }>(`landlord/reporting/status?tenantId=${encodeURIComponent(tenantId)}`);
}
