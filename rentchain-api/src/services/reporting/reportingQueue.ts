import { processSubmission } from "./reportingWorker";

/**
 * Minimal queue abstraction. In dev we process immediately.
 * Later this can enqueue Cloud Tasks calling /api/internal/reporting/process.
 */
export async function enqueueSubmission(submissionId: string): Promise<void> {
  // TODO: enqueue to Cloud Tasks; for now, process inline (dev-friendly)
  await processSubmission(submissionId);
}

export async function enqueueBatch(submissionIds: string[]): Promise<void> {
  for (const id of submissionIds) {
    // fire sequentially for now; can parallelize once queue exists
    await enqueueSubmission(id);
  }
}
