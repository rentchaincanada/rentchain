import { apiFetch } from "./apiFetch";

export type ScreeningJobLifecycleStatus =
  | "queued"
  | "running"
  | "provider_calling"
  | "completed"
  | "failed";

export type ScreeningJobStatusView = {
  orderId: string;
  applicationId: string | null;
  landlordId: string | null;
  status: ScreeningJobLifecycleStatus;
  provider: string | null;
  attempt: number;
  queuedAt: number | null;
  startedAt: number | null;
  providerCalledAt: number | null;
  completedAt: number | null;
  failedAt: number | null;
  lastError: { code?: string; message?: string } | null;
  updatedAt: number | null;
};

export async function getScreeningJobStatus(params: {
  orderId?: string;
  applicationId?: string;
}): Promise<{ ok: boolean; data: ScreeningJobStatusView }> {
  const query = new URLSearchParams();
  if (params.orderId) {
    query.set("orderId", params.orderId);
  } else if (params.applicationId) {
    query.set("applicationId", params.applicationId);
  }
  const res = (await apiFetch(`/screening/jobs/status?${query.toString()}`)) as {
    ok: boolean;
    data: ScreeningJobStatusView;
  };
  return res;
}

