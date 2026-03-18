import type { Firestore } from "firebase-admin/firestore";
import { db as defaultDb } from "../../config/firebase";
import { listLedgerEventsV2 } from "../ledgerEventsFirestoreService";
import { CURRENT_LEASE_STATUSES, toMillisSafe } from "../leaseCanonicalizationService";
import { computeTenantSignals } from "../tenantSignalsService";
import { computeTenantScore } from "./computeTenantScore";
import type {
  TenantScore,
  TenantScoreInput,
  TenantScorePersistenceFields,
  TenantScoreSnapshotFields,
  TenantScoreTimelineEntry,
  TenantScoreTimelineTrigger,
} from "./tenantScoreTypes";

export type TenantScoreSkipReason =
  | "tenant_not_found"
  | "missing_landlord_context"
  | "no_linked_leases"
  | "tenant_score_unchanged";

export type TenantScoreRecomputeResult = {
  tenantId: string;
  updated: boolean;
  skipped: boolean;
  wouldUpdate?: boolean;
  reason?: TenantScoreSkipReason;
  previousScore?: number | null;
  nextScore?: number | null;
  previousGrade?: string | null;
  nextGrade?: string | null;
  generatedAt?: string;
};

type FirestoreLike = Pick<Firestore, "collection">;

type RecomputeTenantScoreOptions = {
  firestore?: FirestoreLike;
  dryRun?: boolean;
  trigger?: TenantScoreTimelineTrigger;
  source?: string | null;
};

type TenantScoreContext = {
  landlordId: string;
  input: TenantScoreInput;
};

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function asTrimmedStringOrNull(value: unknown): string | null {
  const next = asTrimmedString(value);
  return next || null;
}

function toNumberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeTenantScoreTimelineEntry(value: unknown): TenantScoreTimelineEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const generatedAt = asTrimmedString(raw.generatedAt);
  const version = asTrimmedString(raw.version);
  const grade = asTrimmedString(raw.grade) as TenantScoreTimelineEntry["grade"];
  const trigger = asTrimmedString(raw.trigger) as TenantScoreTimelineEntry["trigger"];
  const score = toNumberOrNull(raw.score);
  const confidence = toNumberOrNull(raw.confidence);
  if (!generatedAt || !version || score == null || confidence == null || !grade || !trigger) return null;
  return {
    generatedAt,
    version,
    score,
    grade,
    confidence,
    trigger,
    source: asTrimmedStringOrNull(raw.source),
    signals: Array.isArray(raw.signals) ? raw.signals.map((item) => asTrimmedString(item)).filter(Boolean) : [],
  };
}

function toTimelineArray(value: unknown): TenantScoreTimelineEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeTenantScoreTimelineEntry).filter((entry): entry is TenantScoreTimelineEntry => Boolean(entry));
}

function currentTenantScoreSnapshot(raw: Record<string, unknown>): TenantScoreSnapshotFields {
  const tenantScore = raw?.tenantScore && typeof raw.tenantScore === "object" ? (raw.tenantScore as TenantScore) : null;
  return {
    tenantScore,
    tenantScoreValue:
      typeof raw?.tenantScoreValue === "number"
        ? raw.tenantScoreValue
        : typeof tenantScore?.score === "number"
        ? tenantScore.score
        : null,
    tenantScoreGrade: (asTrimmedString(raw?.tenantScoreGrade || tenantScore?.grade) || null) as TenantScore["grade"] | null,
    tenantScoreConfidence:
      typeof raw?.tenantScoreConfidence === "number"
        ? raw.tenantScoreConfidence
        : typeof tenantScore?.confidence === "number"
        ? tenantScore.confidence
        : null,
  };
}

