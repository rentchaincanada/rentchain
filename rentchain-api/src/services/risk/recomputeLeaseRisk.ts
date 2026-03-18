import type { Firestore } from "firebase-admin/firestore";
import { db as defaultDb } from "../../config/firebase";
import { buildLeaseRiskInput } from "./buildLeaseRiskInput";
import { safeAssessLeaseRisk } from "./riskEngine";
import type { RiskAssessment } from "./riskTypes";

export type LeaseRiskSnapshotFields = {
  risk: RiskAssessment | null;
  riskScore: number | null;
  riskGrade: string | null;
  riskConfidence: number | null;
};

export type LeaseRiskSkipReason =
  | "lease_not_found"
  | "missing_tenant_linkage"
  | "missing_property_context"
  | "missing_landlord_context"
  | "property_lookup_failed"
  | "risk_assessment_unavailable"
  | "risk_snapshot_unchanged";

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
};

type LeaseRiskContext = {
  landlordId: string;
  propertyId: string;
  unitId?: string | null;
  tenantIds: string[];
  monthlyRent?: number | null;
};

type RecomputeLeaseRiskOptions = {
  firestore?: Pick<Firestore, "collection">;
  dryRun?: boolean;
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

export async function persistLeaseRiskSnapshot(
  leaseId: string,
  snapshot: LeaseRiskSnapshotFields,
  firestore: Pick<Firestore, "collection"> = defaultDb as Pick<Firestore, "collection">
) {
  await firestore.collection("leases").doc(leaseId).set(
    {
      risk: snapshot.risk ?? null,
      riskScore: snapshot.riskScore ?? null,
      riskGrade: snapshot.riskGrade ?? null,
      riskConfidence: snapshot.riskConfidence ?? null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
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

  if (!needsRiskPersistenceRepair(normalizedRecord.raw) && snapshotsEqual(previous, next)) {
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
    await persistLeaseRiskSnapshot(leaseId, next, firestore);
  }

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
  };
}
