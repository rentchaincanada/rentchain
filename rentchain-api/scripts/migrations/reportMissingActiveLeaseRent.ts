import { FieldPath } from "firebase-admin/firestore";
import { db, parseCommonFlags, writeReport } from "./lib/leaseMigrationSupport";
import { loadPropertyLeaseIntegrityDiagnostics } from "../../src/services/leaseIntegrityService";

async function main() {
  const flags = parseCommonFlags(process.argv.slice(2));
  let query: FirebaseFirestore.Query = db.collection("properties");
  if (flags.propertyId) query = query.where(FieldPath.documentId(), "==", flags.propertyId);
  const snap = await query.get();
  const properties = snap.docs.slice(0, flags.limit || Number.MAX_SAFE_INTEGER);
  const items: any[] = [];

  for (const propertyDoc of properties) {
    const property = (propertyDoc.data() || {}) as any;
    const landlordId = String(property.landlordId || "").trim() || null;
    const result = await loadPropertyLeaseIntegrityDiagnostics(propertyDoc.id, landlordId, db as any);
    result.issues
      .filter((issue) => issue.issueType === "active_lease_missing_rent")
      .forEach((issue) => {
        items.push({
          activeLeaseId: issue.relatedLeaseIds[0] || null,
          propertyId: issue.propertyId,
          unitId: issue.unitId,
          tenantIds: issue.relatedTenantIds,
          missingRentFields: (issue.detail?.missingRentFields as string[] | undefined) || [],
          likelyFallbackUnitRent: issue.detail?.unitRentFallback ?? null,
        });
      });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    flags,
    count: items.length,
    items,
  };
  const reportPath = writeReport("reportMissingActiveLeaseRent.report.json", report);
  console.log(JSON.stringify({ count: items.length, reportPath }, null, 2));
}

main().catch((error) => {
  console.error("[reportMissingActiveLeaseRent] fatal", error);
  process.exitCode = 1;
});
