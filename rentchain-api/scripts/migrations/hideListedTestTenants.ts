import { FieldValue, db } from "../../src/config/firebase";

const TARGET_TENANTS = [
  { id: "c43992df00d07acae140ba76", label: "test2" },
  { id: "6b8df37863a292ead2a07401", label: "test1" },
  { id: "b815152e3fbaf302897f6ce4", label: "bob" },
  { id: "bcea70bf3f353746c8895bc9", label: "Unnamed Tenant" },
  { id: "ff45a28cdfad7737958592de", label: "Unnamed Tenant" },
];

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    cleanupBatch: "tenant_record_cleanup_profile_actions_v1",
    hiddenCount: 0,
    missingCount: 0,
    tenants: [] as Array<Record<string, unknown>>,
  };

  for (const target of TARGET_TENANTS) {
    const ref = db.collection("tenants").doc(target.id);
    const snap = await ref.get();
    if (!snap.exists) {
      report.missingCount += 1;
      report.tenants.push({
        id: target.id,
        label: target.label,
        status: "missing",
      });
      continue;
    }

    await ref.set(
      {
        hiddenFromActiveLists: true,
        cleanupReason: "identified_test_tenant",
        cleanupBatch: "tenant_record_cleanup_profile_actions_v1",
        cleanupAppliedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    report.hiddenCount += 1;
    report.tenants.push({
      id: target.id,
      label: target.label,
      status: "hidden",
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("[hideListedTestTenants] fatal", error);
  process.exitCode = 1;
});
