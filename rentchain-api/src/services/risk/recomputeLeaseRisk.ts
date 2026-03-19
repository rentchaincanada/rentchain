import type { Firestore } from "firebase-admin/firestore";
import { db as defaultDb } from "../../config/firebase";
import { buildLeaseRiskInput } from "./buildLeaseRiskInput";
import { safeAssessLeaseRisk } from "./riskEngine";
import { recomputeTenantScore, type TenantScoreRecomputeResult } from "./recomputeTenantScore";
import type { TenantScoreTimelineTrigger } from "./tenantScoreTypes";
import type {
  LeaseRiskTimelineEntry,
  LeaseRiskTimelineTrigger,
  RiskAssessment,
} from "./riskTypes";

export type LeaseRiskSnapshotFields = {
  risk: RiskAssessment | null;
  riskScore: number | null;
  riskGrade: string | null;
  riskConfidence: number | null;
};

export type LeaseRiskPersistenceFields = LeaseRiskSnapshotFields & {
  riskTimeline: LeaseRiskTimelineEntry[];
};

export type LeaseRiskSkipReason =
  | "lease_not_found"
  | "missing_tenant_linkage"
  | "missing_property_context"
  | "missing_landlord_context"
  | "property_lookup_failed"
  | "risk_assessment_unavailable"
  | "risk_snapshot_unchanged";

export type LinkedTenantScoreRecomputeResult = Omit<TenantScoreRecomputeResult, "reason"> & {
  reason?: TenantScoreRecomputeResult["reason"] | "linked_tenant_recompute_failed";
  error?: string | null;
};

export type LeaseRiskRecomputeResult = {
  leaseId: string;
  updated: boolean;
  skipped: boolean;
  wouldUpdate?: boolean;
  reason?: LeaseRiskSkipReason;
  previousRiskScore?: number | null;
  nextRiskScore?: number | null;
  previousRiskGrade?: string | null;
  nextRiskGrade?: string | null;
  generatedAt?: string;
  linkedTenantScoreAttempted?: boolean;
  linkedTenantScoreReason?: "not_requested" | "no_linked_tenants";
  linkedTenantResults?: LinkedTenantScoreRecomputeResult[];
};

type LeaseRiskContext = {
  landlordId: string;
  propertyId: string;
  unitId?: string | null;
  tenantIds: string[];
  monthlyRent?: number | null;
};

type PersistLeaseRiskSnapshotOptions = {
  firestore?: Pick<Firestore, "collection">;
  existingRaw?: Record<string, unknown>;
  trigger?: LeaseRiskTimelineTrigger;
  source?: string | null;
  updatedAt?: unknown;
};

type RecomputeLeaseRiskOptions = {
  firestore?: Pick<Firestore, "collection">;
  dryRun?: boolean;
  trigger?: LeaseRiskTimelineTrigger;
  source?: string | null;
  recomputeLinkedTenantScores?: boolean;
  tenantScoreTrigger?: TenantScoreTimelineTrigger;
  tenantScoreSource?: string | null;
};

type LegacyNormalizationMeta = {
  attemptedPropertyLookup: boolean;
  propertyLookupFailed: boolean;
};

type NormalizedLeaseRiskRecord = {
  raw: Record<string, unknown>;
  meta: LegacyNormalizationMeta;
};

type LeaseRiskContextResolution =
  | { ok: true; context: LeaseRiskContext }
  | { ok: false; reason: LeaseRiskSkipReason };

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function asTrimmedStringOrNull(value: unknown): string | null {
  const next = asTrimmedString(value);
  return next || null;
}