function comparableSnapshot(snapshot: TenantScoreSnapshotFields) {
  if (!snapshot.tenantScore) {
    return {
      tenantScore: null,
      tenantScoreValue: snapshot.tenantScoreValue ?? null,
      tenantScoreGrade: snapshot.tenantScoreGrade ?? null,
      tenantScoreConfidence: snapshot.tenantScoreConfidence ?? null,
    };
  }
  const { generatedAt: _generatedAt, ...rest } = snapshot.tenantScore;
  return {
    tenantScore: rest,
    tenantScoreValue: snapshot.tenantScoreValue ?? null,
    tenantScoreGrade: snapshot.tenantScoreGrade ?? null,
    tenantScoreConfidence: snapshot.tenantScoreConfidence ?? null,
  };
}

function snapshotsEqual(previous: TenantScoreSnapshotFields, next: TenantScoreSnapshotFields): boolean {
  return JSON.stringify(comparableSnapshot(previous)) === JSON.stringify(comparableSnapshot(next));
}

function compareTimelineMeaning(previous?: TenantScoreTimelineEntry | null, next?: TenantScoreTimelineEntry | null): boolean {
  if (!previous || !next) return false;
  return JSON.stringify({
    version: previous.version,
    score: previous.score,
    grade: previous.grade,
    confidence: previous.confidence,
    trigger: previous.trigger,
    source: previous.source ?? null,
    signals: previous.signals || [],
  }) === JSON.stringify({
    version: next.version,
    score: next.score,
    grade: next.grade,
    confidence: next.confidence,
    trigger: next.trigger,
    source: next.source ?? null,
    signals: next.signals || [],
  });
}

export function buildTenantScoreTimelineEntry(
  tenantScore: TenantScore | null,
  options: { trigger?: TenantScoreTimelineTrigger; source?: string | null } = {}
): TenantScoreTimelineEntry | null {
  if (!tenantScore) return null;
  return {
    generatedAt: tenantScore.generatedAt,
    version: tenantScore.version,
    score: tenantScore.score,
    grade: tenantScore.grade,
    confidence: tenantScore.confidence,
    trigger: options.trigger || "unknown",
    source: options.source ?? null,
    signals: Array.isArray(tenantScore.signals) ? tenantScore.signals.slice(0, 8) : [],
  };
}

export function buildTenantScorePersistenceFields(
  existingRaw: Record<string, unknown>,
  snapshot: TenantScoreSnapshotFields,
  options: { trigger?: TenantScoreTimelineTrigger; source?: string | null } = {}
): TenantScorePersistenceFields {
  const existingTimeline = toTimelineArray(existingRaw?.tenantScoreTimeline);
  const nextEntry = buildTenantScoreTimelineEntry(snapshot.tenantScore, options);
  const tenantScoreTimeline = nextEntry && !compareTimelineMeaning(existingTimeline[existingTimeline.length - 1], nextEntry)
    ? [...existingTimeline, nextEntry]
    : existingTimeline;

  return {
    tenantScore: snapshot.tenantScore,
    tenantScoreValue: snapshot.tenantScoreValue,
    tenantScoreGrade: snapshot.tenantScoreGrade,
    tenantScoreConfidence: snapshot.tenantScoreConfidence,
    tenantScoreTimeline,
  };
}

async function loadTenantLeases(firestore: FirestoreLike, tenantId: string) {
  const leasesRef: any = firestore.collection("leases");
  const [directSnap, arraySnap] = await Promise.all([
    leasesRef.where("tenantId", "==", tenantId).get().catch(() => ({ docs: [] } as any)),
    leasesRef.where("tenantIds", "array-contains", tenantId).get().catch(() => ({ docs: [] } as any)),
  ]);

  const seen = new Map<string, Record<string, unknown>>();
  for (const doc of [...(directSnap.docs || []), ...(arraySnap.docs || [])]) {
    if (!doc?.id) continue;
    seen.set(doc.id, (doc.data() || {}) as Record<string, unknown>);
  }
  return Array.from(seen.entries()).map(([id, raw]) => ({ id, raw }));
}

