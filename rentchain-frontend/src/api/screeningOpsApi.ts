import { apiFetch } from "./apiFetch";

export type ScreeningOperationStatus =
  | "requested"
  | "in_progress"
  | "completed"
  | "cancelled";

export type LandlordScreeningStatus =
  | "not_started"
  | "blocked_transunion_not_connected"
  | ScreeningOperationStatus;

export type ScreeningStatusView = {
  status: LandlordScreeningStatus;
  provider: "transunion_manual" | null;
  requestedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  resultSummary: string | null;
  resultFlags: string[];
  reportAvailable: boolean;
  reportUrl: string | null;
  reportExportId: string | null;
  actionLabel: string;
  actionPath: string;
  operationId: string | null;
};

export type ScreeningOperation = {
  id: string;
  applicationId: string;
  landlordId: string;
  propertyId?: string | null;
  unitId?: string | null;
  applicantName?: string | null;
  provider: "transunion_manual";
  status: ScreeningOperationStatus;
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  resultSummary?: string | null;
  resultFlags?: string[];
  reportUrl?: string | null;
  reportExportId?: string | null;
  operatorNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByUserId?: string | null;
};

export async function requestManualScreening(applicationId: string) {
  return apiFetch<{ operation: ScreeningOperation; status: ScreeningStatusView }>(
    `/rental-applications/${encodeURIComponent(applicationId)}/screening/request`,
    { method: "POST", body: {} }
  );
}

export async function getScreeningStatus(applicationId: string) {
  return apiFetch<ScreeningStatusView>(
    `/rental-applications/${encodeURIComponent(applicationId)}/screening/status`
  );
}

export async function getAdminScreeningOps(params?: { status?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<{ operations: ScreeningOperation[] }>(`/admin/screening-ops${suffix}`);
}

export async function getAdminScreeningOp(id: string) {
  return apiFetch<{ operation: ScreeningOperation }>(`/admin/screening-ops/${encodeURIComponent(id)}`);
}

export async function startAdminScreeningOp(id: string) {
  return apiFetch<{ operation: ScreeningOperation }>(
    `/admin/screening-ops/${encodeURIComponent(id)}/start`,
    { method: "POST", body: {} }
  );
}

export async function completeAdminScreeningOp(
  id: string,
  payload: {
    resultSummary?: string | null;
    resultFlags?: string[];
    reportUrl?: string | null;
    reportExportId?: string | null;
    operatorNotes?: string | null;
  }
) {
  return apiFetch<{ operation: ScreeningOperation }>(
    `/admin/screening-ops/${encodeURIComponent(id)}/complete`,
    { method: "POST", body: payload }
  );
}

export async function cancelAdminScreeningOp(
  id: string,
  payload: {
    cancelledReason?: string | null;
  }
) {
  return apiFetch<{ operation: ScreeningOperation }>(
    `/admin/screening-ops/${encodeURIComponent(id)}/cancel`,
    { method: "POST", body: payload }
  );
}
