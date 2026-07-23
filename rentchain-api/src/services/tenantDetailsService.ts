// rentchain-api/src/services/tenantDetailsService.ts
import { db } from "../firebase";
import {
  computeNoResponseState,
  getLeaseNoticeByLeaseId,
} from "./leaseNoticeWorkflowService";
import {
  loadUnitsForProperty,
  resolveUnitReference,
  toCanonicalLeaseRecord,
  isCurrentLeaseStatus,
} from "./leaseCanonicalizationService";
import {
  groupLeaseAgreementCandidates,
  pickAgreementWinner,
  pickTenantWinningAgreement,
} from "./leasePartyConsolidationService";
import { buildCredibilityInsights, type CredibilityInsights } from "./risk/credibilityInsights";
import { buildMoveInRequirements, type MoveInRequirements } from "./moveInRequirements";
import {
  buildMoveInReadinessRecord,
  getPersistedMoveInReadinessRecord,
  listMoveInReadinessEvents,
  type MoveInReadinessRecord as MoveInReadiness,
} from "./tenantMoveInReadinessService";
import { deriveLeaseExecution } from "./leaseExecution/deriveLeaseExecution";
import { buildDerivedTenancyFromTenant, listTenanciesByTenantId } from "./tenanciesService";
import type { TenantScore, TenantScoreTimelineEntry } from "./risk/tenantScoreTypes";
import type { RiskGrade } from "./risk/riskTypes";
import { isTargetedHiddenTenantId } from "../lib/testDataVisibilityTargets";
import {
  deriveTenantLifecycle,
  type TenantLifecycleResult,
} from "../lib/tenants/deriveTenantLifecycle";
import { deriveLeaseOccupancyCoherence } from "../lib/leases/deriveLeaseOccupancyCoherence";
import { getSignedLeaseDocumentDownload } from "./signing/leaseSigningService";

export interface TenantRecord {
  id: string;
  landlordId?: string | null;
  fullName: string;
  email?: string;
  phone?: string;
  hiddenFromActiveLists?: boolean;
  cleanupReason?: string | null;
  cleanupBatch?: string | null;
  propertyId?: string | null;
  applicationId?: string | null;
  unitId?: string | null;
  propertyName?: string;
  unit?: string;
  currentLeaseId?: string | null;
  leaseStart?: string | null;
  leaseEnd?: string | null;
  monthlyRent?: number | null;
  status?: string;
  balance?: number;
  riskLevel?: string;
  tenantScore?: TenantScore | null;
  tenantScoreValue?: number | null;
  tenantScoreGrade?: RiskGrade | null;
  tenantScoreConfidence?: number | null;
  tenantScoreTimeline?: TenantScoreTimelineEntry[];
  source?: string | null;
  createdAt?: string | number | null;
  lifecycle?: TenantLifecycleResult;
}

export interface TenantLease {
  id?: string;
  tenantId: string;
  propertyId?: string | null;
  propertyName: string;
  propertyAddress?: string | null;
  unitId?: string | null;
  unit: string;
  leaseStart: string | null;
  leaseEnd: string | null;
  monthlyRent: number;
  status?: string | null;
  signedDocumentUrl?: string | null;
  signedDocumentExpiresInSeconds?: number | null;
  signedDocumentSource?: "signedDocument" | "legacySignedDocumentUrl" | null;
}

export interface TenantPaymentDto {
  id: string;
  tenantId: string;
  amount: number;
  paidAt: string;
  method?: string | null;
  notes?: string | null;
  status: string;
}

export interface TenantLedgerEventDto {
  id: string;
  tenantId: string;
  type: string;
  amount: number;
  date: string;
  method?: string | null;
  notes?: string | null;
}

export interface TenantCredibilityInsights extends CredibilityInsights {}

export interface TenantMoveInReadiness extends MoveInReadiness {}
export interface TenantMoveInRequirements extends MoveInRequirements {}

const FALLBACK_TENANTS: TenantRecord[] = [
  {
    id: "t1",
    fullName: "Sarah Thompson",
    email: "sarah@example.com",
    phone: "902-555-1010",
    propertyName: "Main St. Apartments",
    unit: "101",
    leaseStart: "2024-01-01",
    leaseEnd: "2025-01-01",
    monthlyRent: 1450,
    status: "Current",
    balance: 0,
    riskLevel: "Low",
  },
  {
    id: "t2",
    fullName: "Daniel Roberts",
    email: "daniel@example.com",
    phone: "902-555-2020",
    propertyName: "Downtown Lofts",
    unit: "305",
    leaseStart: "2023-10-01",
    leaseEnd: null,
    monthlyRent: 1650,
    status: "Current",
    balance: 325,
    riskLevel: "Medium",
  },
  {
    id: "t3",
    fullName: "Emily Chen",
    email: "emily@example.com",
    phone: "902-555-3030",
    propertyName: "Harbourview Towers",
    unit: "804",
    leaseStart: "2022-07-15",
    leaseEnd: null,
    monthlyRent: 1800,
    status: "Current",
    balance: 0,
    riskLevel: "Low",
  },
];

