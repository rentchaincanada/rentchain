// rentchain-api/src/services/tenantDetailsService.ts
import { db } from "../config/firebase";

export interface TenantRecord {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  propertyName?: string;
  unit?: string;
  leaseStart?: string;
  leaseEnd?: string | null;
  monthlyRent?: number;
  status?: string;
  balance?: number;
  riskLevel?: string;
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

export function addConvertedTenant(tenant: TenantRecord): void {
  CONVERTED_TENANTS.push(tenant);
}

/**
 * List tenants for the sidebar.
 * Tries Firestore `tenants` collection, falls back to in-memory list.
 */
export async function getTenantsList(): Promise<TenantRecord[]> {
  try {
    const snap = await db.collection("tenants").get();

    if (snap.empty) {
      console.warn(
        "[tenantDetailsService] No tenants collection, using FALLBACK_TENANTS"
      );
      return [...FALLBACK_TENANTS, ...CONVERTED_TENANTS];
    }

    const out: TenantRecord[] = [];
    snap.forEach((doc) => {
      const data = doc.data() as any;
      out.push({
        id: doc.id,
        fullName: data.fullName ?? data.name ?? "Unnamed Tenant",
        email: data.email ?? null,
        phone: data.phone ?? null,
        propertyName: data.propertyName ?? data.property ?? null,
        unit: data.unit ?? null,
        leaseStart: data.leaseStart ?? null,
        leaseEnd: data.leaseEnd ?? null,
        monthlyRent: data.monthlyRent ?? null,
        status: data.status ?? "Current",
        balance: data.balance ?? 0,
        riskLevel: data.riskLevel ?? "Low",
      });
    });

    return [...out, ...CONVERTED_TENANTS];
  } catch (err) {
    console.error("[tenantDetailsService] getTenantsList error", err);
    return [...FALLBACK_TENANTS, ...CONVERTED_TENANTS];
  }
}

/**
 * Full detail bundle for one tenant.
 * Returns: { tenant, lease, payments, ledger, insights }
 */
export async function getTenantDetailBundle(tenantId: string) {
  // 1) tenant core info
  let tenant: TenantRecord | null = null;

  try {
    const doc = await db.collection("tenants").doc(tenantId).get();
    if (doc.exists) {
      const data = doc.data() as any;
      tenant = {
        id: doc.id,
        fullName: data.fullName ?? data.name ?? "Unnamed Tenant",
        email: data.email ?? null,
        phone: data.phone ?? null,
        propertyName: data.propertyName ?? data.property ?? null,
        unit: data.unit ?? null,
        leaseStart: data.leaseStart ?? null,
        leaseEnd: data.leaseEnd ?? null,
        monthlyRent: data.monthlyRent ?? null,
        status: data.status ?? "Current",
        balance: data.balance ?? 0,
        riskLevel: data.riskLevel ?? "Low",
      };
    }
  } catch (err) {
    console.error(
      "[tenantDetailsService] getTenantDetailBundle tenant error",
      err
    );
  }

  if (!tenant) {
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
