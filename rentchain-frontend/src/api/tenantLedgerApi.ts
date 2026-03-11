import { tenantApiFetch } from "./tenantApiFetch";
import { getTenantToken } from "../lib/tenantAuth";

export type TenantLedgerItem = {
  id: string;
  type: "rent" | "fee" | "adjustment" | "payment";
  title: string;
  description?: string;
  amountCents: number | null;
  currency: string | null;
  period: string | null;
  occurredAt: number;
};

export async function getTenantLedger(): Promise<{ ok: boolean; data: TenantLedgerItem[] }> {
  if (import.meta.env.DEV) {
    const hasTenantToken = Boolean(getTenantToken());
    console.info("[tenant-ledger] request start", {
      endpoint: "/api/tenant/ledger",
      tokenSource: hasTenantToken ? "tenant-bearer" : "missing",
    });
  }
  return tenantApiFetch<{ ok: boolean; data: TenantLedgerItem[] }>("/tenant/ledger");
}
