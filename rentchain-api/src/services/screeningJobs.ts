import { db } from "../config/firebase";

type ScreeningJobStatus = "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";

export type ScreeningJob = {
  id: string;
  orderId: string;
  applicationId: string;
  landlordId: string | null;
  provider: "STUB" | "VERIFIED";
  status: ScreeningJobStatus;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  attempts: number;
  lastError: string | null;
  lockOwner: string | null;
  lockExpiresAt: number | null;
};

const DEFAULT_PROVIDER: ScreeningJob["provider"] = "STUB";

function nowMs() {
  return Date.now();
}

function lockOwnerId() {
  return process.env.K_REVISION || "local";
}

export async function enqueueScreeningJob(args: {
  orderId: string;
  applicationId: string;
  landlordId?: string | null;
  provider?: ScreeningJob["provider"];
}) {
  const orderId = String(args.orderId || "").trim();
  const applicationId = String(args.applicationId || "").trim();
  if (!orderId || !applicationId) {
    return { ok: false, error: "missing_order_or_application" as const };
  }

  const existing = await db
    .collection("screeningJobs")
    .where("orderId", "==", orderId)
    .where("status", "in", ["QUEUED", "RUNNING"])
    .limit(1)
    .get();
  if (!existing.empty) {
    return { ok: true, alreadyQueued: true as const };
  }

  const jobRef = db.collection("screeningJobs").doc();
  const createdAt = nowMs();
  const job: ScreeningJob = {
    id: jobRef.id,
    orderId,
    applicationId,
    landlordId: args.landlordId ?? null,
    provider: args.provider || DEFAULT_PROVIDER,
    status: "QUEUED",
    createdAt,
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    lastError: null,
    lockOwner: null,
    lockExpiresAt: null,
  };

  await jobRef.set(job, { merge: true });
  console.log("[screening-jobs] enqueue", { orderId, jobId: jobRef.id });
  return { ok: true, jobId: jobRef.id };
}

export async function claimNextJob(args?: { maxLockMs?: number }) {
  const maxLockMs = args?.maxLockMs ?? 5 * 60 * 1000;
  const lockOwner = lockOwnerId();
  const now = nowMs();

  const snap = await db
    .collection("screeningJobs")
    .where("status", "==", "QUEUED")
    .orderBy("createdAt", "asc")
    .limit(1)
    .get();
  if (snap.empty) {
    return { ok: true, job: null };
  }

  const jobRef = snap.docs[0].ref;
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(jobRef);
    if (!fresh.exists) return { ok: true, job: null };
    const data = fresh.data() as ScreeningJob;
    if (data.status !== "QUEUED") return { ok: true, job: null };

    const attempts = (data.attempts || 0) + 1;
    tx.set(
      jobRef,
      {
        status: "RUNNING",
        startedAt: now,
        attempts,
        lockOwner,
        lockExpiresAt: now + maxLockMs,
      },
      { merge: true }
    );

    console.log("[screening-jobs] claim", { jobId: jobRef.id });
    return { ok: true, job: { ...data, id: jobRef.id, status: "RUNNING", attempts } as ScreeningJob };
  });
}

export async function runJob(job: ScreeningJob) {
  const now = nowMs();
  const orderRef = db.collection("screeningOrders").doc(job.orderId);
  const appRef = db.collection("rentalApplications").doc(job.applicationId);
  const jobRef = db.collection("screeningJobs").doc(job.id);

  try {
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
        status: "COMPLETE",
        finishedAt,
        lockOwner: null,
        lockExpiresAt: null,
        lastError: null,
      },
      { merge: true }
    );

    console.log("[screening-jobs] complete", { jobId: job.id });
    return { ok: true };
  } catch (err: any) {
    const message = err?.message || "UNKNOWN_ERROR";
    const attempts = (job.attempts || 0) + 1;
    const status = attempts >= 5 ? "FAILED" : "QUEUED";
    await jobRef.set(
      {
        status,
        lastError: message,
        lockOwner: null,
        lockExpiresAt: null,
        attempts,
      },
      { merge: true }
    );
    console.error("[screening-jobs] failed", { jobId: job.id, attempts, error: message });
    return { ok: false, error: message };
  }
}
