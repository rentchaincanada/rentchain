import { db } from "../../firebase";
import type {
  LandlordPortfolioStatusFinancialInput,
  PortfolioPaymentRecord,
  PortfolioPropertyRecord,
  PortfolioTenantRecord,
  PortfolioUnitRecord,
  PortfolioLeaseRecord,
  PortfolioRecord,
} from "./landlordPortfolioStatusFinancialTypes";

const DEFAULT_LIMIT = 500;
const PAYMENT_LIMIT = 1000;
const IN_CHUNK_SIZE = 10;

function asString(value: unknown, max = 240): string {
  return String(value || "").trim().slice(0, max);
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => asString(value, 240)).filter(Boolean)));
}

function chunks(values: string[], size = IN_CHUNK_SIZE): string[][] {
  const out: string[][] = [];
  for (let index = 0; index < values.length; index += size) {
    out.push(values.slice(index, index + size));
  }
  return out;
}

function withDocId<T extends PortfolioRecord>(doc: any): T {
  const data = ((typeof doc?.data === "function" ? doc.data() : {}) || {}) as Record<string, unknown>;
  return {
    ...data,
    id: asString(data.id, 240) || asString(doc?.id, 240),
  } as T;
}

async function queryByField<T extends PortfolioRecord>(
  collectionName: string,
  field: string,
  value: string,
  limit = DEFAULT_LIMIT
): Promise<T[] | null> {
  try {
    const snap = await db.collection(collectionName).where(field, "==", value).limit(limit).get();
    return (snap.docs || []).map((doc: any) => withDocId<T>(doc));
  } catch (err: any) {
    console.warn("[landlord-portfolio-status-financial] source query failed", {
      collectionName,
      field,
      message: err?.message || String(err),
    });
    return null;
  }
}

async function queryByFieldIn<T extends PortfolioRecord>(
  collectionName: string,
  field: string,
  values: string[],
  limitPerChunk = DEFAULT_LIMIT
): Promise<T[] | null> {
  const scopedValues = unique(values);
  if (scopedValues.length === 0) return [];

  const results: T[] = [];
  let anySucceeded = false;
  for (const chunk of chunks(scopedValues)) {
    try {
      const snap = await db.collection(collectionName).where(field, "in", chunk).limit(limitPerChunk).get();
      results.push(...((snap.docs || []).map((doc: any) => withDocId<T>(doc)) as T[]));
      anySucceeded = true;
    } catch (err: any) {
      console.warn("[landlord-portfolio-status-financial] related source query failed", {
        collectionName,
        field,
        message: err?.message || String(err),
      });
    }
  }

  return anySucceeded ? results : null;
}

function mergeById<T extends PortfolioRecord>(...groups: Array<T[] | null | undefined>): T[] | null {
  let anyAvailable = false;
  const byId = new Map<string, T>();

  for (const group of groups) {
    if (!group) continue;
    anyAvailable = true;
    for (const record of group) {
      const id = asString(record.id, 240) || JSON.stringify(record);
      byId.set(id, record);
    }
  }

  return anyAvailable ? Array.from(byId.values()) : null;
}

function tenantIdsFromLeases(leases: PortfolioLeaseRecord[] | null): string[] {
  if (!leases) return [];
  const ids: string[] = [];
  for (const lease of leases) {
    ids.push(asString(lease.tenantId, 240), asString(lease.primaryTenantId, 240));
    if (Array.isArray(lease.tenantIds)) {
      for (const id of lease.tenantIds) ids.push(asString(id, 240));
    }
  }
  return unique(ids);
}

export async function loadLandlordPortfolioStatusFinancialInput(params: {
  landlordId: string;
  periodMonth?: string | null;
  generatedAt?: string | null;
}): Promise<LandlordPortfolioStatusFinancialInput> {
  const landlordId = asString(params.landlordId, 240);
  const generatedAt = params.generatedAt || new Date().toISOString();

  const properties = await queryByField<PortfolioPropertyRecord>("properties", "landlordId", landlordId, DEFAULT_LIMIT);
  const propertyIds = unique((properties || []).map((property) => asString(property.id || property.propertyId, 240)));

  const [unitsByLandlord, unitsByProperty, leasesByLandlord, leasesByProperty] = await Promise.all([
    queryByField<PortfolioUnitRecord>("units", "landlordId", landlordId, DEFAULT_LIMIT),
    queryByFieldIn<PortfolioUnitRecord>("units", "propertyId", propertyIds, DEFAULT_LIMIT),
    queryByField<PortfolioLeaseRecord>("leases", "landlordId", landlordId, DEFAULT_LIMIT),
    queryByFieldIn<PortfolioLeaseRecord>("leases", "propertyId", propertyIds, DEFAULT_LIMIT),
  ]);

  const units = mergeById(unitsByLandlord, unitsByProperty);
  const leases = mergeById(leasesByLandlord, leasesByProperty);
  const leaseIds = unique((leases || []).map((lease) => asString(lease.id || lease.leaseId, 240)));
  const tenantIds = tenantIdsFromLeases(leases);

  const [tenantsByLandlord, tenantsByProperty, tenantsByCurrentLease, ledgerEvents, ledgerEntries, rentPayments, payments] = await Promise.all([
    queryByField<PortfolioTenantRecord>("tenants", "landlordId", landlordId, DEFAULT_LIMIT),
    queryByFieldIn<PortfolioTenantRecord>("tenants", "propertyId", propertyIds, DEFAULT_LIMIT),
    queryByFieldIn<PortfolioTenantRecord>("tenants", "currentLeaseId", leaseIds, DEFAULT_LIMIT),
    queryByField<PortfolioPaymentRecord>("ledgerEvents", "landlordId", landlordId, PAYMENT_LIMIT),
    queryByField<PortfolioPaymentRecord>("ledgerEntries", "landlordId", landlordId, PAYMENT_LIMIT),
    queryByField<PortfolioPaymentRecord>("rentPayments", "landlordId", landlordId, PAYMENT_LIMIT),
    queryByField<PortfolioPaymentRecord>("payments", "landlordId", landlordId, PAYMENT_LIMIT),
  ]);

  const tenants = mergeById(tenantsByLandlord, tenantsByProperty, tenantsByCurrentLease);
  const tenantIdsFromTenants = unique((tenants || []).map((tenant) => asString(tenant.id || tenant.tenantId, 240)));
  const allTenantIds = unique([...tenantIds, ...tenantIdsFromTenants]);

  const [rentPaymentsByLease, rentPaymentsByTenant, paymentsByLease, paymentsByTenant] = await Promise.all([
    queryByFieldIn<PortfolioPaymentRecord>("rentPayments", "leaseId", leaseIds, PAYMENT_LIMIT),
    queryByFieldIn<PortfolioPaymentRecord>("rentPayments", "tenantId", allTenantIds, PAYMENT_LIMIT),
    queryByFieldIn<PortfolioPaymentRecord>("payments", "leaseId", leaseIds, PAYMENT_LIMIT),
    queryByFieldIn<PortfolioPaymentRecord>("payments", "tenantId", allTenantIds, PAYMENT_LIMIT),
  ]);

  return {
    landlordId,
    generatedAt,
    periodMonth: params.periodMonth || null,
    properties,
    units,
    leases,
    tenants,
    ledgerEvents,
    ledgerEntries,
    rentPayments: mergeById(rentPayments, rentPaymentsByLease, rentPaymentsByTenant),
    payments: mergeById(payments, paymentsByLease, paymentsByTenant),
  };
}