function leaseRiskScore(raw: Record<string, unknown>): number | null {
  if (typeof raw?.riskScore === "number") return raw.riskScore;
  if (raw?.risk && typeof raw.risk === "object" && typeof (raw.risk as any).score === "number") {
    return Number((raw.risk as any).score);
  }
  return null;
}

function buildTenantScoreInput(leases: Array<{ id: string; raw: Record<string, unknown> }>, paymentSignals: ReturnType<typeof computeTenantSignals>, paymentCount: number): TenantScoreInput {
  const scoredLeases = leases
    .map((lease) => ({ ...lease, riskScore: leaseRiskScore(lease.raw) }))
    .filter((lease) => lease.riskScore != null) as Array<{ id: string; raw: Record<string, unknown>; riskScore: number }>;

  const sortedByRecency = [...leases].sort((a, b) => {
    const aTime = toMillisSafe(a.raw.updatedAt) || toMillisSafe(a.raw.createdAt) || toMillisSafe(a.raw.startDate) || 0;
    const bTime = toMillisSafe(b.raw.updatedAt) || toMillisSafe(b.raw.createdAt) || toMillisSafe(b.raw.startDate) || 0;
    return bTime - aTime;
  });

  const latestLeaseRiskScore = sortedByRecency
    .map((lease) => leaseRiskScore(lease.raw))
    .find((value): value is number => typeof value === "number") ?? null;

  const averageLeaseRiskScore = scoredLeases.length
    ? Math.round((scoredLeases.reduce((sum, lease) => sum + lease.riskScore, 0) / scoredLeases.length) * 100) / 100
    : null;

  const activeLeaseCount = leases.filter((lease) => CURRENT_LEASE_STATUSES.has(asTrimmedString(lease.raw.status).toLowerCase())).length;
  const completedLeaseCount = leases.filter((lease) => asTrimmedString(lease.raw.status).toLowerCase() === "ended").length;
  const latePayments = paymentSignals.latePaymentsCount || 0;
  const missedPayments = paymentSignals.missedPaymentsCount || 0;
  const denominator = paymentCount + latePayments + missedPayments;
  const onTimePaymentRatio = denominator > 0 ? Math.round((paymentCount / denominator) * 100) / 100 : null;

  return {
    activeLeaseCount,
    completedLeaseCount,
    latestLeaseRiskScore,
    averageLeaseRiskScore,
    onTimePaymentRatio,
    latePayments,
    missedPayments,
    nsfCount: paymentSignals.nsfCount || 0,
    evictionNoticeCount: paymentSignals.evictionNoticeCount || 0,
    positiveNotesCount: paymentSignals.positiveNotesCount || 0,
    evidenceLeaseCount: leases.length,
  };
}

async function resolveTenantScoreContext(firestore: FirestoreLike, tenantId: string): Promise<{ tenantRaw: Record<string, unknown>; context: TenantScoreContext } | { reason: TenantScoreSkipReason }> {
  const tenantSnap = await firestore.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) {
    return { reason: "tenant_not_found" };
  }

  const tenantRaw = (tenantSnap.data() || {}) as Record<string, unknown>;
  const leases = await loadTenantLeases(firestore, tenantId);
  if (!leases.length) {
    return { reason: "no_linked_leases" };
  }

  const landlordId =
    asTrimmedString(tenantRaw.landlordId) ||
    leases.map((lease) => asTrimmedString(lease.raw.landlordId)).find(Boolean) ||
    "";
  if (!landlordId) {
    return { reason: "missing_landlord_context" };
  }

  const events = await listLedgerEventsV2({ landlordId, tenantId, limit: 50 }).catch(() => ({ items: [] }));
  const paymentSignals = computeTenantSignals(events.items || [], tenantId, landlordId);
  const paymentSnap = await firestore.collection("payments").where("tenantId", "==", tenantId).limit(50).get().catch(() => ({ docs: [] } as any));
  const paymentCount = (paymentSnap.docs || []).length;

  return {
    tenantRaw,
    context: {
      landlordId,
      input: buildTenantScoreInput(leases, paymentSignals, paymentCount),
    },
  };
}

