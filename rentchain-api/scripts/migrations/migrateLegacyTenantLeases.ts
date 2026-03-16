import { FieldPath } from "firebase-admin/firestore";
import {
  db,
  getLeasePartyIds,
  groupLeaseAgreementCandidates,
  loadCanonicalLeasesByProperty,
  loadUnitsForProperty,
  parseCommonFlags,
  resolveUnitReference,
  toNumberSafe,
  writeReport,
} from "./lib/leaseMigrationSupport";
import { buildAgreementRepresentativeKey } from "../../src/services/leasePartyConsolidationService";

async function main() {
  const flags = parseCommonFlags(process.argv.slice(2));
  let query: FirebaseFirestore.Query = db.collection("tenants");
  if (flags.tenantId) query = query.where(FieldPath.documentId(), "==", flags.tenantId);
  if (flags.propertyId) query = query.where("propertyId", "==", flags.propertyId);
  const tenantSnap = await query.get();
  const tenants = tenantSnap.docs.slice(0, flags.limit || Number.MAX_SAFE_INTEGER);
  const report = {
    generatedAt: new Date().toISOString(),
    flags,
    rows: [] as any[],
    counts: {
      will_create: 0,
      created: 0,
      already_exists: 0,
      skipped_missing_property: 0,
      skipped_missing_unit: 0,
      skipped_equivalent_current_lease: 0,
      errors: 0,
    },
  };

  for (const tenantDoc of tenants) {
    const tenant = (tenantDoc.data() || {}) as any;
    const tenantId = tenantDoc.id;
    const propertyId = String(tenant.propertyId || flags.propertyId || "").trim();
    const landlordId = String(tenant.landlordId || "").trim();
    const unitReference = String(tenant.unitId || tenant.unit || tenant.unitLabel || "").trim();

    try {
      if (!propertyId) {
        report.counts.skipped_missing_property += 1;
        report.rows.push({ tenantId, action: "skipped_missing_property" });
        continue;
      }
      const propertySnap = await db.collection("properties").doc(propertyId).get();
      if (!propertySnap.exists) {
        report.counts.skipped_missing_property += 1;
        report.rows.push({ tenantId, propertyId, action: "skipped_missing_property" });
        continue;
      }

      const units = await loadUnitsForProperty(db as any, propertyId, landlordId || null);
      const unitResolution = resolveUnitReference(units, unitReference);
      if (!unitResolution.unit) {
        report.counts.skipped_missing_unit += 1;
        report.rows.push({ tenantId, propertyId, unitReference, action: "skipped_missing_unit" });
        continue;
      }

      const existingLeasesSnap = await db.collection("leases").where("propertyId", "==", propertyId).get();
      const canonicalExisting = await loadCanonicalLeasesByProperty(
        existingLeasesSnap.docs.map((doc) => ({ id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> }))
      );
      const agreementCandidates = canonicalExisting.map((entry) => ({ lease: entry.lease, raw: entry.raw }));
      const grouped = groupLeaseAgreementCandidates(agreementCandidates);
      const exactExisting = agreementCandidates.find((candidate) => getLeasePartyIds(candidate.raw, candidate.lease).includes(tenantId));
      if (exactExisting) {
        report.counts.already_exists += 1;
        report.rows.push({ tenantId, propertyId, leaseId: exactExisting.lease.id, action: "already_exists" });
        continue;
      }

      const equivalentCurrent = agreementCandidates.find((candidate) => {
        const sameUnit = candidate.lease.resolvedUnitId === unitResolution.unit?.id || candidate.lease.logicalUnitKey === `unit:${unitResolution.unit?.id}`;
        const sameLandlord = String(candidate.lease.landlordId || "") === landlordId;
        return sameUnit && sameLandlord && ["active", "notice_pending", "renewal_pending", "renewal_accepted", "move_out_pending"].includes(String(candidate.lease.status || ""));
      });
      if (equivalentCurrent) {
        report.counts.skipped_equivalent_current_lease += 1;
        report.rows.push({
          tenantId,
          propertyId,
          leaseId: equivalentCurrent.lease.id,
          agreementKey: buildAgreementRepresentativeKey(equivalentCurrent.lease),
          action: "skipped_equivalent_current_lease",
        });
        continue;
      }

      const payload = {
        landlordId: landlordId || null,
        tenantId,
        tenantIds: [tenantId],
        primaryTenantId: tenantId,
        propertyId,
        unitId: unitResolution.unit.id,
        unitNumber: unitResolution.unit.unitNumber || unitResolution.unit.label || unitReference,
        unitLabel: unitResolution.unit.label || unitResolution.unit.unitNumber || unitReference,
        status: "active",
        monthlyRent: toNumberSafe(tenant.monthlyRent, tenant.rent, tenant.currentRent),
        currentRent: toNumberSafe(tenant.monthlyRent, tenant.rent, tenant.currentRent),
        startDate: String(tenant.leaseStart || tenant.startDate || "").trim() || null,
        endDate: String(tenant.leaseEnd || tenant.endDate || "").trim() || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        migrationSource: "migrateLegacyTenantLeases",
      };
      report.counts.will_create += 1;
      report.rows.push({ tenantId, propertyId, unitId: unitResolution.unit.id, action: flags.dryRun ? "will_create" : "created", payload });
      if (flags.dryRun) continue;

      const ref = db.collection("leases").doc();
      await ref.set(payload, { merge: false });
      report.counts.created += 1;
    } catch (error: any) {
      report.counts.errors += 1;
      report.rows.push({ tenantId, propertyId, action: "error", message: error?.message || String(error) });
    }
  }

  const reportPath = writeReport("migrateLegacyTenantLeases.report.json", report);
  console.log(JSON.stringify({ counts: report.counts, reportPath }, null, 2));
}

main().catch((error) => {
  console.error("[migrateLegacyTenantLeases] fatal", error);
  process.exitCode = 1;
});
