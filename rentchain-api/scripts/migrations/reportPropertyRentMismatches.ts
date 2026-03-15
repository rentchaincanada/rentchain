import { FieldPath } from "firebase-admin/firestore";
import { db, loadCanonicalLeasesByProperty, parseCommonFlags, toNumberSafe, writeReport } from "./lib/leaseMigrationSupport";

async function main() {
  const flags = parseCommonFlags(process.argv.slice(2));
  let query: FirebaseFirestore.Query = db.collection("properties");
  if (flags.propertyId) query = query.where(FieldPath.documentId(), "==", flags.propertyId);
  const propertySnap = await query.get();
  const properties = propertySnap.docs.slice(0, flags.limit || Number.MAX_SAFE_INTEGER);
  const report = {
    generatedAt: new Date().toISOString(),
    flags,
    properties: [] as any[],
  };

  for (const propertyDoc of properties) {
    const property = (propertyDoc.data() || {}) as any;
    const unitsSnap = await db.collection("units").where("propertyId", "==", propertyDoc.id).get();
    const leasesSnap = await db.collection("leases").where("propertyId", "==", propertyDoc.id).get();
    const canonical = await loadCanonicalLeasesByProperty(
      leasesSnap.docs.map((doc) => ({ id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> }))
    );
    const currentWinnerIds = new Set<string>();
    const currentLeaseRentRoll = canonical.reduce((sum, entry) => {
      if (!["active", "notice_pending", "renewal_pending", "renewal_accepted", "move_out_pending"].includes(String(entry.lease.status || ""))) {
        return sum;
      }
      const key = String(entry.lease.logicalUnitKey || entry.lease.id);
      if (currentWinnerIds.has(key)) return sum;
      currentWinnerIds.add(key);
      return sum + entry.lease.sourceMonthlyRent;
    }, 0);
    const configuredRentRoll = unitsSnap.docs.reduce((sum, doc) => {
      const unit = doc.data() as any;
      return sum + toNumberSafe(unit.rent, unit.marketRent, unit.monthlyRent);
    }, 0);

    report.properties.push({
      propertyId: propertyDoc.id,
      propertyName: String(property.name || property.nickname || property.addressLine1 || property.address || "Property").trim(),
      totalUnits: unitsSnap.size,
      configuredRentRoll,
      currentLeaseRentRoll,
      difference: configuredRentRoll - currentLeaseRentRoll,
      contributors: canonical.map((entry) => ({
        leaseId: entry.lease.id,
        tenantId: entry.lease.tenantId,
        resolvedUnitId: entry.lease.resolvedUnitId,
        resolvedUnitNumber: entry.lease.resolvedUnitNumber,
        monthlyRent: entry.lease.sourceMonthlyRent,
      })),
    });
  }

  const reportPath = writeReport("reportPropertyRentMismatches.report.json", report);
  console.log(JSON.stringify({ propertyCount: report.properties.length, reportPath }, null, 2));
}

main().catch((error) => {
  console.error("[reportPropertyRentMismatches] fatal", error);
  process.exitCode = 1;
});

