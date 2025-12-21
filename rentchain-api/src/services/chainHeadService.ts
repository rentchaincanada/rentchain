// rentchain-api/src/services/chainHeadService.ts
import { firestore } from "../config/firebase";

const COLLECTION = "chainHeads";

/**
 * Save a new chain head snapshot for a specific tenant.
 */
export async function saveChainHeadSnapshot(data: {
  tenantId: string;
  blockHeight: number;
  rootHash: string;
  eventId: string | null;
}) {
  const doc = {
    ...data,
    timestamp: new Date().toISOString(),
  };

  await firestore.collection(COLLECTION).add(doc);
  return doc;
}

/**
 * Retrieve the most recent chain head snapshot (any tenant).
 */
export async function getLatestChainHead() {
  const snap = await firestore
    .collection(COLLECTION)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;

  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}
