// FRONTEND: rentchain-frontend/src/services/tenantLedgerApi.ts

import API_BASE from "../config/apiBase";

const API_BASE_URL = API_BASE.replace(/\/$/, "");

export interface TenantLedgerEvent {
  id: string;
  tenantId: string;
  type: string; // e.g. "payment", "charge", "ai_insight"
  occurredAt: string;
  description: string;
  meta?: Record<string, any>;
}

export async function fetchTenantLedger(
  tenantId: string
): Promise<TenantLedgerEvent[]> {
  const url = `${API_BASE_URL}/tenantLedger/${tenantId}`;
  console.log("[Ledger] Fetching:", url);

  const res = await fetch(url);

  // Backend route not implemented yet → treat as "no events yet".
  if (res.status === 404) {
    console.log(
      "[Ledger] No tenantLedger endpoint yet; returning empty events array."
    );
    return [];
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[Ledger] API error", res.status, text);
    throw new Error(`Failed to fetch tenant ledger: ${res.status}`);
  }

  const data = (await res.json()) as TenantLedgerEvent[];
  return data;
}
