import { apiFetch } from "./apiFetch";
import { API_BASE_URL } from "./config";

export type LeaseLedgerEntry = {
  id: string;
  leaseId: string;
  propertyId?: string | null;
  unitId?: string | null;
  entryType: "charge" | "payment";
  category: "rent" | "fee" | "adjustment" | "payment";
  amountCents: number;
  effectiveDate: string;
  method?: "cash" | "etransfer" | "cheque" | "bank" | "card" | "other" | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: number;
  signedAmountCents: number;
  balanceCents: number;
};

export type LeaseLedgerResponse = {
  ok: boolean;
  leaseId: string;
  entries: LeaseLedgerEntry[];
  totals: {
    chargesCents: number;
    paymentsCents: number;
    balanceCents: number;
  };
  monthlyTotals: Record<
    string,
    {
      chargesCents: number;
      paymentsCents: number;
      netCents: number;
    }
  >;
};

export async function fetchLeaseLedger(
  leaseId: string,
  from?: string,
  to?: string
): Promise<LeaseLedgerResponse> {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString();
  return apiFetch(`/leases/${encodeURIComponent(leaseId)}/ledger${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}

export async function addLeaseCharge(
  leaseId: string,
  payload: {
    amountCents: number;
    date: string;
    type: "rent" | "fee" | "adjustment";
    notes?: string;
    propertyId?: string;
    unitId?: string;
  }
) {
  return apiFetch(`/leases/${encodeURIComponent(leaseId)}/ledger/charge`, {
    method: "POST",
    body: payload,
  });
}

export async function addLeasePayment(
  leaseId: string,
  payload: {
    amountCents: number;
    date: string;
    method: "cash" | "etransfer" | "cheque" | "bank" | "card" | "other";
    reference?: string;
    notes?: string;
    propertyId?: string;
    unitId?: string;
  }
) {
  return apiFetch(`/leases/${encodeURIComponent(leaseId)}/ledger/payment`, {
    method: "POST",
    body: payload,
  });
}

export function leaseLedgerExportUrl(leaseId: string, from?: string, to?: string): string {
  const search = new URLSearchParams();
  if (from) search.set("from", from);
  if (to) search.set("to", to);
  const qs = search.toString();
  const base = API_BASE_URL.replace(/\/$/, "").replace(/\/api$/i, "");
  return `${base}/api/leases/${encodeURIComponent(leaseId)}/ledger/export.csv${qs ? `?${qs}` : ""}`;
}
