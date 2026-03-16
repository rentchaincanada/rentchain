import { FieldPath } from "firebase-admin/firestore";
import { db, parseCommonFlags, writeReport } from "./lib/leaseMigrationSupport";
import { buildDesiredUnitOccupancy } from "../../src/services/leaseIntegrityService";

async function main() {
  const flags = parseCommonFlags(process.argv.slice(2));
  let query: FirebaseFirestore.Query = db.collection("properties");
  if (flags.propertyId) query = query.where(FieldPath.documentId(), "==", flags.propertyId);
  const snap = await query.get();
  const properties = snap.docs.slice(0, flags.limit || Number.MAX_SAFE_INTEGER);
  const report = {
    generatedAt: new Date().toISOString(),
    flags,
    changedUnits: [] as any[],
    propertyCount: properties.length,
  };

  for (const propertyDoc of properties) {
    const property = (propertyDoc.data() || {}) as any;
    const landlordId = String(property.landlordId || "").trim() || null;
    const desired = await buildDesiredUnitOccupancy(propertyDoc.id, landlordId, db as any);
    for (const item of desired) {
      if ((item.currentStatus || "") === item.nextStatus) continue;
      report.changedUnits.push({ propertyId: propertyDoc.id, ...item });
      if (flags.dryRun) continue;
      await db.collection("units").doc(item.unitId).set(
        {
          status: item.nextStatus,
          occupancyStatus: item.nextStatus,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }
  }

  const reportPath = writeReport("reconcileUnitOccupancyFromLeases.report.json", report);
  console.log(JSON.stringify({ changedUnits: report.changedUnits.length, reportPath }, null, 2));
}

main().catch((error) => {
  console.error("[reconcileUnitOccupancyFromLeases] fatal", error);
  process.exitCode = 1;
});