type TenantQueryOptions = {
  landlordId?: string | null;
  excludeHiddenFromActiveLists?: boolean;
};

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function toDateOnly(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ts = toMillis(value);
  if (!ts) {
    const parsed = Date.parse(String(value));
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return new Date(ts).toISOString().slice(0, 10);
}

function asNumber(value: any): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function pickString(...values: any[]): string | null {
  for (const value of values) {
    const next = String(value || "").trim();
    if (next) return next;
  }
  return null;
}

function normalizeIdentityString(value: any): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeTenantEmail(value: any): string | null {
  const next = normalizeIdentityString(value);
  return next && next.includes("@") ? next : null;
}

const TENANT_PROFILE_LEASE_STATUSES = new Set([
  "active",
  "current",
  "notice_pending",
  "renewal_pending",
  "renewal_accepted",
  "move_out_pending",
  "signed",
  "signed_future",
  "fully_executed",
  "pending_signature",
  "sent",
  "ready_for_tenant_signature",
  "tenant_signed",
  "ready_for_landlord_signature",
  "landlord_signed",
]);

function isTenantProfileLeaseCandidate(raw: Record<string, unknown>): boolean {
  const status = normalizeIdentityString((raw as any)?.status);
  const signingStatus = normalizeIdentityString(
    (raw as any)?.currentSigningStatus ||
      (raw as any)?.signingStatus ||
      (raw as any)?.leaseSigningStatus ||
      (raw as any)?.providerSigningStatus
  );
  return isCurrentLeaseStatus(status) || TENANT_PROFILE_LEASE_STATUSES.has(status) || TENANT_PROFILE_LEASE_STATUSES.has(signingStatus);
}

function latestTimestampMillis(record: Record<string, unknown> | null | undefined, keys: string[]): number {
  if (!record) return 0;
  return Math.max(0, ...keys.map((key) => toMillis((record as any)?.[key]) || 0));
}

async function loadLatestLeaseSigningRequest(leaseId: string | null | undefined, landlordId?: string | null) {
  const normalizedLeaseId = String(leaseId || "").trim();
  const normalizedLandlordId = String(landlordId || "").trim();
  if (!normalizedLeaseId) return null;
  try {
    let query: FirebaseFirestore.Query = db.collection("leaseSigningRequests").where("leaseId", "==", normalizedLeaseId);
    if (normalizedLandlordId) query = query.where("landlordId", "==", normalizedLandlordId);
    const snap = await query.get();
    return (
      (snap.docs || [])
        .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
        .sort(
          (a: any, b: any) =>
            latestTimestampMillis(b, ["currentStatusAt", "signedAt", "sentAt", "updatedAt", "createdAt"]) -
            latestTimestampMillis(a, ["currentStatusAt", "signedAt", "sentAt", "updatedAt", "createdAt"])
        )[0] || null
    );
  } catch (err) {
    console.error("[tenantDetailsService] loadLatestLeaseSigningRequest error", err);
    return null;
  }
}

async function loadLatestSigningSignedEvent(leaseId: string | null | undefined) {
  const normalizedLeaseId = String(leaseId || "").trim();
  if (!normalizedLeaseId) return null;
  try {
    const snap = await db.collection("canonicalEvents").where("action", "==", "signing_signed").limit(100).get();
    return (
      (snap.docs || [])
        .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }))
        .filter((event: any) => String(event?.resource?.type || "") === "lease")
        .filter((event: any) => String(event?.resource?.id || "") === normalizedLeaseId)
        .sort(
          (a: any, b: any) =>
            latestTimestampMillis(b, ["occurredAt", "recordedAt", "createdAt"]) -
            latestTimestampMillis(a, ["occurredAt", "recordedAt", "createdAt"])
        )[0] || null
    );
  } catch (err) {
    console.error("[tenantDetailsService] loadLatestSigningSignedEvent error", err);
    return null;
  }
}

