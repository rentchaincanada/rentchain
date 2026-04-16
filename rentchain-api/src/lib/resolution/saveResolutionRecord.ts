import { db } from "../../config/firebase";
import type { ResolutionRecordV1 } from "./resolutionTypes";
import { ADMIN_RESOLUTIONS_COLLECTION } from "./loadResolutionRecord";

export async function saveResolutionRecord(record: ResolutionRecordV1) {
  await db.collection(ADMIN_RESOLUTIONS_COLLECTION).doc(record.id).set(record, { merge: false });
  return record;
}
