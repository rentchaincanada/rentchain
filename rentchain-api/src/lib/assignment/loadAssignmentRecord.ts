import crypto from "crypto";
import { db } from "../../firebase";
import type { AssignmentRecordV1 } from "./assignmentTypes";

export const ADMIN_ASSIGNMENTS_COLLECTION = "adminAssignments";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export function assignmentRecordId(resourceType: string, resourceId: string) {
  return crypto
    .createHash("sha256")
    .update(`${asString(resourceType, 120)}:${asString(resourceId, 240)}`)
    .digest("hex");
}

export async function loadAllAssignmentRecords(): Promise<AssignmentRecordV1[]> {
  const snap = await db.collection(ADMIN_ASSIGNMENTS_COLLECTION).get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as AssignmentRecordV1);
}

export async function loadAssignmentRecord(input: {
  resourceType: string;
  resourceId: string;
}): Promise<AssignmentRecordV1 | null> {
  const resourceType = asString(input.resourceType, 120);
  const resourceId = asString(input.resourceId, 240);
  if (!resourceType || !resourceId) return null;
  const snap = await db.collection(ADMIN_ASSIGNMENTS_COLLECTION).doc(assignmentRecordId(resourceType, resourceId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() || {}) } as AssignmentRecordV1;
}
