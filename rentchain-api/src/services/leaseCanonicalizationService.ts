import type { Firestore } from "firebase-admin/firestore";
import { normalizeLeaseRecord, type LeaseWorkflowLease } from "./leaseNoticeWorkflowService";

export const CURRENT_LEASE_STATUSES = new Set([
  "active",
  "notice_pending",
  "renewal_pending",
  "renewal_accepted",
  "move_out_pending",
]);

export type CanonicalUnitRecord = {
  id: string;
  landlordId: string | null;
  propertyId: string | null;
  unitNumber: string | null;
  label: string | null;
  rent: number | null;
  raw: Record<string, unknown>;
};

export type CanonicalLeaseRecord = LeaseWorkflowLease & {
  sourceMonthlyRent: number;
  hasResolvedUnit: boolean;
  resolvedUnitId: string | null;
  resolvedUnitNumber: string | null;
  resolvedUnitLabel: string | null;
  logicalUnitKey: string | null;
  migrationSourceRank: number;
};

export type UnitResolution = {
  unit: CanonicalUnitRecord | null;
  matchedBy: "doc_id" | "unit_number" | "label" | "alias" | null;
  ambiguous: boolean;
  candidateIds: string[];
};

type LeaseGroupWinner = {
  winner: CanonicalLeaseRecord;
  losers: CanonicalLeaseRecord[];
};

function asTrimmedString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

