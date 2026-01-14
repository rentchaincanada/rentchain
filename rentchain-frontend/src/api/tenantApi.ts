import { apiFetch } from "./apiFetch";

export async function tenantMe() {
  return apiFetch("/tenant/me");
}

export async function tenantLease() {
  return apiFetch("/tenant/lease");
}

export async function tenantPayments() {
  return apiFetch("/tenant/payments");
}

export async function tenantLedger() {
  return apiFetch("/tenant/ledger");
}