function buildTenantProfileLeaseRawProjection(params: {
  raw: Record<string, unknown> | null;
  signingRequest: any | null;
  signingSignedEvent: any | null;
}): Record<string, unknown> | null {
  if (!params.raw) return null;
  const signingStatus = normalizeIdentityString(params.signingRequest?.currentSigningStatus);
  const signedByRequest = ["signed", "completed", "complete"].includes(signingStatus);
  const signedByEvent = Boolean(params.signingSignedEvent);
  const currentStatusAt =
    pickString(params.signingRequest?.currentStatusAt, params.signingSignedEvent?.occurredAt, params.signingSignedEvent?.recordedAt) ||
    null;

  return {
    ...params.raw,
    currentSigningStatus:
      signedByRequest || signedByEvent
        ? "signed"
        : signingStatus || (params.raw as any)?.currentSigningStatus || null,
    signingStatus:
      signedByRequest || signedByEvent
        ? "signed"
        : signingStatus || (params.raw as any)?.signingStatus || null,
    currentStatusAt: currentStatusAt || (params.raw as any)?.currentStatusAt || null,
    sentAt: params.signingRequest?.sentAt || (params.raw as any)?.sentAt || null,
    documentId: params.signingRequest?.documentId || (params.raw as any)?.documentId || null,
    documentHash: params.signingRequest?.documentHash || (params.raw as any)?.documentHash || null,
    manifestHash: params.signingRequest?.manifestHash || (params.raw as any)?.manifestHash || null,
    jurisdictionCode: params.signingRequest?.jurisdictionCode || (params.raw as any)?.jurisdictionCode || null,
    templateVersion: params.signingRequest?.templateVersion || (params.raw as any)?.templateVersion || null,
  };
}

function isHiddenFromActiveLists(tenant: Pick<TenantRecord, "id" | "hiddenFromActiveLists">) {
  return tenant.hiddenFromActiveLists === true || isTargetedHiddenTenantId(tenant.id);
}

function mapTenant(docId: string, data: any): TenantRecord {
  const createdAt = data.createdAt ?? data.created_at ?? null;
  const createdAtMs = toMillis(createdAt);
  const createdAtIso =
    typeof createdAt === "string"
      ? createdAt
      : createdAtMs
      ? new Date(createdAtMs).toISOString()
      : null;

  return {
    id: docId,
    landlordId: data.landlordId ?? null,
    fullName: data.fullName ?? data.name ?? "Unnamed Tenant",
    email: data.email ?? null,
    phone: data.phone ?? null,
    hiddenFromActiveLists: data.hiddenFromActiveLists === true,
    cleanupReason: data.cleanupReason ?? null,
    cleanupBatch: data.cleanupBatch ?? null,
    propertyId: data.propertyId ?? null,
    applicationId: data.applicationId ?? data.application_id ?? data.sourceApplication ?? null,
    unitId: data.unitId ?? data.unit ?? null,
    propertyName: data.propertyName ?? data.property ?? null,
    unit: data.unit ?? data.unitLabel ?? null,
    currentLeaseId: data.currentLeaseId ?? null,
    leaseStart: data.leaseStart ?? null,
    leaseEnd: data.leaseEnd ?? null,
    monthlyRent: data.monthlyRent ?? null,
    status: data.status ?? "Current",
    balance: data.balance ?? 0,
    riskLevel: data.riskLevel ?? "Low",
    tenantScore: data.tenantScore ?? null,
    tenantScoreValue: data.tenantScoreValue ?? data.tenantScore?.score ?? null,
    tenantScoreGrade: data.tenantScoreGrade ?? data.tenantScore?.grade ?? null,
    tenantScoreConfidence: data.tenantScoreConfidence ?? data.tenantScore?.confidence ?? null,
    tenantScoreTimeline: Array.isArray(data.tenantScoreTimeline) ? data.tenantScoreTimeline : [],
    source: data.source ?? null,
    createdAt: createdAtIso ?? createdAt ?? null,
  };
}

function tenantIdentityKeys(tenant: TenantRecord): string[] {
  const landlordId = normalizeIdentityString(tenant.landlordId);
  if (!landlordId) return [`tenant:${tenant.id}`];

  const applicationId = normalizeIdentityString(tenant.applicationId);
  const email = normalizeTenantEmail(tenant.email);
  const propertyId = normalizeIdentityString(tenant.propertyId);
  const unitId = normalizeIdentityString(tenant.unitId || tenant.unit);
  const keys: string[] = [];

  if (applicationId) keys.push(`application:${landlordId}:${applicationId}`);
  if (email && propertyId && unitId) keys.push(`unit_email:${landlordId}:${email}:${propertyId}:${unitId}`);
  if (email && applicationId) keys.push(`application_email:${landlordId}:${email}:${applicationId}`);

  return keys.length ? keys : [`tenant:${tenant.id}`];
}

function tenantCanonicalRank(tenant: TenantRecord): number {
  const source = normalizeIdentityString((tenant as any).source);
  let score = 0;
  if (source === "application_conversion") score += 1000;
  if (tenant.applicationId) score += 300;
  if (source === "invite") score -= 100;
  if (tenant.currentLeaseId) score += 80;
  if (tenant.propertyId) score += 20;
  if (tenant.unitId) score += 20;
  if (tenant.propertyName) score += 5;
  if (tenant.unit && normalizeIdentityString(tenant.unit) !== normalizeIdentityString(tenant.unitId)) score += 5;
  score += Math.min(toMillis(tenant.createdAt) ?? 0, 9_999_999_999_999) / 1_000_000_000_000;
  return score;
}

