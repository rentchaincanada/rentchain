// rentchain-api/src/services/tenantDetailsService.ts
import { db } from "../config/firebase";
import {
  computeNoResponseState,
  getLeaseNoticeByLeaseId,
} from "./leaseNoticeWorkflowService";
import {
  loadUnitsForProperty,
  pickLeaseWinner,
  resolveUnitReference,
  toCanonicalLeaseRecord,
  isCurrentLeaseStatus,
} from "./leaseCanonicalizationService";

export interface TenantRecord {
  id: string;
  landlordId?: string | null;
  fullName: string;
  email?: string;
  phone?: string;
  propertyId?: string | null;
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
  createdAt?: string | number | null;
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

const CONVERTED_TENANTS: TenantRecord[] = [];

type TenantQueryOptions = {
  landlordId?: string | null;
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
    propertyId: data.propertyId ?? null,
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
    createdAt: createdAtIso ?? createdAt ?? null,
  };
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
      return landlordMatch && isCurrentLeaseStatus((raw as any)?.status);
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

    const canonicalLeases = currentEntries.map(([id, raw]) => {
      const propertyId = String((raw as any)?.propertyId || tenant?.propertyId || "").trim();
      return toCanonicalLeaseRecord(id, raw, unitsByProperty.get(propertyId) || []);
    });
    return pickLeaseWinner(canonicalLeases)?.winner || null;
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

async function loadUnitRecord(propertyId: string | null | undefined, unitId: string | null | undefined, unitLabel?: string | null) {
  const propertyKey = String(propertyId || "").trim();
  if (!propertyKey) return null;
  try {
    const units = await loadUnitsForProperty(db as any, propertyKey);
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

export function addConvertedTenant(tenant: TenantRecord): void {
  CONVERTED_TENANTS.push(tenant);
}

export async function getTenantsList(opts: TenantQueryOptions = {}): Promise<TenantRecord[]> {
  const landlordId = opts.landlordId?.trim?.() ? String(opts.landlordId).trim() : null;

  try {
    const collection = db.collection("tenants");
    const snap = landlordId
      ? await collection.where("landlordId", "==", landlordId).get()
      : await collection.get();

    const out: TenantRecord[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as any;
      out.push(mapTenant(doc.id, data));
    });

    out.sort((a, b) => {
      const aTs = toMillis(a.createdAt);
      const bTs = toMillis(b.createdAt);
      return (bTs ?? 0) - (aTs ?? 0);
    });

    if (out.length === 0 && !landlordId) {
      console.warn("[tenantDetailsService] No tenants collection, using FALLBACK_TENANTS");
      return [...FALLBACK_TENANTS, ...CONVERTED_TENANTS];
    }

    return [...out, ...CONVERTED_TENANTS.filter((t) => !landlordId || t.landlordId === landlordId)];
  } catch (err) {
    console.error("[tenantDetailsService] getTenantsList error", err);
    if (landlordId) return [];
    return [...FALLBACK_TENANTS, ...CONVERTED_TENANTS];
  }
}

export async function getTenantDetailBundle(tenantId: string, opts: TenantQueryOptions = {}) {
  const landlordId = opts.landlordId?.trim?.() ? String(opts.landlordId).trim() : null;

  let tenant = await loadTenantRecord(tenantId, landlordId);
  if (!tenant && !landlordId) {
    tenant =
      CONVERTED_TENANTS.find((t) => t.id === tenantId) ??
      FALLBACK_TENANTS.find((t) => t.id === tenantId) ??
      FALLBACK_TENANTS[0];
  }

  const currentLeaseRecord = await loadCurrentLeaseSnapshot(tenant, landlordId);
  const property = await loadPropertyRecord(currentLeaseRecord?.propertyId || tenant?.propertyId || null);
  const unit = await loadUnitRecord(
    currentLeaseRecord?.propertyId || tenant?.propertyId || null,
    currentLeaseRecord?.unitId || tenant?.unitId || tenant?.unit || null,
    currentLeaseRecord?.unitLabel || tenant?.unit || null
  );
  const latestLeaseNoticeSummary = await loadLatestLeaseNoticeSummary(currentLeaseRecord?.id || null, currentLeaseRecord?.status || null);

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
      }
    : tenant
    ? {
        tenantId: tenant.id,
        propertyId: tenant.propertyId || null,
        propertyName: tenant.propertyName ?? "Unknown Property",
        unitId: tenant.unitId || null,
        unit: tenant.unit ?? "N/A",
        leaseStart: tenant.leaseStart ?? null,
        leaseEnd: tenant.leaseEnd ?? null,
        monthlyRent: Number(tenant.monthlyRent ?? 0),
        status: tenant.status ?? null,
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
  const insights: any[] = [];

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
    ledgerSummary,
  };
}



