import { db } from "../config/firebase";

export type ScreeningJobStatus = "queued" | "running" | "provider_calling" | "completed" | "failed";

export type ScreeningJob = {
  id: string;
  orderId: string;
  applicationId: string;
  landlordId: string | null;
  provider: string | null;
  status: ScreeningJobStatus;
  attempt: number;
  queuedAt: number;
  startedAt: number | null;
  providerCalledAt: number | null;
  completedAt: number | null;
  failedAt: number | null;
  lastError: { code?: string; message?: string } | null;
  updatedAt: number;
  lockOwner: string | null;
  lockExpiresAt: number | null;
  traceId?: string | null;
  lastStep?: string | null;
  retryEligible?: boolean;
};

const DEFAULT_PROVIDER = "stub";
const STATUS_RANK: Record<ScreeningJobStatus, number> = {
  queued: 1,
  running: 2,
  provider_calling: 3,
  completed: 4,
  failed: 4,
};

function nowMs() {
  return Date.now();
}

function lockOwnerId() {
  return process.env.K_REVISION || "local";
}

function normalizeStatus(value: unknown): ScreeningJobStatus {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "queued") return "queued";
  if (raw === "running") return "running";
  if (raw === "provider_calling") return "provider_calling";
  if (raw === "completed" || raw === "complete") return "completed";
  if (raw === "failed") return "failed";

  const legacy = String(value || "").trim().toUpperCase();
  if (legacy === "QUEUED") return "queued";
  if (legacy === "RUNNING") return "running";
  if (legacy === "COMPLETE") return "completed";
  if (legacy === "FAILED") return "failed";
  return "queued";
}

function normalizeProvider(value: unknown): string | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === "stub") return "stub";
  if (raw === "verified") return "verified";
  return raw;
}

export function canProgressJobStatus(
  current: ScreeningJobStatus,
  next: ScreeningJobStatus,
  allowRetry = false
): boolean {
  if (current === next) return true;
  if (current === "completed") return false;
  if (current === "failed") {
    return allowRetry && next === "queued";
  }
  return STATUS_RANK[next] >= STATUS_RANK[current];
}

export async function setScreeningJobStatus(args: {
  orderId: string;
  status: ScreeningJobStatus;
  patch?: Record<string, unknown>;
  allowRetry?: boolean;
}) {
  const orderId = String(args.orderId || "").trim();
  if (!orderId) return { ok: false as const, error: "missing_order_id" as const };

  const jobRef = db.collection("screeningJobs").doc(orderId);
  const now = nowMs();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) {
      return { ok: false as const, error: "not_found" as const };
    }

    const existing = (snap.data() || {}) as any;
    const currentStatus = normalizeStatus(existing.status);
    const nextStatus = normalizeStatus(args.status);
    const canProgress = canProgressJobStatus(currentStatus, nextStatus, Boolean(args.allowRetry));
    if (!canProgress) {
      return { ok: true as const, applied: false, status: currentStatus };
    }

    tx.set(
      jobRef,
      {
        status: nextStatus,
        updatedAt: now,
        ...(args.patch || {}),
      },
      { merge: true }
    );
    return { ok: true as const, applied: true, status: nextStatus };
  });
}

export async function enqueueScreeningJob(args: {
  orderId: string;
  applicationId: string;
  landlordId?: string | null;
  provider?: string | null;
}) {
  const orderId = String(args.orderId || "").trim();
  const applicationId = String(args.applicationId || "").trim();
  if (!orderId || !applicationId) {
    return { ok: false, error: "missing_order_or_application" as const };
  }

  const jobRef = db.collection("screeningJobs").doc(orderId);
  const queuedAt = nowMs();
  const result = await db.runTransaction(async (tx) => {
    const existingSnap = await tx.get(jobRef);
    const existing = existingSnap.exists ? ((existingSnap.data() || {}) as any) : null;
    const existingStatus = existing ? normalizeStatus(existing.status) : null;
    if (existingStatus && (existingStatus === "queued" || existingStatus === "running" || existingStatus === "provider_calling")) {
      return { ok: true as const, alreadyQueued: true as const, jobId: orderId };
    }
    if (existingStatus && (existingStatus === "completed" || existingStatus === "failed")) {
      return { ok: true as const, alreadyQueued: true as const, jobId: orderId };
    }

    const attempt = Number(existing?.attempt || 0) > 0 ? Number(existing.attempt) : 1;
    const job: ScreeningJob = {
      id: orderId,
      orderId,
      applicationId,
      landlordId: args.landlordId ?? existing?.landlordId ?? null,
      provider: normalizeProvider(args.provider || existing?.provider || DEFAULT_PROVIDER),
      status: "queued",
      attempt,
      queuedAt: Number(existing?.queuedAt || queuedAt),
      startedAt: null,
      providerCalledAt: null,
      completedAt: null,
      failedAt: null,
      lastError: null,
      updatedAt: queuedAt,
      lockOwner: null,
      lockExpiresAt: null,
      traceId: existing?.traceId || null,
      lastStep: "queued",
      retryEligible: existing?.retryEligible ?? false,
    };

    tx.set(jobRef, job, { merge: true });
    return { ok: true as const, jobId: orderId };
  });

  console.log("[screening-jobs] enqueue", { orderId, jobId: orderId, alreadyQueued: Boolean((result as any).alreadyQueued) });
  return result;
}

