import { db } from "../../firebase";
import type { AssignmentRecordV1 } from "./assignmentTypes";
import { ADMIN_ASSIGNMENTS_COLLECTION } from "./loadAssignmentRecord";

export async function saveAssignmentRecord(record: AssignmentRecordV1) {
  await db.collection(ADMIN_ASSIGNMENTS_COLLECTION).doc(record.id).set(record, { merge: false });
  return record;
}