function numberOrNull(...values: unknown[]): number | null {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function toTenantIds(raw: Record<string, unknown>): string[] {
  const tenantIds = Array.isArray(raw?.tenantIds)
    ? raw.tenantIds.map((value) => asTrimmedString(value)).filter(Boolean)
    : [];
  if (tenantIds.length) return tenantIds;
  const fallback = asTrimmedString(raw?.tenantId || raw?.primaryTenantId);
  return fallback ? [fallback] : [];
}

function monthlyRentFromLease(raw: Record<string, unknown>): number | null {
  const fromDollars = numberOrNull(raw?.monthlyRent, raw?.currentRent, raw?.rent);
  if (fromDollars != null) return fromDollars;
  const baseRentCents = numberOrNull(raw?.baseRentCents);
  return baseRentCents != null ? Math.round(baseRentCents / 100) : null;
}

function extractLinkedTenantIds(raw: Record<string, unknown>): string[] {
  const tenantIds = Array.isArray(raw?.tenantIds)
    ? raw.tenantIds.map((value) => asTrimmedString(value)).filter(Boolean)
    : [];
  const legacyIds = [raw?.tenantId, raw?.primaryTenantId]
    .map((value) => asTrimmedString(value))
    .filter(Boolean);
  return Array.from(new Set([...tenantIds, ...legacyIds]));
}

async function recomputeLinkedTenantScoresForLease(
  raw: Record<string, unknown>,
  firestore: Pick<Firestore, "collection">,
  options: RecomputeLeaseRiskOptions
): Promise<{ attempted: boolean; reason?: "no_linked_tenants"; results: LinkedTenantScoreRecomputeResult[] }> {
  if (!options.recomputeLinkedTenantScores) {
    return { attempted: false, results: [] };
  }

  const tenantIds = extractLinkedTenantIds(raw);
  if (!tenantIds.length) {
    return { attempted: true, reason: "no_linked_tenants", results: [] };
  }

  const results: LinkedTenantScoreRecomputeResult[] = [];
  for (const tenantId of tenantIds) {
    try {
      const result = await recomputeTenantScore(tenantId, {
        firestore,
        dryRun: options.dryRun,
        trigger: options.tenantScoreTrigger || "lease_recompute",
        source: options.tenantScoreSource ?? options.source ?? "lease_risk_recompute",
      });
      results.push(result);
    } catch (error: any) {
      results.push({
        tenantId,
        updated: false,
        skipped: true,
        reason: "linked_tenant_recompute_failed",
        error: error?.message || String(error),
      });
    }
  }

  return { attempted: true, results };
}

async function normalizeLegacyLeaseRiskRecord(
  raw: Record<string, unknown>,
  firestore: Pick<Firestore, "collection">
): Promise<NormalizedLeaseRiskRecord> {
  const normalized: Record<string, unknown> = { ...raw };
  const meta: LegacyNormalizationMeta = {
    attemptedPropertyLookup: false,
    propertyLookupFailed: false,
  };

  const existingTenantIds = Array.isArray(normalized.tenantIds)
    ? normalized.tenantIds.map((value) => asTrimmedString(value)).filter(Boolean)
    : [];
  if (!existingTenantIds.length) {
    const fallbackTenantId = asTrimmedString(normalized.tenantId || normalized.primaryTenantId);
    if (fallbackTenantId) {
      normalized.tenantIds = [fallbackTenantId];
    }
  }
  if (!asTrimmedString(normalized.startDate) && asTrimmedString(normalized.leaseStartDate)) {
    normalized.startDate = asTrimmedString(normalized.leaseStartDate);
  }
  if (normalized.endDate == null && (normalized.leaseEndDate != null || normalized.leaseEnd != null)) {
    normalized.endDate = asTrimmedString(normalized.leaseEndDate || normalized.leaseEnd) || null;
  }

  const source = asTrimmedString(normalized.source).toLowerCase();
  if (asTrimmedString(normalized.landlordId) || source !== "application-conversion") {
    return { raw: normalized, meta };
  }
  const propertyId = asTrimmedString(normalized.propertyId);
  if (!propertyId) {
    return { raw: normalized, meta };
  }

  meta.attemptedPropertyLookup = true;
  try {
    const propertySnap = await firestore.collection("properties").doc(propertyId).get();
    if (!propertySnap.exists) {
      return { raw: normalized, meta };
    }
    const property = (propertySnap.data() || {}) as Record<string, unknown>;
    const landlordId = asTrimmedString(property.landlordId || property.ownerId || property.userId);
    if (landlordId) {
      normalized.landlordId = landlordId;
    }
  } catch {
    meta.propertyLookupFailed = true;
  }

  return { raw: normalized, meta };
}

export function resolveLeaseRiskContext(
  raw: Record<string, unknown>,
  meta: LegacyNormalizationMeta = { attemptedPropertyLookup: false, propertyLookupFailed: false }
): LeaseRiskContextResolution {
  const tenantIds = toTenantIds(raw);
  if (!tenantIds.length) {
    return { ok: false, reason: "missing_tenant_linkage" };
  }

  const propertyId = asTrimmedString(raw?.propertyId);
  if (!propertyId) {
    return { ok: false, reason: "missing_property_context" };
  }

  const landlordId = asTrimmedString(raw?.landlordId);
  if (!landlordId) {
    if (meta.propertyLookupFailed) {
      return { ok: false, reason: "property_lookup_failed" };
    }
    return { ok: false, reason: "missing_landlord_context" };
  }

  return {
    ok: true,
    context: {
      landlordId,
      propertyId,
      unitId: asTrimmedStringOrNull(raw?.unitId || raw?.unitNumber || raw?.unit),
      tenantIds,
      monthlyRent: monthlyRentFromLease(raw),
    },
  };
}

export function computeLeaseRiskContext(raw: Record<string, unknown>): LeaseRiskContext | null {
  const resolved = resolveLeaseRiskContext(raw);
  return resolved.ok ? resolved.context : null;
}

export async function computeLeaseRiskSnapshot(
  input: LeaseRiskContext
): Promise<LeaseRiskSnapshotFields> {
  try {
    const riskInput = await buildLeaseRiskInput(input);
    const risk = await safeAssessLeaseRisk(riskInput);
    if (!risk) {
      return { risk: null, riskScore: null, riskGrade: null, riskConfidence: null };
    }
    return {
      risk,
      riskScore: risk.score,
      riskGrade: risk.grade,
      riskConfidence: risk.confidence,
    };
  } catch (error) {
    console.warn("[lease-risk] failed to generate risk snapshot", error);
    return { risk: null, riskScore: null, riskGrade: null, riskConfidence: null };
  }
}

function comparableSnapshot(snapshot: LeaseRiskSnapshotFields) {
  if (!snapshot.risk) {
    return {
      risk: null,
      riskScore: snapshot.riskScore ?? null,
      riskGrade: snapshot.riskGrade ?? null,
      riskConfidence: snapshot.riskConfidence ?? null,
    };
  }
  const { generatedAt: _generatedAt, ...restRisk } = snapshot.risk;
  return {
    risk: restRisk,
    riskScore: snapshot.riskScore ?? null,
    riskGrade: snapshot.riskGrade ?? null,
    riskConfidence: snapshot.riskConfidence ?? null,
  };
}

function currentSnapshot(raw: Record<string, unknown>): LeaseRiskSnapshotFields {
  const risk = raw?.risk && typeof raw.risk === "object" ? (raw.risk as RiskAssessment) : null;
  return {
    risk,
    riskScore: typeof raw?.riskScore === "number" ? raw.riskScore : typeof risk?.score === "number" ? risk.score : null,
    riskGrade: asTrimmedString(raw?.riskGrade || risk?.grade) || null,
    riskConfidence:
      typeof raw?.riskConfidence === "number"
        ? raw.riskConfidence
        : typeof risk?.confidence === "number"
        ? risk.confidence
        : null,
  };
}

function snapshotsEqual(previous: LeaseRiskSnapshotFields, next: LeaseRiskSnapshotFields): boolean {
  return JSON.stringify(comparableSnapshot(previous)) === JSON.stringify(comparableSnapshot(next));
}

function isRiskFieldPersisted(raw: Record<string, unknown>, field: "risk" | "riskScore" | "riskGrade" | "riskConfidence"): boolean {
  if (field === "risk") {
    return Boolean(raw?.risk && typeof raw.risk === "object");
  }
  if (field === "riskScore") {
    return typeof raw?.riskScore === "number";
  }
  if (field === "riskGrade") {
    return Boolean(asTrimmedString(raw?.riskGrade));
  }
  return typeof raw?.riskConfidence === "number";
}

function needsRiskPersistenceRepair(raw: Record<string, unknown>): boolean {
  return (
    !isRiskFieldPersisted(raw, "risk") ||
    !isRiskFieldPersisted(raw, "riskScore") ||
    !isRiskFieldPersisted(raw, "riskGrade") ||
    !isRiskFieldPersisted(raw, "riskConfidence")
  );
}

function toTimelineArray(value: unknown): LeaseRiskTimelineEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry: any) => ({
      generatedAt: asTrimmedString(entry.generatedAt),
      version: asTrimmedString(entry.version),
      score: Number(entry.score),
      grade: asTrimmedString(entry.grade) as LeaseRiskTimelineEntry["grade"],
      confidence: Number(entry.confidence),
      trigger: (asTrimmedString(entry.trigger) || "unknown") as LeaseRiskTimelineTrigger,
      source: asTrimmedString(entry.source) || null,
      flags: Array.isArray(entry.flags) ? entry.flags.map((flag: any) => String(flag)).filter(Boolean) : [],
      recommendations: Array.isArray(entry.recommendations)
        ? entry.recommendations.map((value: any) => String(value)).filter(Boolean)
        : [],
    }))
    .filter((entry) => entry.generatedAt && entry.version && Number.isFinite(entry.score) && entry.grade && Number.isFinite(entry.confidence));
}

