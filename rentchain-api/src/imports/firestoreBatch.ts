import { db } from "../config/firebase";

export async function commitInBatches(
  ops: ((batch: FirebaseFirestore.WriteBatch) => void)[],
  batchSize = 400
) {
  for (let i = 0; i < ops.length; i += batchSize) {
    const chunk = ops.slice(i, i + batchSize);
    const batch = db.batch();
    for (const fn of chunk) fn(batch);
    await batch.commit();
  }
}
