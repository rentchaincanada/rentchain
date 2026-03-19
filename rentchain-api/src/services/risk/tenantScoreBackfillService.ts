import type { Firestore } from "firebase-admin/firestore";
import { db as defaultDb } from "../../config/firebase";
import { recomputeTenantScore, type TenantScoreRecomputeResult } from "./recomputeTenantScore";

export type TenantScoreBackfillOptions = {
  dryRun?: boolean;
  limit?: number | null;
  startAfter?: string | null;
  onlyMissing?: boolean;
  recomputeAll?: boolean;
  tenantId?: string | null;
  propertyId?: string | null;
  landlordId?: string | null;
};

export type TenantScoreBackfillSummary = {
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  processedTenantIds: string[];
  skippedTenantIds: Array<{ tenantId: string; reason: string }>;
  erroredTenantIds: Array<{ tenantId: string; error: string }>;
};

type FirestoreLike = Pick<Firestore, "collection">;

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function hasTenantScoreField(
  raw: Record<string, unknown>,
  field: "tenantScore" | "tenantScoreValue" | "tenantScoreGrade" | "tenantScoreConfidence" | "tenantScoreTimeline"
): boolean {
  if (field === "tenantScore") return Boolean(raw?.tenantScore && typeof raw.tenantScore === "object");
  if (field === "tenantScoreGrade") return asTrimmedString(raw?.tenantScoreGrade || (raw?.tenantScore as any)?.grade).length > 0;
  if (field === "tenantScoreValue") return typeof raw?.tenantScoreValue === "number" || typeof (raw?.tenantScore as any)?.score === "number";
  if (field === "tenantScoreConfidence") {
    return typeof raw?.tenantScoreConfidence === "number" || typeof (raw?.tenantScore as any)?.confidence === "number";
  }
  return Array.isArray(raw?.tenantScoreTimeline) && raw.tenantScoreTimeline.length > 0;
}

export function tenantNeedsScoreBackfill(raw: Record<string, unknown>): boolean {
  return (
    !hasTenantScoreField(raw, "tenantScore") ||
    !hasTenantScoreField(raw, "tenantScoreValue") ||
    !hasTenantScoreField(raw, "tenantScoreGrade") ||
    !hasTenantScoreField(raw, "tenantScoreConfidence") ||
    (hasTenantScoreField(raw, "tenantScore") && !hasTenantScoreField(raw, "tenantScoreTimeline"))
  );
}

function normalizeOptions(options: TenantScoreBackfillOptions): Required<TenantScoreBackfillOptions> {
  return {
    dryRun: Boolean(options.dryRun),
    limit: options.limit && Number.isFinite(Number(options.limit)) ? Number(options.limit) : 100,
    startAfter: asTrimmedString(options.startAfter),
    onlyMissing: options.recomputeAll ? false : options.onlyMissing !== false,
    recomputeAll: Boolean(options.recomputeAll),
    tenantId: asTrimmedString(options.tenantId),
    propertyId: asTrimmedString(options.propertyId),
    landlordId: asTrimmedString(options.landlordId),
  };
}

function extractTenantIds(raw: Record<string, unknown>): string[] {
  const tenantIds = Array.isArray(raw?.tenantIds)
    ? raw.tenantIds.map((value) => asTrimmedString(value)).filter(Boolean)
    : [];
  const tenantId = asTrimmedString(raw?.tenantId || raw?.primaryTenantId);
  return Array.from(new Set([...tenantIds, tenantId].filter(Boolean)));
}

