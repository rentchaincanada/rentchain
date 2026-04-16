import { apiFetch } from "./apiFetch";
import type { ResolutionRecordV1, ResolutionStatus } from "./supportConsoleApi";

export async function fetchResolution(resourceType: string, resourceId: string): Promise<{ resolution: ResolutionRecordV1 | null }> {
  const search = new URLSearchParams();
  search.set("resourceType", resourceType);
  search.set("resourceId", resourceId);
  return await apiFetch<{ resolution: ResolutionRecordV1 | null }>(`/admin/resolutions?${search.toString()}`);
}

export async function createResolution(payload: {
  resourceType: string;
  resourceId: string;
  triageCategory?: string | null;
  triageSeverity?: string | null;
  reasonCode?: string | null;
  note?: string | null;
}): Promise<{ resolution: ResolutionRecordV1 }> {
  return await apiFetch<{ resolution: ResolutionRecordV1 }>(`/admin/resolutions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateResolutionStatus(
  resolutionId: string,
  payload: { status: Exclude<ResolutionStatus, "open">; reason?: string | null }
): Promise<{ resolution: ResolutionRecordV1 }> {
  return await apiFetch<{ resolution: ResolutionRecordV1 }>(`/admin/resolutions/${encodeURIComponent(resolutionId)}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function addResolutionNote(
  resolutionId: string,
  payload: { message: string }
): Promise<{ resolution: ResolutionRecordV1 }> {
  return await apiFetch<{ resolution: ResolutionRecordV1 }>(`/admin/resolutions/${encodeURIComponent(resolutionId)}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