function pickCanonicalTenant(left: TenantRecord, right: TenantRecord): TenantRecord {
  const leftRank = tenantCanonicalRank(left);
  const rightRank = tenantCanonicalRank(right);
  if (rightRank > leftRank) return right;
  if (rightRank < leftRank) return left;
  return String(right.id).localeCompare(String(left.id)) < 0 ? right : left;
}

function dedupeTenantRecords(tenants: TenantRecord[]): TenantRecord[] {
  const groupByKey = new Map<string, string>();
  const groups = new Map<string, TenantRecord[]>();

  for (const tenant of tenants) {
    const keys = tenantIdentityKeys(tenant);
    const groupId = keys.map((key) => groupByKey.get(key)).find(Boolean) || keys[0];
    const group = groups.get(groupId) || [];
    group.push(tenant);
    groups.set(groupId, group);
    for (const key of keys) groupByKey.set(key, groupId);
  }

  return Array.from(groups.values()).map((group) =>
    group.reduce((winner, candidate) => pickCanonicalTenant(winner, candidate))
  );
}

async function loadTenantRecord(tenantId: string, landlordId?: string | null): Promise<TenantRecord | null> {
  try {
    const doc = await db.collection("tenants").doc(tenantId).get();
    if (doc.exists) {
      const data = doc.data() as any;
      if (landlordId && data?.landlordId && String(data.landlordId) !== String(landlordId)) {
        return null;
      }
      return mapTenant(doc.id, data);
    }
  } catch (err) {
    console.error("[tenantDetailsService] loadTenantRecord error", err);
  }
  return null;
}

async function loadCurrentLeaseSnapshot(tenant: TenantRecord | null, landlordId?: string | null) {
  const tenantId = String(tenant?.id || "").trim();
  if (!tenantId) return null;
  try {
    const leasesRef = db.collection("leases");
    const hintedLeaseId = String(tenant?.currentLeaseId || "").trim();
    const hintedLeasePromise = hintedLeaseId
      ? leasesRef.doc(hintedLeaseId).get().catch(() => null)
      : Promise.resolve(null);
    const [hintedSnap, directSnap, arraySnap] = await Promise.all([
      hintedLeasePromise,
      leasesRef.where("tenantId", "==", tenantId).get().catch(() => ({ docs: [] } as any)),
      leasesRef.where("tenantIds", "array-contains", tenantId).get().catch(() => ({ docs: [] } as any)),
    ]);

    const candidates = new Map<string, Record<string, unknown>>();
    if (hintedSnap?.exists) {
      candidates.set(hintedSnap.id, hintedSnap.data() as Record<string, unknown>);
    }
    for (const doc of [...(directSnap.docs || []), ...(arraySnap.docs || [])]) {
      if (!doc?.id) continue;
      candidates.set(doc.id, (doc.data() || {}) as Record<string, unknown>);
    }

    const currentEntries = Array.from(candidates.entries()).filter(([, raw]) => {
      const landlordMatch = !landlordId || String((raw as any)?.landlordId || "").trim() === String(landlordId);
      const tenantMatch = Array.isArray((raw as any)?.tenantIds)
        ? (raw as any).tenantIds.map((value: any) => String(value || "").trim()).includes(tenantId)
        : String((raw as any)?.tenantId || (raw as any)?.primaryTenantId || "").trim() === tenantId;
      return landlordMatch && tenantMatch && isTenantProfileLeaseCandidate(raw);
    });
    if (!currentEntries.length) return null;

    const propertyIds = Array.from(
      new Set(
        currentEntries
          .map(([, raw]) => String((raw as any)?.propertyId || tenant?.propertyId || "").trim())
          .filter(Boolean)
      )
    );
    const unitsByProperty = new Map<string, Awaited<ReturnType<typeof loadUnitsForProperty>>>();
    await Promise.all(
      propertyIds.map(async (propertyId) => {
        unitsByProperty.set(propertyId, await loadUnitsForProperty(db as any, propertyId, landlordId));
      })
    );

    const agreementCandidates = currentEntries.map(([id, raw]) => {
      const propertyId = String((raw as any)?.propertyId || tenant?.propertyId || "").trim();
      return {
        lease: toCanonicalLeaseRecord(id, raw, unitsByProperty.get(propertyId) || []),
        raw,
      };
    });
    const grouped = groupLeaseAgreementCandidates(agreementCandidates);
    const tenantGroup = pickTenantWinningAgreement([...grouped.mergeGroups, ...grouped.ambiguousGroups], tenantId);
    if (tenantGroup) {
      return pickAgreementWinner(tenantGroup.candidates).lease;
    }

    const directMatch = agreementCandidates.find((candidate) =>
      Array.isArray((candidate.raw as any)?.tenantIds)
        ? (candidate.raw as any).tenantIds.map((value: any) => String(value || "").trim()).includes(tenantId)
        : String((candidate.raw as any)?.tenantId || "").trim() === tenantId
    );
    return directMatch?.lease || pickAgreementWinner(agreementCandidates).lease;
  } catch (err) {
    console.error("[tenantDetailsService] loadCurrentLeaseSnapshot error", err);
    return null;
  }
}

