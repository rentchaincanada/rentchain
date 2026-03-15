import { FieldPath } from "firebase-admin/firestore";
import { db, getTenantCurrentLeaseDecision, parseCommonFlags, writeReport } from "./lib/leaseMigrationSupport";

async function main() {
  const flags = parseCommonFlags(process.argv.slice(2));
  let query: FirebaseFirestore.Query = db.collection("tenants");
  if (flags.tenantId) query = query.where(FieldPath.documentId(), "==", flags.tenantId);
  if (flags.propertyId) query = query.where("propertyId", "==", flags.propertyId);

  const snap = await query.get();
  const docs = snap.docs.slice(0, flags.limit || Number.MAX_SAFE_INTEGER);
  const report = {
    generatedAt: new Date().toISOString(),
    flags,
    tenantsScanned: 0,
    tenantsAlreadyCorrect: 0,
    tenantsUpdated: 0,
    tenantsWithNoCurrentLease: 0,
    ambiguousTenants: 0,
    errors: [] as Array<{ tenantId?: string; message: string }>,
    details: [] as any[],
  };

  for (const doc of docs) {
    report.tenantsScanned += 1;
    const tenant = (doc.data() || {}) as any;
    const tenantId = doc.id;
    try {
      const decision = await getTenantCurrentLeaseDecision(tenantId, flags.propertyId || tenant.propertyId || null);
      if (!decision.winner) {
        if (decision.ambiguity === "no_current_lease") {
          report.tenantsWithNoCurrentLease += 1;
          report.details.push({ tenantId, action: "no_current_lease" });
        } else {
          report.ambiguousTenants += 1;
          report.details.push({ tenantId, action: "ambiguous", ambiguity: decision.ambiguity, leases: decision.leases.map((lease) => lease.id) });
        }
        continue;
      }

      const currentLeaseId = String(tenant.currentLeaseId || "").trim() || null;
      if (currentLeaseId === decision.winner.id) {
        report.tenantsAlreadyCorrect += 1;
        report.details.push({ tenantId, action: "already_correct", currentLeaseId });
        continue;
      }

      report.details.push({ tenantId, action: flags.dryRun ? "would_update" : "updated", currentLeaseId, nextCurrentLeaseId: decision.winner.id });
      if (flags.dryRun) continue;

      await db.collection("tenants").doc(tenantId).set({ currentLeaseId: decision.winner.id, updatedAt: Date.now() }, { merge: true });
      report.tenantsUpdated += 1;
    } catch (error: any) {
      report.errors.push({ tenantId, message: error?.message || String(error) });
    }
  }

  const reportPath = writeReport("backfillTenantCurrentLeaseId.report.json", report);
  console.log(JSON.stringify({
    summary: {
      tenantsScanned: report.tenantsScanned,
      tenantsAlreadyCorrect: report.tenantsAlreadyCorrect,
      tenantsUpdated: report.tenantsUpdated,
      tenantsWithNoCurrentLease: report.tenantsWithNoCurrentLease,
      ambiguousTenants: report.ambiguousTenants,
      errors: report.errors.length,
    },
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error("[backfillTenantCurrentLeaseId] fatal", error);
  process.exitCode = 1;
});

