import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { db, FieldValue } from "../../../src/config/firebase";
import {
  CURRENT_LEASE_STATUSES,
  loadUnitsForProperty,
  pickLeaseWinner,
  resolveUnitReference,
  toCanonicalLeaseRecord,
  toMillisSafe,
  toNumberSafe,
  type CanonicalLeaseRecord,
  type CanonicalUnitRecord,
} from "../../../src/services/leaseCanonicalizationService";

export {
  db,
  FieldValue,
  CURRENT_LEASE_STATUSES,
  loadUnitsForProperty,
  resolveUnitReference,
  toNumberSafe,
};

export type ScriptFlags = {
  dryRun: boolean;
  hardDelete: boolean;
  propertyId: string | null;
  tenantId: string | null;
  limit: number | null;
};

export function parseCommonFlags(argv: string[]): ScriptFlags {
  const out: ScriptFlags = {
    dryRun: false,
    hardDelete: false,
    propertyId: null,
    tenantId: null,
    limit: null,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--hard-delete") out.hardDelete = true;
    else if (arg.startsWith("--property-id=")) out.propertyId = arg.slice("--property-id=".length).trim() || null;
    else if (arg.startsWith("--tenant-id=")) out.tenantId = arg.slice("--tenant-id=".length).trim() || null;
    else if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      out.limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
    }
  }
  return out;
}

export function ensureOutputDir() {
  mkdirSync(join(process.cwd(), "scripts", "migrations", "output"), { recursive: true });
}

export function writeReport(filename: string, report: unknown) {
  ensureOutputDir();
  const reportPath = join(process.cwd(), "scripts", "migrations", "output", filename);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return reportPath;
}

export function normalizeLeaseWritePayload(raw: Record<string, unknown>) {
  return {
    landlordId: String(raw?.landlordId || "").trim() || null,
    tenantId: String(raw?.tenantId || raw?.tenantIds?.[0] || "").trim() || null,
    propertyId: String(raw?.propertyId || "").trim() || null,
    unitId: String(raw?.unitId || raw?.unit || raw?.unitNumber || "").trim() || null,
    unitNumber: String(raw?.unitNumber || raw?.unit || raw?.unitId || "").trim() || null,
    unitLabel: String(raw?.unitLabel || raw?.unitNumber || raw?.unit || "").trim() || null,
    status: String(raw?.status || "active").trim().toLowerCase() || "active",
    monthlyRent: toNumberSafe(raw?.monthlyRent, raw?.currentRent, raw?.rent, raw?.rentAmount),
    startDate: String(raw?.startDate || raw?.leaseStartDate || raw?.leaseStart || "").trim() || null,
    endDate: String(raw?.endDate || raw?.leaseEndDate || raw?.leaseEnd || "").trim() || null,
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
  };
}

export async function loadFilteredCurrentLeases(flags: ScriptFlags) {
  let query: FirebaseFirestore.Query = db.collection("leases");
  if (flags.propertyId) query = query.where("propertyId", "==", flags.propertyId);
  if (flags.tenantId) query = query.where("tenantId", "==", flags.tenantId);
  const snap = await query.get();
  const docs = snap.docs
    .filter((doc) => CURRENT_LEASE_STATUSES.has(String((doc.data() as any)?.status || "").trim().toLowerCase()))
    .slice(0, flags.limit || Number.MAX_SAFE_INTEGER);
  return docs.map((doc) => ({ id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> }));
}

export async function loadCanonicalLeasesByProperty(entries: Array<{ id: string; raw: Record<string, unknown> }>) {
  const propertyKeys = Array.from(
    new Set(entries.map((entry) => String(entry.raw?.propertyId || "").trim()).filter(Boolean))
  );
  const unitsByProperty = new Map<string, CanonicalUnitRecord[]>();
  await Promise.all(
    propertyKeys.map(async (propertyId) => {
      const landlordId = String(entries.find((entry) => String(entry.raw?.propertyId || "").trim() === propertyId)?.raw?.landlordId || "").trim() || null;
      unitsByProperty.set(propertyId, await loadUnitsForProperty(db as any, propertyId, landlordId));
    })
  );
  return entries.map((entry) => {
    const propertyId = String(entry.raw?.propertyId || "").trim();
    const units = unitsByProperty.get(propertyId) || [];
    const lease = toCanonicalLeaseRecord(entry.id, entry.raw, units);
    const resolution = resolveUnitReference(
      units,
      lease.unitId || entry.raw?.unitNumber || entry.raw?.unitLabel || entry.raw?.unit || null
    );
    return { lease, units, resolution };
  });
}

export function buildDuplicateGroupKey(lease: CanonicalLeaseRecord) {
  return [
    String(lease.landlordId || "").trim(),
    String(lease.tenantId || "").trim(),
    String(lease.propertyId || "").trim(),
    String(lease.logicalUnitKey || lease.resolvedUnitId || lease.unitId || lease.unitLabel || lease.id).trim(),
  ].join("::");
}

export function summarizeLease(lease: CanonicalLeaseRecord) {
  return {
    id: lease.id,
    landlordId: lease.landlordId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    unitLabel: lease.unitLabel,
    resolvedUnitId: lease.resolvedUnitId,
    resolvedUnitNumber: lease.resolvedUnitNumber,
    monthlyRent: lease.sourceMonthlyRent,
    status: lease.status,
    startDate: lease.leaseStartDate,
    endDate: lease.leaseEndDate,
    createdAt: toMillisSafe(lease.createdAt),
  };
}

export async function getTenantCurrentLeaseDecision(tenantId: string, propertyId?: string | null) {
  const [directSnap, arraySnap] = await Promise.all([
    db.collection("leases").where("tenantId", "==", tenantId).get().catch(() => ({ docs: [] } as any)),
    db.collection("leases").where("tenantIds", "array-contains", tenantId).get().catch(() => ({ docs: [] } as any)),
  ]);
  const rawEntries = new Map<string, Record<string, unknown>>();
  for (const doc of [...(directSnap.docs || []), ...(arraySnap.docs || [])]) {
    rawEntries.set(doc.id, (doc.data() || {}) as Record<string, unknown>);
  }
  const filtered = Array.from(rawEntries.entries())
    .filter(([, raw]) => CURRENT_LEASE_STATUSES.has(String((raw as any)?.status || "").trim().toLowerCase()))
    .filter(([, raw]) => !propertyId || String((raw as any)?.propertyId || "").trim() === String(propertyId).trim())
    .map(([id, raw]) => ({ id, raw }));
  const canonical = await loadCanonicalLeasesByProperty(filtered);
  const byLogicalKey = new Map<string, CanonicalLeaseRecord[]>();
  canonical.forEach(({ lease }) => {
    const key = String(lease.logicalUnitKey || lease.id);
    const bucket = byLogicalKey.get(key) || [];
    bucket.push(lease);
    byLogicalKey.set(key, bucket);
  });
  if (!canonical.length) {
    return { winner: null, ambiguity: "no_current_lease", leases: [] as CanonicalLeaseRecord[] };
  }
  if (byLogicalKey.size > 1) {
    return { winner: null, ambiguity: "multiple_current_logical_leases", leases: canonical.map((entry) => entry.lease) };
  }
  const decision = pickLeaseWinner(canonical.map((entry) => entry.lease));
  return { winner: decision?.winner || null, ambiguity: null, leases: canonical.map((entry) => entry.lease) };
}