async function loadPropertyRecord(propertyId: string | null | undefined) {
  const target = String(propertyId || "").trim();
  if (!target) return null;
  try {
    const snap = await db.collection("properties").doc(target).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return {
      id: snap.id,
      name: pickString(data?.name, data?.nickname, data?.addressLine1, data?.address) || "Property",
      addressLine1: pickString(data?.addressLine1, data?.address),
      addressLine2: pickString(data?.addressLine2),
      city: pickString(data?.city),
      province: pickString(data?.province),
      postalCode: pickString(data?.postalCode),
    };
  } catch (err) {
    console.error("[tenantDetailsService] loadPropertyRecord error", err);
    return null;
  }
}

async function loadUnitRecord(
  propertyId: string | null | undefined,
  unitId: string | null | undefined,
  unitLabel?: string | null,
  landlordId?: string | null
) {
  const propertyKey = String(propertyId || "").trim();
  if (!propertyKey) return null;
  try {
    const units = await loadUnitsForProperty(db as any, propertyKey, landlordId);
    const candidates = [
      resolveUnitReference(units, unitId),
      resolveUnitReference(units, unitLabel),
      resolveUnitReference(units, String(unitId || unitLabel || "").trim()),
    ];
    const resolution = candidates.find((candidate) => candidate.unit) || null;
    return resolution?.unit ? { id: resolution.unit.id, ...(resolution.unit.raw as any) } : null;
  } catch (err) {
    console.error("[tenantDetailsService] loadUnitRecord error", err);
    return null;
  }
}

async function loadLatestLeaseNoticeSummary(leaseId: string | null | undefined, leaseStatus: string | null | undefined) {
  const target = String(leaseId || "").trim();
  if (!target) return null;
  try {
    const notices = await getLeaseNoticeByLeaseId(target);
    const latest = notices[0] || null;
    if (!latest) return null;
    return {
      noticeId: latest.id,
      noticeType: latest.noticeType || null,
      sentAt: latest.sentAt || null,
      tenantViewedAt: latest.tenantViewedAt || null,
      tenantResponse: latest.tenantResponse || "pending",
      responseDeadlineAt: latest.responseDeadlineAt || null,
      deliveryStatus: latest.deliveryStatus || null,
      leaseStatusAfterResponse: String(leaseStatus || "").trim().toLowerCase() || null,
      noResponse: computeNoResponseState(latest),
    };
  } catch (err) {
    console.error("[tenantDetailsService] loadLatestLeaseNoticeSummary error", err);
    return null;
  }
}

async function loadLeaseRawById(leaseId: string | null | undefined) {
  const target = String(leaseId || "").trim();
  if (!target) return null;
  try {
    const snap = await db.collection("leases").doc(target).get();
    if (!snap.exists) return null;
    return (snap.data() || {}) as Record<string, unknown>;
  } catch (err) {
    console.error("[tenantDetailsService] loadLeaseRawById error", err);
    return null;
  }
}

async function loadLatestTenantInviteState(tenant: TenantRecord | null, landlordId?: string | null) {
  const tenantId = String(tenant?.id || "").trim();
  const tenantEmail = String(tenant?.email || "").trim().toLowerCase();
  if (!tenantId && !tenantEmail) return null;
  try {
    const query = landlordId
      ? db.collection("tenantInvites").where("landlordId", "==", landlordId).limit(50)
      : db.collection("tenantInvites").limit(50);
    const snap = await query.get();
    const matches = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((invite) => {
        const inviteTenantId = String(invite.tenantId || "").trim();
        const inviteEmail = String(invite.tenantEmail || invite.email || "").trim().toLowerCase();
        return (tenantId && inviteTenantId === tenantId) || (tenantEmail && inviteEmail === tenantEmail);
      });
    matches.sort((a, b) => {
      const aTs = toMillis(a.redeemedAt) ?? toMillis(a.sentAt) ?? toMillis(a.createdAt) ?? 0;
      const bTs = toMillis(b.redeemedAt) ?? toMillis(b.sentAt) ?? toMillis(b.createdAt) ?? 0;
      return bTs - aTs;
    });
    if (!matches.length) return null;
    const latest = matches[0] as any;
    return {
      createdAt: latest.createdAt ?? null,
      sentAt: latest.sentAt ?? latest.createdAt ?? null,
      redeemedAt: latest.redeemedAt ?? null,
      status: latest.status ?? null,
    };
  } catch (err) {
    console.error("[tenantDetailsService] loadLatestTenantInviteState error", err);
    return null;
  }
}