export async function claimNextJob(args?: { maxLockMs?: number }) {
  const maxLockMs = args?.maxLockMs ?? 5 * 60 * 1000;
  const lockOwner = lockOwnerId();
  const now = nowMs();

  const snap = await db
    .collection("screeningJobs")
    .where("status", "==", "queued")
    .orderBy("queuedAt", "asc")
    .limit(1)
    .get();
  if (snap.empty) {
    return { ok: true, job: null };
  }

  const jobRef = snap.docs[0].ref;
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(jobRef);
    if (!fresh.exists) return { ok: true, job: null };
    const data = (fresh.data() || {}) as any;
    const status = normalizeStatus(data.status);
    if (status !== "queued") return { ok: true, job: null };

    const attempt = (Number(data.attempt || 0) || 0) + 1;
    tx.set(
      jobRef,
      {
        status: "running",
        startedAt: now,
        attempt,
        updatedAt: now,
        lastStep: "running",
        lockOwner,
        lockExpiresAt: now + maxLockMs,
      },
      { merge: true }
    );

    console.log("[screening-jobs] claim", { jobId: jobRef.id });
    return {
      ok: true,
      job: {
        ...data,
        id: jobRef.id,
        orderId: String(data.orderId || jobRef.id),
        status: "running",
        attempt,
        provider: normalizeProvider(data.provider),
      } as ScreeningJob,
    };
  });
}

export async function runJob(job: ScreeningJob) {
  const now = nowMs();
  const orderRef = db.collection("screeningOrders").doc(job.orderId);
  const appRef = db.collection("rentalApplications").doc(job.applicationId);
  const jobRef = db.collection("screeningJobs").doc(job.id);

  try {
    await setScreeningJobStatus({
      orderId: job.orderId,
      status: "running",
      patch: {
        startedAt: now,
        lockOwner: lockOwnerId(),
        lockExpiresAt: now + 5 * 60 * 1000,
        lastStep: "running",
      },
    });

    await orderRef.set(
      {
        processingStatus: "IN_PROGRESS",
        processingStartedAt: now,
        provider: job.provider,
      },
      { merge: true }
    );
    await appRef.set(
      {
        screening: {
          status: "in_progress",
          startedAt: now,
          provider: job.provider,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    const providerCalledAt = nowMs();
    await setScreeningJobStatus({
      orderId: job.orderId,
      status: "provider_calling",
      patch: {
        providerCalledAt,
        updatedAt: providerCalledAt,
        lastStep: "provider_calling",
      },
    });

    const finishedAt = nowMs();
    await orderRef.set(
      {
        processingStatus: "COMPLETE",
        processingFinishedAt: finishedAt,
        provider: job.provider,
      },
      { merge: true }
    );
    await appRef.set(
      {
        screening: {
          status: "complete",
          finishedAt,
          provider: job.provider,
        },
        updatedAt: finishedAt,
      },
      { merge: true }
    );

    await jobRef.set(
      {
        status: "completed",
        completedAt: finishedAt,
        failedAt: null,
        lockOwner: null,
        lockExpiresAt: null,
        lastError: null,
        updatedAt: finishedAt,
        lastStep: "completed",
        retryEligible: false,
      },
      { merge: true }
    );

    console.log("[screening-jobs] complete", { jobId: job.id });
    return { ok: true };
  } catch (err: any) {
    const message = String(err?.message || "UNKNOWN_ERROR");
    const code = String(err?.code || "provider_error");
    const failedAt = nowMs();
    await jobRef.set(
      {
        status: "failed",
        failedAt,
        lastError: { code, message: message.slice(0, 256) },
        lockOwner: null,
        lockExpiresAt: null,
        updatedAt: failedAt,
        lastStep: "failed",
        retryEligible: true,
      },
      { merge: true }
    );
    await orderRef.set(
      {
        processingStatus: "FAILED",
        processingFailedAt: failedAt,
      },
      { merge: true }
    );
    console.error("[screening-jobs] failed", { jobId: job.id, error: message, code });
    return { ok: false, error: message };
  }
}
