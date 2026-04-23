import { FieldValue, db } from "../../src/config/firebase";
import {
  TARGETED_HIDDEN_LEASE_IDS,
  TARGETED_HIDDEN_TENANT_IDS,
  TEST_LEASE_CLEANUP_REASON,
  TEST_TENANT_CLEANUP_BATCH,
  TEST_TENANT_CLEANUP_REASON,
} from "../../src/lib/testDataVisibilityTargets";

const TARGET_TENANTS = [
  {
    id: "c43992df00d07acae140ba76",
    label: "test2",
    propertyId: "jnpPUXm0sC6mKA9zEjQO",
    propertyName: "Property_test",
    unitId: "1Hkxooajlkczo7iD0xFc",
    unitLabel: "UNIT_B",
    currentLeaseId: "test_lease_quit_01",
    email: "hello+tenanttest2@rentchain.ai",
  },
  {
    id: "6b8df37863a292ead2a07401",
    label: "test1",
    propertyId: "jnpPUXm0sC6mKA9zEjQO",
    propertyName: "Property_test",
    unitId: "dlKaf1JsIUl6VhHYhag5",
    unitLabel: "UNIT_A",
    currentLeaseId: "test_lease_renew_001",
    email: "hello+tenanttest1@rentchain.ai",
  },
  {
    id: "b815152e3fbaf302897f6ce4",
    label: "bob",
    propertyId: "mAdeNtAtzAOrxGA4Dx9H",
    propertyName: "Coburg Rd",
    unitId: "ufSsrCIiWSOHPCDtUAS5",
    unitLabel: "3",
    currentLeaseId: null,
    email: "hello+tenant5@rentchain.ai",
  },
  {
    id: "bcea70bf3f353746c8895bc9",
    label: "Unnamed Tenant",
    propertyId: "mAdeNtAtzAOrxGA4Dx9H",
    propertyName: "Coburg Rd",
    unitId: "ufSsrCIiWSOHPCDtUAS5",
    unitLabel: "1",
    currentLeaseId: "HMqzstV4BcZszl9dgPGP",
    email: "hello+tenant1@rentchain.ai",
  },
  {
    id: "ff45a28cdfad7737958592de",
    label: "Unnamed Tenant",
    propertyId: "mAdeNtAtzAOrxGA4Dx9H",
    propertyName: "Coburg Rd",
    unitId: "W5ELj880M1z2i6uA",
    unitLabel: "1",
    currentLeaseId: "HMqzstV4BcZszl9dgPGP",
    email: "tenant-testing@rentchain.ai",
  },
];

const TARGET_LEASES = [
  { id: "test_lease_quit_01", label: "Synthetic quit flow lease" },
  { id: "test_lease_renew_001", label: "Synthetic renew flow lease" },
  { id: "HMqzstV4BcZszl9dgPGP", label: "Synthetic shared Coburg lease" },
];

function readArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    auditOnly: args.has("--audit"),
  };
}

function tenantAuditRecord(target: (typeof TARGET_TENANTS)[number], data: Record<string, unknown> | null) {
  return {
    id: target.id,
    label: target.label,
    expectedPropertyId: target.propertyId,
    expectedPropertyName: target.propertyName,
    expectedUnitId: target.unitId,
    expectedUnitLabel: target.unitLabel,
    expectedCurrentLeaseId: target.currentLeaseId,
    expectedEmail: target.email,
    exists: Boolean(data),
    hiddenFromActiveLists: data?.hiddenFromActiveLists === true,
    cleanupReason: data?.cleanupReason ?? null,
    cleanupBatch: data?.cleanupBatch ?? null,
    landlordId: data?.landlordId ?? null,
    propertyId: data?.propertyId ?? null,
    unitId: data?.unitId ?? null,
    currentLeaseId: data?.currentLeaseId ?? null,
    email: data?.email ?? null,
    displayName: data?.fullName ?? data?.name ?? null,
  };
}

function leaseAuditRecord(target: (typeof TARGET_LEASES)[number], data: Record<string, unknown> | null) {
  return {
    id: target.id,
    label: target.label,
    exists: Boolean(data),
    hiddenFromActiveLists: data?.hiddenFromActiveLists === true,
    cleanupReason: data?.cleanupReason ?? null,
    cleanupBatch: data?.cleanupBatch ?? null,
    landlordId: data?.landlordId ?? null,
    tenantId: data?.tenantId ?? data?.primaryTenantId ?? null,
    propertyId: data?.propertyId ?? null,
    unitId: data?.unitId ?? null,
    unitNumber: data?.unitNumber ?? data?.unit ?? null,
    status: data?.status ?? null,
    archivedAt: data?.archivedAt ?? null,
  };
}

async function auditTenant(target: (typeof TARGET_TENANTS)[number]) {
  const snap = await db.collection("tenants").doc(target.id).get();
  const data = snap.exists ? ((snap.data() as Record<string, unknown>) ?? null) : null;
  return tenantAuditRecord(target, data);
}

async function auditLease(target: (typeof TARGET_LEASES)[number]) {
  const snap = await db.collection("leases").doc(target.id).get();
  const data = snap.exists ? ((snap.data() as Record<string, unknown>) ?? null) : null;
  return leaseAuditRecord(target, data);
}

async function applyTenantCleanup(target: (typeof TARGET_TENANTS)[number]) {
  const ref = db.collection("tenants").doc(target.id);
  const snap = await ref.get();
  if (!snap.exists) return { id: target.id, status: "missing" as const };
  await ref.set(
    {
      hiddenFromActiveLists: true,
      cleanupReason: TEST_TENANT_CLEANUP_REASON,
      cleanupBatch: TEST_TENANT_CLEANUP_BATCH,
      cleanupAppliedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { id: target.id, status: "hidden" as const };
}

async function applyLeaseCleanup(target: (typeof TARGET_LEASES)[number]) {
  const ref = db.collection("leases").doc(target.id);
  const snap = await ref.get();
  if (!snap.exists) return { id: target.id, status: "missing" as const };
  await ref.set(
    {
      hiddenFromActiveLists: true,
      cleanupReason: TEST_LEASE_CLEANUP_REASON,
      cleanupBatch: TEST_TENANT_CLEANUP_BATCH,
      cleanupAppliedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { id: target.id, status: "hidden" as const };
}

async function main() {
  const { auditOnly } = readArgs();
  const report = {
    generatedAt: new Date().toISOString(),
    cleanupBatch: TEST_TENANT_CLEANUP_BATCH,
    auditOnly,
    expectedTenantTargets: Array.from(TARGETED_HIDDEN_TENANT_IDS),
    expectedLeaseTargets: Array.from(TARGETED_HIDDEN_LEASE_IDS),
    tenantAudit: [] as Array<Record<string, unknown>>,
    leaseAudit: [] as Array<Record<string, unknown>>,
    tenantWrites: [] as Array<Record<string, unknown>>,
    leaseWrites: [] as Array<Record<string, unknown>>,
  };

  for (const target of TARGET_TENANTS) {
    report.tenantAudit.push(await auditTenant(target));
  }

  for (const target of TARGET_LEASES) {
    report.leaseAudit.push(await auditLease(target));
  }

  if (!auditOnly) {
    for (const target of TARGET_TENANTS) {
      report.tenantWrites.push(await applyTenantCleanup(target));
    }

    for (const target of TARGET_LEASES) {
      report.leaseWrites.push(await applyLeaseCleanup(target));
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("[hideListedTestTenants] fatal", error);
  process.exitCode = 1;
});