async function loadSignedLeaseDocumentLink(leaseId: string | null | undefined, landlordId?: string | null) {
  const normalizedLeaseId = String(leaseId || "").trim();
  const normalizedLandlordId = String(landlordId || "").trim();
  if (!normalizedLeaseId || !normalizedLandlordId) return null;
  try {
    const signedDocument = await getSignedLeaseDocumentDownload({
      leaseId: normalizedLeaseId,
      landlordId: normalizedLandlordId,
    });
    const documentUrl = String(signedDocument?.documentUrl || "").trim();
    if (!documentUrl) return null;
    return {
      signedDocumentUrl: documentUrl,
      signedDocumentExpiresInSeconds: signedDocument.expiresInSeconds ?? null,
      signedDocumentSource: signedDocument.source ?? null,
    };
  } catch (err) {
    console.error("[tenantDetailsService] loadSignedLeaseDocumentLink error", err);
    return null;
  }
}

export async function getTenantsList(opts: TenantQueryOptions = {}): Promise<TenantRecord[]> {
  const landlordId = opts.landlordId?.trim?.() ? String(opts.landlordId).trim() : null;
  const excludeHiddenFromActiveLists = opts.excludeHiddenFromActiveLists === true;

  try {
    const collection = db.collection("tenants");
    const snap = landlordId
      ? await collection.where("landlordId", "==", landlordId).get()
      : await collection.get();

    const out: TenantRecord[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as any;
      const tenant = mapTenant(doc.id, data);
      if (excludeHiddenFromActiveLists && isHiddenFromActiveLists(tenant)) return;
      out.push(tenant);
    });

    const deduped = dedupeTenantRecords(out);
    const hydrated = await Promise.all(
      deduped.map((tenant) => hydrateTenantDisplayFields(tenant, landlordId))
    );

    hydrated.sort((a, b) => {
      const aTs = toMillis(a.createdAt);
      const bTs = toMillis(b.createdAt);
      return (bTs ?? 0) - (aTs ?? 0);
    });

    if (hydrated.length === 0 && !landlordId) {
      console.warn("[tenantDetailsService] No tenants collection, using FALLBACK_TENANTS");
      return [...FALLBACK_TENANTS];
    }

    return hydrated;
  } catch (err) {
    console.error("[tenantDetailsService] getTenantsList error", err);
    if (landlordId) return [];
    return [...FALLBACK_TENANTS];
  }
}

async function loadApplicationRawById(applicationId: string | null | undefined) {
  const target = String(applicationId || "").trim();
  if (!target) return null;
  try {
    const rentalSnap = await db.collection("rentalApplications").doc(target).get();
    if (rentalSnap.exists) return { id: rentalSnap.id, ...(rentalSnap.data() || {}) } as Record<string, unknown>;
    const legacySnap = await db.collection("applications").doc(target).get();
    if (legacySnap.exists) return { id: legacySnap.id, ...(legacySnap.data() || {}) } as Record<string, unknown>;
  } catch (err) {
    console.error("[tenantDetailsService] loadApplicationRawById error", err);
  }
  return null;
}

async function hydrateTenantDisplayFields(tenant: TenantRecord, landlordId?: string | null): Promise<TenantRecord> {
  const hydrated: TenantRecord = { ...tenant };
  const canonicalLease = await loadCurrentLeaseSnapshot(hydrated, landlordId);
  const property = await loadPropertyRecord(hydrated.propertyId || null);
  const unit = await loadUnitRecord(
    hydrated.propertyId || null,
    hydrated.unitId || null,
    hydrated.unit || null,
    landlordId
  );

  const propertyName = pickString(hydrated.propertyName, property?.name);
  if (propertyName) hydrated.propertyName = propertyName;

  const resolvedUnitLabel = pickString(
    unit?.unitNumber,
    unit?.label,
    unit?.name,
    normalizeIdentityString(hydrated.unit) !== normalizeIdentityString(hydrated.unitId) ? hydrated.unit : null
  );
  if (resolvedUnitLabel) hydrated.unit = resolvedUnitLabel;

  if (canonicalLease) {
    hydrated.currentLeaseId = canonicalLease.id;
    hydrated.leaseStart = canonicalLease.leaseStartDate || null;
    hydrated.leaseEnd = canonicalLease.leaseEndDate || null;
    hydrated.monthlyRent = canonicalLease.currentRent ?? null;
  } else {
    hydrated.currentLeaseId = null;
    hydrated.leaseStart = null;
    hydrated.leaseEnd = null;
    hydrated.monthlyRent = null;
  }

  hydrated.lifecycle = deriveTenantLifecycle({
    tenantStatus: hydrated.status,
    applicationId: hydrated.applicationId,
    leaseStatus: canonicalLease?.status || null,
    currentLeaseId: canonicalLease?.id || null,
    leaseId: canonicalLease?.id || null,
    source: hydrated.source,
    hiddenFromActiveLists: hydrated.hiddenFromActiveLists,
  });

  return hydrated;
}

