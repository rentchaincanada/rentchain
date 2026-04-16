import { apiFetch } from "./apiFetch";
import type { AssignmentRecordV1 } from "./supportConsoleApi";

export async function fetchAssignment(resourceType: string, resourceId: string): Promise<{ assignment: AssignmentRecordV1 | null }> {
  const search = new URLSearchParams();
  search.set("resourceType", resourceType);
  search.set("resourceId", resourceId);
  return await apiFetch<{ assignment: AssignmentRecordV1 | null }>(`/admin/assignments?${search.toString()}`);
}

export async function createAssignment(payload: {
  resourceType: string;
  resourceId: string;
  ownerId?: string | null;
  ownerLabel?: string | null;
  note?: string | null;
}): Promise<{ assignment: AssignmentRecordV1 }> {
  return await apiFetch<{ assignment: AssignmentRecordV1 }>(`/admin/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssignment(
  assignmentId: string,
  payload: {
    ownerId?: string | null;
    ownerLabel?: string | null;
    note?: string | null;
  }
): Promise<{ assignment: AssignmentRecordV1 }> {
  return await apiFetch<{ assignment: AssignmentRecordV1 }>(`/admin/assignments/${encodeURIComponent(assignmentId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