async function loadPropertyTenantIds(firestore: FirestoreLike, propertyId: string, landlordId?: string) {
  let query: any = firestore.collection("leases").where("propertyId", "==", propertyId);
  if (landlordId) {
    query = query.where("landlordId", "==", landlordId);
  }
  const snap = await query.get();
  const ids = new Set<string>();
  for (const doc of snap.docs || []) {
    const raw = (doc.data() || {}) as Record<string, unknown>;
    for (const tenantId of extractTenantIds(raw)) ids.add(tenantId);
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

async function loadTargetTenantDocs(firestore: FirestoreLike, options: Required<TenantScoreBackfillOptions>) {
  if (options.tenantId) {
    const snap = await firestore.collection("tenants").doc(options.tenantId).get();
    return snap.exists ? [{ id: snap.id, data: (snap.data() || {}) as Record<string, unknown> }] : [];
  }

  let candidateIds: string[] | null = null;
  if (options.propertyId) {
    candidateIds = await loadPropertyTenantIds(firestore, options.propertyId, options.landlordId || undefined);
  }

  let docs: Array<{ id: string; data: Record<string, unknown> }> = [];
  if (candidateIds) {
    const loaded = await Promise.all(
      candidateIds.map(async (tenantId) => {
        const snap = await firestore.collection("tenants").doc(tenantId).get().catch(() => null);
        if (!snap?.exists) return null;
        return { id: snap.id, data: (snap.data() || {}) as Record<string, unknown> };
      })
    );
    docs = loaded.filter((entry): entry is { id: string; data: Record<string, unknown> } => Boolean(entry));
  } else {
    let query: any = firestore.collection("tenants");
    if (options.landlordId) {
      query = query.where("landlordId", "==", options.landlordId);
    }
    const snap = await query.get();
    docs = (snap.docs || []).map((doc: any) => ({ id: doc.id, data: (doc.data() || {}) as Record<string, unknown> }));
  }

  docs.sort((a, b) => a.id.localeCompare(b.id));
  if (options.startAfter) {
    docs = docs.filter((doc) => doc.id > options.startAfter);
  }
  return docs;
}

function tenantMatchesFilters(
  tenant: { id: string; data: Record<string, unknown> },
  options: Required<TenantScoreBackfillOptions>,
  propertyTenantIdSet: Set<string> | null
): string | null {
  if (options.landlordId) {
    const tenantLandlordId = asTrimmedString(tenant.data.landlordId);
    if (tenantLandlordId && tenantLandlordId !== options.landlordId) {
      return "landlord_filter_no_match";
    }
  }
  if (options.propertyId && propertyTenantIdSet && !propertyTenantIdSet.has(tenant.id)) {
    return "property_filter_no_match";
  }
  return null;
}

export async function runTenantScoreBackfill(
  options: TenantScoreBackfillOptions,
  deps?: {
    firestore?: FirestoreLike;
    recompute?: typeof recomputeTenantScore;
  }
): Promise<TenantScoreBackfillSummary> {
  const normalized = normalizeOptions(options);
  const firestore = deps?.firestore || (defaultDb as FirestoreLike);
  const recompute = deps?.recompute || recomputeTenantScore;
  const propertyTenantIds = normalized.propertyId ? await loadPropertyTenantIds(firestore, normalized.propertyId, normalized.landlordId || undefined) : null;
  const propertyTenantIdSet = propertyTenantIds ? new Set(propertyTenantIds) : null;
  const docs = await loadTargetTenantDocs(firestore, normalized);

  const summary: TenantScoreBackfillSummary = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    processedTenantIds: [],
    skippedTenantIds: [],
    erroredTenantIds: [],
  };

  for (const doc of docs) {
    if (summary.scanned >= normalized.limit) break;

    const filterReason = tenantMatchesFilters(doc, normalized, propertyTenantIdSet);
    if (filterReason) {
      if (normalized.tenantId) {
        summary.scanned += 1;
        summary.skipped += 1;
        summary.skippedTenantIds.push({ tenantId: doc.id, reason: filterReason });
      }
      continue;
    }

    if (normalized.onlyMissing && !tenantNeedsScoreBackfill(doc.data)) {
      continue;
    }

    summary.scanned += 1;
    try {
      const result: TenantScoreRecomputeResult = await recompute(doc.id, {
        firestore,
        dryRun: normalized.dryRun,
        trigger: "backfill",
        source: "tenant_score_backfill",
      });
      if (result.updated || result.wouldUpdate) {
        summary.updated += 1;
        summary.processedTenantIds.push(doc.id);
      } else {
        summary.skipped += 1;
        summary.skippedTenantIds.push({
          tenantId: doc.id,
          reason: result.reason || "skipped",
        });
      }
    } catch (error: any) {
      summary.errors += 1;
      summary.erroredTenantIds.push({
        tenantId: doc.id,
        error: error?.message || String(error),
      });
    }
  }

  return summary;
}