export function toMillisSafe(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof (value as any)?.toMillis === "function") {
    try {
      const millis = Number((value as any).toMillis());
      return Number.isFinite(millis) ? millis : 0;
    } catch {
      return 0;
    }
  }
  if (typeof (value as any)?.seconds === "number") {
    return Number((value as any).seconds) * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toNumberSafe(...values: unknown[]): number {
  for (const value of values) {
    const next = Number(value);
    if (Number.isFinite(next)) return next;
  }
  return 0;
}

function compactStrings(values: Array<unknown>): string[] {
  return values
    .map((value) => asTrimmedString(value))
    .filter((value): value is string => Boolean(value));
}

// Legacy migration created duplicate current leases where unit references used
// either Firestore doc ids or label-style aliases like UNIT_A for the same unit.
// These normalizers intentionally collapse those variants into a comparable key.
export function normalizeUnitToken(value: unknown): string {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  return raw.replace(/[\s_-]+/g, "");
}

export function normalizeUnitAlias(value: unknown): string {
  const token = normalizeUnitToken(value);
  if (!token) return "";
  return token.replace(/^UNIT/, "");
}

function buildUnitCandidates(value: unknown): string[] {
  const raw = asTrimmedString(value);
  if (!raw) return [];
  const token = normalizeUnitToken(raw);
  const alias = normalizeUnitAlias(raw);
  return Array.from(new Set([raw.toUpperCase(), token, alias].filter(Boolean)));
}

export function isCurrentLeaseStatus(status: unknown): boolean {
  return CURRENT_LEASE_STATUSES.has(String(status || "").trim().toLowerCase());
}

export function rankLeaseStatus(status: unknown): number {
  switch (String(status || "").trim().toLowerCase()) {
    case "renewal_accepted":
      return 5;
    case "move_out_pending":
      return 4;
    case "renewal_pending":
      return 3;
    case "notice_pending":
      return 2;
    case "active":
      return 1;
    default:
      return 0;
  }
}

export function toCanonicalUnitRecord(id: string, raw: Record<string, unknown>): CanonicalUnitRecord {
  return {
    id,
    landlordId: asTrimmedString(raw?.landlordId),
    propertyId: asTrimmedString(raw?.propertyId),
    unitNumber: asTrimmedString(raw?.unitNumber ?? raw?.unit ?? raw?.name),
    label: asTrimmedString(raw?.label ?? raw?.displayLabel ?? raw?.unitLabel ?? raw?.unitNumber),
    rent: Number.isFinite(Number(raw?.rent ?? raw?.marketRent ?? raw?.monthlyRent))
      ? Number(raw?.rent ?? raw?.marketRent ?? raw?.monthlyRent)
      : null,
    raw,
  };
}

export async function loadUnitsForProperty(
  db: Firestore,
  propertyId: string | null | undefined,
  landlordId?: string | null
): Promise<CanonicalUnitRecord[]> {
  const targetPropertyId = String(propertyId || "").trim();
  if (!targetPropertyId) return [];
  let query: FirebaseFirestore.Query = db.collection("units").where("propertyId", "==", targetPropertyId);
  const targetLandlordId = String(landlordId || "").trim();
  if (targetLandlordId) {
    query = query.where("landlordId", "==", targetLandlordId);
  }
  const snap = await query.get();
  return snap.docs.map((doc) => toCanonicalUnitRecord(doc.id, (doc.data() || {}) as Record<string, unknown>));
}

export function resolveUnitReference(units: CanonicalUnitRecord[], reference: unknown): UnitResolution {
  const target = asTrimmedString(reference);
  if (!target) {
    return { unit: null, matchedBy: null, ambiguous: false, candidateIds: [] };
  }

  const targetRawUpper = target.toUpperCase();
  const targetToken = normalizeUnitToken(target);
  const targetAlias = normalizeUnitAlias(target);
  const direct = units.filter((unit) => unit.id === target);
  if (direct.length === 1) {
    return { unit: direct[0], matchedBy: "doc_id", ambiguous: false, candidateIds: [direct[0].id] };
  }
  if (direct.length > 1) {
    return { unit: direct[0], matchedBy: "doc_id", ambiguous: true, candidateIds: direct.map((unit) => unit.id) };
  }

  const byUnitNumber = units.filter((unit) =>
    buildUnitCandidates(unit.unitNumber).some((candidate) => candidate === targetRawUpper || candidate === targetToken)
  );
  if (byUnitNumber.length === 1) {
    return { unit: byUnitNumber[0], matchedBy: "unit_number", ambiguous: false, candidateIds: [byUnitNumber[0].id] };
  }
  if (byUnitNumber.length > 1) {
    return {
      unit: byUnitNumber[0],
      matchedBy: "unit_number",
      ambiguous: true,
      candidateIds: byUnitNumber.map((unit) => unit.id),
    };
  }

  const byLabel = units.filter((unit) =>
    compactStrings([unit.label, unit.unitNumber]).some((candidate) => {
      const candidateToken = normalizeUnitToken(candidate);
      const candidateAlias = normalizeUnitAlias(candidate);
      return (
        candidateToken === targetToken ||
        candidateAlias === targetAlias ||
        candidate.toUpperCase() === targetRawUpper
      );
    })
  );
  if (byLabel.length === 1) {
    return { unit: byLabel[0], matchedBy: "label", ambiguous: false, candidateIds: [byLabel[0].id] };
  }
  if (byLabel.length > 1) {
    return { unit: byLabel[0], matchedBy: "label", ambiguous: true, candidateIds: byLabel.map((unit) => unit.id) };
  }

  return { unit: null, matchedBy: null, ambiguous: false, candidateIds: [] };
}

function getLogicalUnitKey(lease: LeaseWorkflowLease, resolution: UnitResolution): string | null {
  if (resolution.unit?.id) return `unit:${resolution.unit.id}`;
  const propertyId = asTrimmedString(lease.propertyId);
  const unitBits = compactStrings([lease.unitId, lease.unitLabel]);
  for (const bit of unitBits) {
    const normalized = normalizeUnitAlias(bit);
    if (normalized) {
      return propertyId ? `property:${propertyId}:label:${normalized}` : `label:${normalized}`;
    }
  }
  const tenantId = asTrimmedString(lease.tenantId);
  if (propertyId && tenantId) return `property:${propertyId}:tenant:${tenantId}`;
  if (tenantId) return `tenant:${tenantId}`;
  return null;
}

function getMigrationSourceRank(lease: LeaseWorkflowLease): number {
  const rawId = String(lease.id || "").trim().toLowerCase();
  const unitId = String(lease.unitId || "").trim();
  const unitLabel = String(lease.unitLabel || "").trim();
  if (unitId && unitLabel && unitId !== unitLabel) return 1;
  if (rawId.includes("migrat")) return 0;
  return 2;
}

export function toCanonicalLeaseRecord(
  id: string,
  raw: Record<string, unknown>,
  units: CanonicalUnitRecord[]
): CanonicalLeaseRecord {
  const lease = normalizeLeaseRecord(id, raw);
  const resolution = resolveUnitReference(
    units,
    lease.unitId || raw?.unitNumber || raw?.unitLabel || raw?.unit || null
  );
  return {
    ...lease,
    sourceMonthlyRent: toNumberSafe(raw?.monthlyRent, raw?.currentRent, raw?.rent, raw?.rentAmount),
    hasResolvedUnit: Boolean(resolution.unit?.id) && !resolution.ambiguous,
    resolvedUnitId: resolution.unit?.id || null,
    resolvedUnitNumber: resolution.unit?.unitNumber || null,
    resolvedUnitLabel: resolution.unit?.label || resolution.unit?.unitNumber || null,
    logicalUnitKey: getLogicalUnitKey(lease, resolution),
    migrationSourceRank: getMigrationSourceRank(lease),
  };
}

export function compareLeaseWinner(a: CanonicalLeaseRecord, b: CanonicalLeaseRecord): number {
  const rentDiff = Number(b.sourceMonthlyRent > 0) - Number(a.sourceMonthlyRent > 0);
  if (rentDiff !== 0) return rentDiff;
  const startDiff = Number(Boolean(b.leaseStartDate)) - Number(Boolean(a.leaseStartDate));
  if (startDiff !== 0) return startDiff;
  const endDiff = Number(Boolean(b.leaseEndDate)) - Number(Boolean(a.leaseEndDate));
  if (endDiff !== 0) return endDiff;
  const statusDiff = rankLeaseStatus(b.status) - rankLeaseStatus(a.status);
  if (statusDiff !== 0) return statusDiff;
  const resolvedDiff = Number(b.hasResolvedUnit) - Number(a.hasResolvedUnit);
  if (resolvedDiff !== 0) return resolvedDiff;
  const sourceDiff = b.migrationSourceRank - a.migrationSourceRank;
  if (sourceDiff !== 0) return sourceDiff;
  return toMillisSafe(a.createdAt) - toMillisSafe(b.createdAt);
}

export function pickLeaseWinner(leases: CanonicalLeaseRecord[]): LeaseGroupWinner | null {
  if (!leases.length) return null;
  const sorted = [...leases].sort(compareLeaseWinner);
  return {
    winner: sorted[0],
    losers: sorted.slice(1),
  };
}

export function dedupeCurrentLeases(leases: CanonicalLeaseRecord[]): {
  winners: CanonicalLeaseRecord[];
  duplicateGroups: LeaseGroupWinner[];
} {
  const byKey = new Map<string, CanonicalLeaseRecord[]>();
  const passthrough: CanonicalLeaseRecord[] = [];

  for (const lease of leases) {
    if (!isCurrentLeaseStatus(lease.status)) {
      passthrough.push(lease);
      continue;
    }
    const key =
      lease.logicalUnitKey ||
      (lease.propertyId ? `property:${lease.propertyId}:lease:${lease.id}` : `lease:${lease.id}`);
    const bucket = byKey.get(key) || [];
    bucket.push(lease);
    byKey.set(key, bucket);
  }

  const winners = [...passthrough];
  const duplicateGroups: LeaseGroupWinner[] = [];
  byKey.forEach((bucket) => {
    const picked = pickLeaseWinner(bucket);
    if (!picked) return;
    winners.push(picked.winner);
    if (picked.losers.length) duplicateGroups.push(picked);
  });

  winners.sort((a, b) => {
    const updatedDiff = toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    return toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt);
  });

  return { winners, duplicateGroups };
}

export async function loadCanonicalPropertyLeases(
  db: Firestore,
  rawLeases: Array<{ id: string; raw: Record<string, unknown> }>,
  propertyId: string | null | undefined,
  landlordId?: string | null
) {
  const units = await loadUnitsForProperty(db, propertyId, landlordId);
  const leases = rawLeases.map(({ id, raw }) => toCanonicalLeaseRecord(id, raw, units));
  return { units, leases, ...dedupeCurrentLeases(leases) };
}