import { FieldPath } from "firebase-admin/firestore";
import { db, parseCommonFlags, writeReport } from "./lib/leaseMigrationSupport";
import { loadPropertyLeaseIntegrityDiagnostics, reportTenantPointerIssues } from "../../src/services/leaseIntegrityService";

async function main() {
  const flags = parseCommonFlags(process.argv.slice(2));
  let query: FirebaseFirestore.Query = db.collection("properties");
  if (flags.propertyId) query = query.where(FieldPath.documentId(), "==", flags.propertyId);
  const snap = await query.get();
  const properties = snap.docs.slice(0, flags.limit || Number.MAX_SAFE_INTEGER);
  const issues: any[] = [];

  for (const propertyDoc of properties) {
    const property = (propertyDoc.data() || {}) as any;
    const landlordId = String(property.landlordId || "").trim() || null;
    const result = await loadPropertyLeaseIntegrityDiagnostics(propertyDoc.id, landlordId, db as any);
    issues.push(...result.issues);
    issues.push(...(await reportTenantPointerIssues(propertyDoc.id, landlordId, db as any)));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    flags,
    issueCount: issues.length,
    issues,
  };
  const reportPath = writeReport("reportLeaseIntegrityIssues.report.json", report);
  console.log(JSON.stringify({ issueCount: issues.length, reportPath }, null, 2));
}

main().catch((error) => {
  console.error("[reportLeaseIntegrityIssues] fatal", error);
  process.exitCode = 1;
});
