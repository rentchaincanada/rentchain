import { db } from "../../config/firebase";
import { getReportingRuntimeConfig } from "./reportingConfig";
import { getProvider } from "../creditReporting/providerFactory";
import { getTenantCreditHistory } from "../tenantCreditProfileService";
import { toMetro2LikeRecords } from "../creditReporting/metro2Model";
import { v4 as uuid } from "uuid";

const FINAL_STATES = ["accepted", "rejected", "failed_final"];

export async function processSubmission(submissionId: string): Promise<void> {
  const cfg = await getReportingRuntimeConfig();
  if (!cfg.enabled) {
    // Quietly skip processing when paused; leave status as-is so it can resume later.
    return;
  }
  if (!cfg.dryRun) {
    // Phase 3.2A: live reporting disabled.
    return;
  }
  const ref = db.collection("reportingSubmissions").doc(submissionId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() as any;

  if (FINAL_STATES.includes(data.status)) return; // idempotent

  const now = new Date().toISOString();
  const lockId = uuid();

  // If attempts exceed max, finalize
  if ((data.attempts || 0) >= cfg.maxAttempts) {
    await ref.update({ status: "failed_final", lastError: "max_attempts_reached" });
    return;
  }

  // Try to lock
  await ref.update({
    status: "processing",
    processingStartedAt: now,
    processingLockId: lockId,
  });

  const attempt = (data.attempts || 0) + 1;

  try {
    const provider = getProvider(data.providerKey || "mock");
    provider.validateConfig();

    // Rebuild records for the specific period to ensure freshness
    const history = await getTenantCreditHistory({
      tenantId: data.tenantId,
      landlordId: data.landlordId,
      months: 1,
    });
    const records = toMetro2LikeRecords({
      tenantId: data.tenantId,
      landlordId: data.landlordId,
      leaseId: history.leaseId,
      periods: history.periods.filter((p) => p.period === data.period),
    });

    const payload = provider.buildPayload({ records, meta: { submissionId } });

    // Dry run short-circuit
    if (cfg.dryRun) {
      await ref.update({
        status: "accepted",
        attempts: attempt,
        submittedAt: now,
        processingStartedAt: null,
        processingLockId: null,
        snapshot: payload,
      });
      return;
    }

    const result = await provider.submit(payload);
    const status =
      result.status === "accepted"
        ? "accepted"
        : result.status === "rejected"
        ? "rejected"
        : attempt >= cfg.maxAttempts
        ? "failed_final"
        : "failed_retryable";

    await ref.update({
      status,
      attempts: attempt,
      lastError: result.message || null,
      submittedAt: status === "accepted" ? now : null,
      processingStartedAt: null,
      processingLockId: null,
    });
  } catch (err: any) {
    const status = attempt >= cfg.maxAttempts ? "failed_final" : "failed_retryable";
    await ref.update({
      status,
      attempts: attempt,
      lastError: err?.message || "processing_error",
      submittedAt: null,
      processingStartedAt: null,
      processingLockId: null,
    });
  }
}
