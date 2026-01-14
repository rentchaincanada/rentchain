import { tenantApiFetch } from "./tenantApiFetch";

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
  return tenantApiFetch<{ ok: boolean; data: TenantLedgerItem[] }>("/tenant/ledger");
}
