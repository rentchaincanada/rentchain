export const TEST_TENANT_CLEANUP_BATCH = "tenant_lease_test_data_visibility_repair_v1";
export const TEST_TENANT_CLEANUP_REASON = "identified_test_tenant";
export const TEST_LEASE_CLEANUP_REASON = "identified_test_lease";

export const TARGETED_HIDDEN_TENANT_IDS = new Set([
  "c43992df00d07acae140ba76",
  "6b8df37863a292ead2a07401",
  "b815152e3fbaf302897f6ce4",
  "bcea70bf3f353746c8895bc9",
  "ff45a28cdfad7737958592de",
]);

export const TARGETED_HIDDEN_LEASE_IDS = new Set([
  "test_lease_quit_01",
  "test_lease_renew_001",
  "HMqzstV4BcZszl9dgPGP",
]);

export function isTargetedHiddenTenantId(tenantId: unknown): boolean {
  return TARGETED_HIDDEN_TENANT_IDS.has(String(tenantId || "").trim());
}

export function isTargetedHiddenLeaseId(leaseId: unknown): boolean {
  return TARGETED_HIDDEN_LEASE_IDS.has(String(leaseId || "").trim());
}
