// rentchain-api/src/services/tenantDetailsService.ts
import { db } from "../config/firebase";

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
  leaseStart?: string;
  leaseEnd?: string | null;
  monthlyRent?: number;
  status?: string;
  balance?: number;
  riskLevel?: string;
  createdAt?: string | number | null;
}

export interface TenantLease {
  tenantId: string;
  propertyName: string;
  unit: string;
  leaseStart: string;
  leaseEnd: string | null;
  monthlyRent: number;
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

// Backend fallback tenants (used if Firestore has no `tenants` collection yet)
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
    leaseStart: data.leaseStart ?? null,
    leaseEnd: data.leaseEnd ?? null,
    monthlyRent: data.monthlyRent ?? null,
    status: data.status ?? "Current",
    balance: data.balance ?? 0,
    riskLevel: data.riskLevel ?? "Low",
    createdAt: createdAtIso ?? createdAt ?? null,
  };
}

export function addConvertedTenant(tenant: TenantRecord): void {
  CONVERTED_TENANTS.push(tenant);
}

/**
 * List tenants for the sidebar.
 * Tries Firestore `tenants` collection, falls back to in-memory list.
 */
export async function getTenantsList(
  opts: TenantQueryOptions = {}
): Promise<TenantRecord[]> {
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
      console.warn(
        "[tenantDetailsService] No tenants collection, using FALLBACK_TENANTS"
      );
      return [...FALLBACK_TENANTS, ...CONVERTED_TENANTS];
    }

    return [...out, ...CONVERTED_TENANTS.filter((t) => !landlordId || t.landlordId === landlordId)];
  } catch (err) {
    console.error("[tenantDetailsService] getTenantsList error", err);
    if (landlordId) return [];
    return [...FALLBACK_TENANTS, ...CONVERTED_TENANTS];
  }
}

/**
 * Full detail bundle for one tenant.
 * Returns: { tenant, lease, payments, ledger, insights }
 */
export async function getTenantDetailBundle(
  tenantId: string,
  opts: TenantQueryOptions = {}
) {
  const landlordId = opts.landlordId?.trim?.() ? String(opts.landlordId).trim() : null;
  // 1) tenant core info
  let tenant: TenantRecord | null = null;

  try {
    const doc = await db.collection("tenants").doc(tenantId).get();
    if (doc.exists) {
      const data = doc.data() as any;
      if (landlordId && data?.landlordId && data.landlordId !== landlordId) {
        return { tenant: null, lease: null, payments: [], ledger: [], insights: [], ledgerSummary: null };
      }
      tenant = mapTenant(doc.id, data);
    }
  } catch (err) {
    console.error(
      "[tenantDetailsService] getTenantDetailBundle tenant error",
      err
    );
  }

  if (!tenant && !landlordId) {
    tenant =
      CONVERTED_TENANTS.find((t) => t.id === tenantId) ??
      FALLBACK_TENANTS.find((t) => t.id === tenantId) ??
      FALLBACK_TENANTS[0];
  }

  // 2) lease model (derived from tenant for now)
  let lease: TenantLease | null = null;
  if (tenant) {
    lease = {
      tenantId: tenant.id,
      propertyName: tenant.propertyName ?? "Unknown Property",
      unit: tenant.unit ?? "N/A",
      leaseStart: tenant.leaseStart ?? "2024-01-01",
      leaseEnd: tenant.leaseEnd ?? null,
      monthlyRent: tenant.monthlyRent ?? 0,
    };
  }

  // 3) payments
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
        status: "Recorded", // later: compute on-time/late etc. based on schedule
      };
    });
  } catch (err) {
    console.error("[tenantDetailsService] payments query error", err);
  }

  // 4) ledger events
  const { listEventsForTenant, toLedgerEntries, getLedgerSummaryForTenant } =
    await import("./ledgerEventsService");
  const ledger = toLedgerEntries(listEventsForTenant(tenantId));
  const ledgerSummary = getLedgerSummaryForTenant(tenantId);

  // 5) placeholder AI insights (wired later)
  const insights: any[] = [];

  return {
    tenant,
    lease,
    payments,
    ledger,
    insights,
    ledgerSummary,
  };
}
