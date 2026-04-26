import type { AssignmentRecordV1 } from "./assignmentTypes";
import { saveAssignmentRecord } from "./saveAssignmentRecord";

export async function updateAssignmentRecord(record: AssignmentRecordV1) {
  return await saveAssignmentRecord(record);
}
