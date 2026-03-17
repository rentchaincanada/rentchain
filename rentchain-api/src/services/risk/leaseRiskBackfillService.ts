import type { Firestore } from "firebase-admin/firestore";
import { db as defaultDb } from "../../config/firebase";
import { CURRENT_LEASE_STATUSES } from "../leaseCanonicalizationService";
import { recomputeLeaseRisk, type LeaseRiskRecomputeResult } from "./recomputeLeaseRisk";

export type LeaseRiskBackfillOptions = {
  dryRun?: boolean;
  limit?: number | null;
  startAfter?: string | null;
  onlyMissing?: boolean;
  recomputeAll?: boolean;
  propertyId?: string | null;
  landlordId?: string | null;
  leaseId?: string | null;
};

export type LeaseRiskBackfillSummary = {
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  processedLeaseIds: string[];
  skippedLeaseIds: Array<{ leaseId: string; reason: string }>;
  erroredLeaseIds: Array<{ leaseId: string; error: string }>;
};

type FirestoreLike = Pick<Firestore, "collection">;

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function hasRiskField(raw: Record<string, unknown>, field: "risk" | "riskScore" | "riskGrade" | "riskConfidence"): boolean {
  if (field === "risk") {
    return Boolean(raw?.risk && typeof raw.risk === "object");
  }
  if (field === "riskGrade") {
    return asTrimmedString(raw?.riskGrade || (raw?.risk as any)?.grade).length > 0;
  }
  if (field === "riskScore") {
    return typeof raw?.riskScore === "number" || typeof (raw?.risk as any)?.score === "number";
  }
  return typeof raw?.riskConfidence === "number" || typeof (raw?.risk as any)?.confidence === "number";
}

export function leaseNeedsRiskBackfill(raw: Record<string, unknown>): boolean {
  return (
    !hasRiskField(raw, "risk") ||
    !hasRiskField(raw, "riskScore") ||
    !hasRiskField(raw, "riskGrade") ||
    !hasRiskField(raw, "riskConfidence")
  );
}

function isEligibleStatus(raw: Record<string, unknown>, todayIso: string): boolean {
  const status = asTrimmedString(raw?.status).toLowerCase();
  if (CURRENT_LEASE_STATUSES.has(status)) return true;
  if (status === "ended" || status === "archived" || status === "cancelled" || status === "terminated") {
    return false;
  }
  const startDate = asTrimmedString(raw?.startDate || raw?.leaseStartDate || raw?.leaseStart);
  return Boolean(startDate && startDate >= todayIso);
}

function normalizeOptions(options: LeaseRiskBackfillOptions): Required<LeaseRiskBackfillOptions> {
  return {
    dryRun: Boolean(options.dryRun),
    limit: options.limit && Number.isFinite(Number(options.limit)) ? Number(options.limit) : 100,
    startAfter: asTrimmedString(options.startAfter),
    onlyMissing: options.recomputeAll ? false : options.onlyMissing !== false,
    recomputeAll: Boolean(options.recomputeAll),
    propertyId: asTrimmedString(options.propertyId),
    landlordId: asTrimmedString(options.landlordId),
    leaseId: asTrimmedString(options.leaseId),
  };
}

async function loadLeaseDocs(firestore: FirestoreLike, options: Required<LeaseRiskBackfillOptions>) {
  if (options.leaseId) {
    const snap = await firestore.collection("leases").doc(options.leaseId).get();
    return snap.exists ? [{ id: snap.id, data: (snap.data() || {}) as Record<string, unknown> }] : [];
  }

  let query: any = firestore.collection("leases");
  if (options.landlordId) {
    query = query.where("landlordId", "==", options.landlordId);
  }
  if (options.propertyId) {
    query = query.where("propertyId", "==", options.propertyId);
  }
  const snap = await query.get();
  const docs = (snap.docs || []).map((doc: any) => ({ id: doc.id, data: (doc.data() || {}) as Record<string, unknown> }));
  docs.sort((a, b) => a.id.localeCompare(b.id));
  const filtered = options.startAfter ? docs.filter((doc) => doc.id > options.startAfter) : docs;
  return filtered;
}

export async function runLeaseRiskBackfill(
  options: LeaseRiskBackfillOptions,
  deps?: {
    firestore?: FirestoreLike;
    recompute?: typeof recomputeLeaseRisk;
    todayIso?: string;
  }
): Promise<LeaseRiskBackfillSummary> {
  const normalized = normalizeOptions(options);
  const firestore = deps?.firestore || (defaultDb as FirestoreLike);
  const recompute = deps?.recompute || recomputeLeaseRisk;
  const todayIso = deps?.todayIso || new Date().toISOString().slice(0, 10);
  const docs = await loadLeaseDocs(firestore, normalized);

  const summary: LeaseRiskBackfillSummary = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    processedLeaseIds: [],
    skippedLeaseIds: [],
    erroredLeaseIds: [],
  };

  for (const doc of docs) {
    if (summary.scanned >= normalized.limit) break;

    if (!normalized.leaseId && !isEligibleStatus(doc.data, todayIso)) {
      continue;
    }
    if (normalized.onlyMissing && !leaseNeedsRiskBackfill(doc.data)) {
      continue;
    }

    summary.scanned += 1;
    try {
      const result: LeaseRiskRecomputeResult = await recompute(doc.id, {
        firestore,
        dryRun: normalized.dryRun,
      });
      if (result.updated || result.wouldUpdate) {
        summary.updated += 1;
        summary.processedLeaseIds.push(doc.id);
      } else {
        summary.skipped += 1;
        summary.skippedLeaseIds.push({
          leaseId: doc.id,
          reason: result.reason || "skipped",
        });
      }
    } catch (error: any) {
      summary.errors += 1;
      summary.erroredLeaseIds.push({
        leaseId: doc.id,
        error: error?.message || String(error),
      });
    }
  }

  return summary;
}
