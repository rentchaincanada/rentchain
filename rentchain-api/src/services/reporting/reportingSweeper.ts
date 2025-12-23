import { db } from "../../config/firebase";
import { getStuckThresholdMinutes, getSweepLimit } from "./reportingConfig";

export async function sweepStuckSubmissions(opts?: {
  olderThanMinutes?: number;
  limit?: number;
  dryRun?: boolean;
}): Promise<{
  scanned: number;
  matched: number;
  requeued: number;
  sampleIds: string[];
}> {
  const olderThanMinutes = opts?.olderThanMinutes ?? getStuckThresholdMinutes();
  const limit = opts?.limit ?? getSweepLimit();
  const dryRun = !!opts?.dryRun;

  const now = Date.now();
  const thresholdMs = olderThanMinutes * 60 * 1000;
  const cutoff = now - thresholdMs;

  const snap = await db
    .collection("reportingSubmissions")
    .where("status", "==", "processing")
    .limit(limit)
    .get();

  let matched = 0;
  let requeued = 0;
  const sampleIds: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const started = data.processingStartedAt ? Date.parse(data.processingStartedAt) : 0;
    if (!started || started >= cutoff) continue;
    matched += 1;
    if (sampleIds.length < 5) sampleIds.push(doc.id);

    if (!dryRun) {
      await doc.ref.update({
        status: "queued",
        processingStartedAt: null,
        processingLockId: null,
        lastError: "stuck_processing_requeued",
        updatedAt: new Date().toISOString(),
      });
      requeued += 1;
    }
  }

  return {
    scanned: snap.size,
    matched,
    requeued,
    sampleIds,
  };
}