async function persistTenantScore(
  firestore: FirestoreLike,
  tenantId: string,
  existingRaw: Record<string, unknown>,
  snapshot: TenantScoreSnapshotFields,
  options: { trigger?: TenantScoreTimelineTrigger; source?: string | null } = {}
) {
  const fields = buildTenantScorePersistenceFields(existingRaw, snapshot, options);
  await firestore.collection("tenants").doc(tenantId).set(
    {
      tenantScore: fields.tenantScore,
      tenantScoreValue: fields.tenantScoreValue,
      tenantScoreGrade: fields.tenantScoreGrade,
      tenantScoreConfidence: fields.tenantScoreConfidence,
      tenantScoreTimeline: fields.tenantScoreTimeline,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return fields;
}

export async function recomputeTenantScore(
  tenantId: string,
  options: RecomputeTenantScoreOptions = {}
): Promise<TenantScoreRecomputeResult> {
  const firestore = options.firestore || (defaultDb as FirestoreLike);
  const trigger = options.trigger || "tenant_recompute";
  const source = options.source ?? null;
  const normalizedTenantId = asTrimmedString(tenantId);
  if (!normalizedTenantId) {
    return { tenantId: normalizedTenantId, updated: false, skipped: true, reason: "tenant_not_found" };
  }

  const loaded = await resolveTenantScoreContext(firestore, normalizedTenantId);
  if ("reason" in loaded) {
    return {
      tenantId: normalizedTenantId,
      updated: false,
      skipped: true,
      reason: loaded.reason,
    };
  }

  const previous = currentTenantScoreSnapshot(loaded.tenantRaw);
  const tenantScore = computeTenantScore(loaded.context.input);
  const nextSnapshot: TenantScoreSnapshotFields = {
    tenantScore,
    tenantScoreValue: tenantScore.score,
    tenantScoreGrade: tenantScore.grade,
    tenantScoreConfidence: tenantScore.confidence,
  };
  const nextFields = buildTenantScorePersistenceFields(loaded.tenantRaw, nextSnapshot, { trigger, source });
  const timelineChanged = JSON.stringify(toTimelineArray(loaded.tenantRaw.tenantScoreTimeline)) !== JSON.stringify(nextFields.tenantScoreTimeline);
  const snapshotChanged = !snapshotsEqual(previous, nextSnapshot);

  if (!snapshotChanged && !timelineChanged) {
    return {
      tenantId: normalizedTenantId,
      updated: false,
      skipped: true,
      reason: "tenant_score_unchanged",
      previousScore: previous.tenantScoreValue ?? null,
      nextScore: nextSnapshot.tenantScoreValue ?? null,
      previousGrade: previous.tenantScoreGrade ?? null,
      nextGrade: nextSnapshot.tenantScoreGrade ?? null,
      generatedAt: nextSnapshot.tenantScore?.generatedAt,
    };
  }

  if (options.dryRun) {
    return {
      tenantId: normalizedTenantId,
      updated: false,
      skipped: false,
      wouldUpdate: true,
      previousScore: previous.tenantScoreValue ?? null,
      nextScore: nextSnapshot.tenantScoreValue ?? null,
      previousGrade: previous.tenantScoreGrade ?? null,
      nextGrade: nextSnapshot.tenantScoreGrade ?? null,
      generatedAt: nextSnapshot.tenantScore?.generatedAt,
    };
  }

  await persistTenantScore(firestore, normalizedTenantId, loaded.tenantRaw, nextSnapshot, { trigger, source });
  return {
    tenantId: normalizedTenantId,
    updated: true,
    skipped: false,
    previousScore: previous.tenantScoreValue ?? null,
    nextScore: nextSnapshot.tenantScoreValue ?? null,
    previousGrade: previous.tenantScoreGrade ?? null,
    nextGrade: nextSnapshot.tenantScoreGrade ?? null,
    generatedAt: nextSnapshot.tenantScore?.generatedAt,
  };
}