function compareTimelineMeaning(a: LeaseRiskTimelineEntry | null | undefined, b: LeaseRiskTimelineEntry): boolean {
  if (!a) return false;
  return JSON.stringify({
    version: a.version,
    score: a.score,
    grade: a.grade,
    confidence: a.confidence,
    flags: a.flags || [],
    recommendations: a.recommendations || [],
  }) === JSON.stringify({
    version: b.version,
    score: b.score,
    grade: b.grade,
    confidence: b.confidence,
    flags: b.flags || [],
    recommendations: b.recommendations || [],
  });
}

export function buildRiskTimelineEntry(
  snapshot: LeaseRiskSnapshotFields,
  options?: { trigger?: LeaseRiskTimelineTrigger; source?: string | null }
): LeaseRiskTimelineEntry | null {
  if (!snapshot.risk) return null;
  return {
    generatedAt: snapshot.risk.generatedAt,
    version: snapshot.risk.version,
    score: snapshot.risk.score,
    grade: snapshot.risk.grade,
    confidence: snapshot.risk.confidence,
    trigger: options?.trigger || "unknown",
    source: options?.source ?? null,
    flags: snapshot.risk.flags || [],
    recommendations: snapshot.risk.recommendations || [],
  };
}

export function buildLeaseRiskPersistenceFields(
  existingRaw: Record<string, unknown>,
  snapshot: LeaseRiskSnapshotFields,
  options?: { trigger?: LeaseRiskTimelineTrigger; source?: string | null }
): LeaseRiskPersistenceFields {
  const existingTimeline = toTimelineArray(existingRaw?.riskTimeline);
  const nextEntry = buildRiskTimelineEntry(snapshot, options);
  const riskTimeline = nextEntry && !compareTimelineMeaning(existingTimeline[existingTimeline.length - 1], nextEntry)
    ? [...existingTimeline, nextEntry]
    : existingTimeline;

  return {
    risk: snapshot.risk ?? null,
    riskScore: snapshot.riskScore ?? null,
    riskGrade: snapshot.riskGrade ?? null,
    riskConfidence: snapshot.riskConfidence ?? null,
    riskTimeline,
  };
}