export async function getTenantDetailBundle(tenantId: string, opts: TenantQueryOptions = {}) {
  const landlordId = opts.landlordId?.trim?.() ? String(opts.landlordId).trim() : null;

  let tenant = await loadTenantRecord(tenantId, landlordId);
  if (!tenant && !landlordId) {
    tenant =
      FALLBACK_TENANTS.find((t) => t.id === tenantId) ??
      FALLBACK_TENANTS[0];
  }

  const currentLeaseRecord = await loadCurrentLeaseSnapshot(tenant, landlordId);
  const baseCurrentLeaseRaw = await loadLeaseRawById(currentLeaseRecord?.id || null);
  const [tenantInviteState, tenantTenancies, applicationRaw, latestSigningRequest, latestSigningSignedEvent] = await Promise.all([
    loadLatestTenantInviteState(tenant, landlordId),
    tenant ? listTenanciesByTenantId(tenant.id, { landlordId }).catch((err) => {
      console.error("[tenantDetailsService] listTenanciesByTenantId error", err);
      return [];
    }) : Promise.resolve([]),
    loadApplicationRawById(tenant?.applicationId || null),
    loadLatestLeaseSigningRequest(currentLeaseRecord?.id || null, landlordId),
    loadLatestSigningSignedEvent(currentLeaseRecord?.id || null),
  ]);
  const currentLeaseRaw = buildTenantProfileLeaseRawProjection({
    raw: baseCurrentLeaseRaw,
    signingRequest: latestSigningRequest,
    signingSignedEvent: latestSigningSignedEvent,
  });
  const currentTenancy = tenantTenancies[0] || buildDerivedTenancyFromTenant(tenant);
  const property = await loadPropertyRecord(currentLeaseRecord?.propertyId || tenant?.propertyId || null);
  const unit = await loadUnitRecord(
    currentLeaseRecord?.propertyId || tenant?.propertyId || null,
    currentLeaseRecord?.unitId || tenant?.unitId || tenant?.unit || null,
    currentLeaseRecord?.unitLabel || tenant?.unit || null,
    landlordId
  );
  const latestLeaseNoticeSummary = await loadLatestLeaseNoticeSummary(currentLeaseRecord?.id || null, currentLeaseRecord?.status || null);
  const signedDocumentLink = await loadSignedLeaseDocumentLink(currentLeaseRecord?.id || null, landlordId);

  const lease: TenantLease | null = currentLeaseRecord
    ? {
        id: currentLeaseRecord.id,
        tenantId,
        propertyId: currentLeaseRecord.propertyId,
        propertyName:
          property?.name || currentLeaseRecord.propertyLabel || tenant?.propertyName || "Unknown Property",
        propertyAddress: [property?.addressLine1, property?.city, property?.province].filter(Boolean).join(", ") || null,
        unitId: currentLeaseRecord.unitId,
        unit:
          pickString(unit?.unitNumber, unit?.label, currentLeaseRecord.unitLabel, currentLeaseRecord.unitId, tenant?.unit) || "N/A",
        leaseStart: currentLeaseRecord.leaseStartDate,
        leaseEnd: currentLeaseRecord.leaseEndDate,
        monthlyRent: Number(currentLeaseRecord.currentRent || 0),
        status: currentLeaseRecord.status,
        signedDocumentUrl: signedDocumentLink?.signedDocumentUrl || null,
        signedDocumentExpiresInSeconds: signedDocumentLink?.signedDocumentExpiresInSeconds ?? null,
        signedDocumentSource: signedDocumentLink?.signedDocumentSource || null,
      }
    : null;

  if (tenant && lease) {
    tenant.propertyId = lease.propertyId || tenant.propertyId || null;
    tenant.unitId = lease.unitId || tenant.unitId || null;
    tenant.propertyName = lease.propertyName || tenant.propertyName || "Unknown Property";
    tenant.unit = lease.unit || tenant.unit || "N/A";
    tenant.leaseStart = lease.leaseStart || tenant.leaseStart || null;
    tenant.leaseEnd = lease.leaseEnd || tenant.leaseEnd || null;
    tenant.monthlyRent = asNumber(lease.monthlyRent) ?? tenant.monthlyRent ?? null;
  }

  const lifecycle = deriveTenantLifecycle({
    tenantStatus: tenant?.status,
    applicantStatus: (applicationRaw as any)?.status,
    screeningStatus: (applicationRaw as any)?.screeningStatus,
    leaseStatus: lease?.status || null,
    occupancyStatus: currentTenancy?.status || unit?.occupancyStatus || unit?.status,
    currentLeaseId: lease?.id || null,
    leaseId: lease?.id,
    applicationId: tenant?.applicationId || (applicationRaw as any)?.id,
    tenantId: tenant?.id,
    source: tenant?.source,
    archivedAt: (tenant as any)?.archivedAt || (currentLeaseRaw as any)?.archivedAt,
    isArchived: (tenant as any)?.isArchived || (currentLeaseRaw as any)?.isArchived,
    hiddenFromActiveLists: tenant?.hiddenFromActiveLists,
    hasMoveOutDate: Boolean(currentTenancy?.moveOutAt),
  });
  if (tenant) tenant.lifecycle = lifecycle;

  let payments: TenantPaymentDto[] = [];
  try {
    const snap = await db
      .collection("payments")
      .where("tenantId", "==", tenantId)
      .orderBy("paidAt", "desc")
      .limit(20)
      .get();

    payments = snap.docs.map((doc) => {
      const d = doc.data() as any;
      return {
        id: doc.id,
        tenantId: d.tenantId,
        amount: Number(d.amount ?? 0),
        paidAt: d.paidAt ?? "",
        method: d.method ?? null,
        notes: d.notes ?? null,
        status: "Recorded",
      };
    });
  } catch (err) {
    console.error("[tenantDetailsService] payments query error", err);
  }

  const { listEventsForTenant, toLedgerEntries, getLedgerSummaryForTenant } =
    await import("./ledgerEventsService");
  const ledger = toLedgerEntries(listEventsForTenant(tenantId));
  const ledgerSummary = getLedgerSummaryForTenant(tenantId);
  const leaseExecution = currentLeaseRaw
    ? deriveLeaseExecution({
        leaseId: currentLeaseRecord?.id || lease?.id || null,
        startDate: lease?.leaseStart || (currentLeaseRaw as any)?.startDate || (currentLeaseRaw as any)?.leaseStart,
        monthlyRent: lease?.monthlyRent ?? (currentLeaseRaw as any)?.monthlyRent ?? null,
        status: lease?.status || null,
        raw: currentLeaseRaw,
      })
    : null;
  const stateCoherence = deriveLeaseOccupancyCoherence({
    leaseStatus: lease?.status || null,
    leaseExecutionStatus:
      leaseExecution?.executionStatus ||
      (currentLeaseRaw as any)?.leaseExecution?.executionStatus ||
      (currentLeaseRaw as any)?.executionStatus ||
      null,
    unitStatus: unit?.status,
    occupancyStatus: unit?.occupancyStatus,
    tenancyStatus: currentTenancy?.status,
    tenantStatus: tenant?.status,
    tenantLifecycleState: lifecycle.lifecycleState,
    paymentReadinessStatus: null,
    ledgerPaymentCount: ledger.filter((entry: any) =>
      String(entry?.type || entry?.entryType || "").trim().toLowerCase().includes("payment")
    ).length,
    archivedAt: (tenant as any)?.archivedAt || (currentLeaseRaw as any)?.archivedAt,
    isArchived: (tenant as any)?.isArchived || (currentLeaseRaw as any)?.isArchived,
  });
  const insights: any[] = [];
  const credibilityInsights = buildCredibilityInsights({ tenant, leaseRaw: currentLeaseRaw });
  const moveInRequirements = buildMoveInRequirements({
    lease,
    leaseRaw: currentLeaseRaw,
    tenant,
    tenancy: currentTenancy,
    invite: tenantInviteState,
    payments,
    ledger,
  });
  const [persistedMoveInReadiness, moveInReadinessEvents] = await Promise.all([
    getPersistedMoveInReadinessRecord(tenantId).catch(() => null),
    listMoveInReadinessEvents(tenantId).catch(() => []),
  ]);
  const moveInReadiness = buildMoveInReadinessRecord({
    tenantId,
    landlordId: tenant?.landlordId || landlordId || null,
    lease,
    leaseRaw: currentLeaseRaw,
    tenant,
    tenancy: currentTenancy,
    invite: tenantInviteState,
    payments,
    ledger,
    persisted: persistedMoveInReadiness,
    events: moveInReadinessEvents,
  });

  return {
    tenant,
    lease,
    currentLease: lease,
    property,
    unit: unit
      ? {
          id: unit.id,
          unitNumber: pickString(unit.unitNumber, unit.label, lease?.unit) || null,
          status: pickString(unit.status) || null,
          rent: asNumber(unit.rent ?? unit.marketRent ?? unit.monthlyRent),
        }
      : null,
    latestLeaseNoticeSummary,
    payments,
    ledger,
    insights,
    credibilityInsights,
    moveInRequirements,
    moveInReadiness,
    ledgerSummary,
    lifecycle,
    stateCoherence,
  };
}