export async function persistLeaseRiskSnapshot(
  leaseId: string,
  snapshot: LeaseRiskSnapshotFields,
  options: PersistLeaseRiskSnapshotOptions = {}
) {
  const firestore = options.firestore || (defaultDb as Pick<Firestore, "collection">);
  const existingRaw = options.existingRaw || ((await firestore.collection("leases").doc(leaseId).get()).data() as Record<string, unknown>) || {};
  const nextFields = buildLeaseRiskPersistenceFields(existingRaw, snapshot, {
    trigger: options.trigger || "recompute",
    source: options.source ?? null,
  });
  await firestore.collection("leases").doc(leaseId).set(
    {
      ...nextFields,
      updatedAt: options.updatedAt ?? new Date().toISOString(),
    },
    { merge: true }
  );
  return nextFields;
}

export async function recomputeLeaseRisk(
  leaseId: string,
  options: RecomputeLeaseRiskOptions = {}
): Promise<LeaseRiskRecomputeResult> {
  const firestore = options.firestore || (defaultDb as Pick<Firestore, "collection">);
  const leaseSnap = await firestore.collection("leases").doc(leaseId).get();
  if (!leaseSnap.exists) {
    return {
      leaseId,
      updated: false,
      skipped: true,
      reason: "lease_not_found",
      previousRiskScore: null,
      nextRiskScore: null,
      previousRiskGrade: null,
      nextRiskGrade: null,
    };
  }

  const raw = ((leaseSnap.data() || {}) as Record<string, unknown>);
  const previous = currentSnapshot(raw);
  const normalizedRecord = await normalizeLegacyLeaseRiskRecord(raw, firestore);
  const resolvedContext = resolveLeaseRiskContext(normalizedRecord.raw, normalizedRecord.meta);
  if (!resolvedContext.ok) {
    return {
      leaseId,
      updated: false,
      skipped: true,
      reason: resolvedContext.reason,
      previousRiskScore: previous.riskScore,
      nextRiskScore: previous.riskScore,
      previousRiskGrade: previous.riskGrade,
      nextRiskGrade: previous.riskGrade,
    };
  }

  const next = await computeLeaseRiskSnapshot(resolvedContext.context);
  if (!next.risk) {
    return {
      leaseId,
      updated: false,
      skipped: true,
      reason: "risk_assessment_unavailable",
      previousRiskScore: previous.riskScore,
      nextRiskScore: null,
      previousRiskGrade: previous.riskGrade,
      nextRiskGrade: null,
    };
  }

  const nextFields = buildLeaseRiskPersistenceFields(normalizedRecord.raw, next, {
    trigger: options.trigger || "recompute",
    source: options.source ?? null,
  });
  const timelineChanged = JSON.stringify(toTimelineArray(raw?.riskTimeline)) !== JSON.stringify(nextFields.riskTimeline);

  if (!needsRiskPersistenceRepair(raw) && snapshotsEqual(previous, next) && !timelineChanged) {
    return {
      leaseId,
      updated: false,
      skipped: true,
      wouldUpdate: false,
      reason: "risk_snapshot_unchanged",
      previousRiskScore: previous.riskScore,
      nextRiskScore: next.riskScore,
      previousRiskGrade: previous.riskGrade,
      nextRiskGrade: next.riskGrade,
      generatedAt: next.risk.generatedAt,
    };
  }

  if (!options.dryRun) {
    await persistLeaseRiskSnapshot(leaseId, next, {
      firestore,
      existingRaw: raw,
      trigger: options.trigger || "recompute",
      source: options.source ?? null,
    });
  }

  const linkedTenantOutcome = await recomputeLinkedTenantScoresForLease(normalizedRecord.raw, firestore, options);

  return {
    leaseId,
    updated: !options.dryRun,
    skipped: false,
    wouldUpdate: true,
    previousRiskScore: previous.riskScore,
    nextRiskScore: next.riskScore,
    previousRiskGrade: previous.riskGrade,
    nextRiskGrade: next.riskGrade,
    generatedAt: next.risk.generatedAt,
    linkedTenantScoreAttempted: linkedTenantOutcome.attempted,
    linkedTenantScoreReason: linkedTenantOutcome.reason,
    linkedTenantResults: linkedTenantOutcome.results,
  };
}
