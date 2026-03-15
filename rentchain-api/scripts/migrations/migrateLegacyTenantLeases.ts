/**
 * migrateLegacyTenantLeases.ts
 *
 * Purpose:
 * Convert legacy tenant-linked lease fields into canonical Firestore `leases` documents.
 * The script is idempotent, supports dry-run and validation-only modes, and can optionally
 * repair missing fields on existing lease docs plus obvious unit occupancy metadata.
 *
 * Usage examples:
 *   npx tsx scripts/migrations/migrateLegacyTenantLeases.ts --dry-run
 *   npx tsx scripts/migrations/migrateLegacyTenantLeases.ts --dry-run --tenant-id=<tenantId>
 *   npx tsx scripts/migrations/migrateLegacyTenantLeases.ts --repair-existing --repair-units
 *   npx tsx scripts/migrations/migrateLegacyTenantLeases.ts --validate-only
 *
 * Rollback note:
 * This migration never deletes data. Created lease docs are tagged with
 * `source: "legacy-tenant-migration"`, so rollback is logical/manual if needed.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { FieldValue, db } from "../../src/config/firebase";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import {
  buildExistingLeaseRepairPatch,
  buildLeaseCreateData,
  buildUnitRepairPatch,
  deriveLeaseSnapshot,
  isCurrentCanonicalLeaseStatus,
  isMissingLinkage,
  normalizeStringId,
  parseCliArgs,
  timestampToReportValue,
  type TenantActionReport,
} from "./lib/leaseMigrationHelpers";

const OUTPUT_REPORT_PATH = path.resolve(process.cwd(), "scripts/migrations/output/migrateLegacyTenantLeases.report.json");
const BATCH_LIMIT = 200;

type QueuedWrite = {
  kind: "lease_create" | "lease_repair" | "unit_repair";
  tenantId: string;
  ref: FirebaseFirestore.DocumentReference;
  data: Record<string, unknown>;
  merge: boolean;
  report: TenantActionReport;
};

type MigrationSummary = {
  dryRun: boolean;
  validateOnly: boolean;
  repairExisting: boolean;
  repairUnits: boolean;
  limit: number | null;
  tenantId: string | null;
  tenantsScanned: number;
  tenantsSkippedMissingPropertyId: number;
  tenantsSkippedMissingUnitId: number;
  tenantsSkippedExistingCanonicalLease: number;
  leasesToCreate: number;
  leasesCreated: number;
  existingLeasesRepaired: number;
  unitsRepaired: number;
  unresolvedTenants: number;
  validationMissingCanonicalLease: number;
  errors: number;
};

function initialSummary(options: ReturnType<typeof parseCliArgs>): MigrationSummary {
  return {
    dryRun: options.dryRun,
    validateOnly: options.validateOnly,
    repairExisting: options.repairExisting,
    repairUnits: options.repairUnits,
    limit: options.limit,
    tenantId: options.tenantId,
    tenantsScanned: 0,
    tenantsSkippedMissingPropertyId: 0,
    tenantsSkippedMissingUnitId: 0,
    tenantsSkippedExistingCanonicalLease: 0,
    leasesToCreate: 0,
    leasesCreated: 0,
    existingLeasesRepaired: 0,
    unitsRepaired: 0,
    unresolvedTenants: 0,
    validationMissingCanonicalLease: 0,
    errors: 0,
  };
}

function toPlainData(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => toPlainData(item));
  if (typeof value === "object") {
    if (typeof (value as any).toDate === "function") {
      try {
        return (value as any).toDate().toISOString();
      } catch {
        return String(value);
      }
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, toPlainData(nested)])
    );
  }
  return value;
}

function materializeWriteData(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === "SERVER_TIMESTAMP") {
      out[key] = FieldValue.serverTimestamp();
      continue;
    }
    out[key] = value;
  }
  return out;
}

function getTenantDisplayName(tenantData: Record<string, unknown>): string | null {
  return normalizeStringId(tenantData.fullName) || normalizeStringId(tenantData.name) || normalizeStringId(tenantData.email);
}

async function loadTenants(options: ReturnType<typeof parseCliArgs>) {
  if (options.tenantId) {
    const doc = await db.collection("tenants").doc(options.tenantId).get();
    return doc.exists ? [doc] : [];
  }
  const snap = await db.collection("tenants").get();
  const docs = snap.docs;
  return options.limit ? docs.slice(0, options.limit) : docs;
}

async function resolveProperty(derivedPropertyId: string | null): Promise<(Record<string, unknown> & { id: string }) | null> {
  if (!derivedPropertyId) return null;
  try {
    const snap = await db.collection("properties").doc(derivedPropertyId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Record<string, unknown>) };
  } catch {
    return null;
  }
}

async function resolveUnit(propertyId: string | null, rawUnitId: string | null) {
  if (!propertyId || !rawUnitId) return { canonicalUnitId: rawUnitId, unitDoc: null as Record<string, unknown> | null };
  try {
    const direct = await db.collection("units").doc(rawUnitId).get();
    if (direct.exists) {
      const data = direct.data() as Record<string, unknown>;
      if (!data.propertyId || String(data.propertyId) === propertyId) {
        return { canonicalUnitId: direct.id, unitDoc: { id: direct.id, ...data } };
      }
    }
  } catch {
    // continue to property/unitNumber lookup
  }

  try {
    const snap = await db.collection("units").where("propertyId", "==", propertyId).limit(200).get();
    const rawLookup = String(rawUnitId).trim().toLowerCase();
    const match = snap.docs.find((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const docId = String(doc.id).trim().toLowerCase();
      const unitNumber = String(data.unitNumber ?? data.unit ?? data.label ?? "").trim().toLowerCase();
      return docId === rawLookup || unitNumber === rawLookup;
    });
    if (!match) {
      return { canonicalUnitId: rawUnitId, unitDoc: null };
    }
    return { canonicalUnitId: match.id, unitDoc: { id: match.id, ...(match.data() as Record<string, unknown>) } };
  } catch {
    return { canonicalUnitId: rawUnitId, unitDoc: null };
  }
}

async function findExistingCanonicalLease(tenantId: string, propertyId: string, unitIdsToMatch: string[]) {
  const uniqueUnitIds = Array.from(new Set(unitIdsToMatch.filter(Boolean)));
  const snaps = await Promise.all([
    db.collection("leases").where("tenantId", "==", tenantId).limit(100).get().catch(() => ({ docs: [] } as any)),
    db.collection("leases").where("tenantIds", "array-contains", tenantId).limit(100).get().catch(() => ({ docs: [] } as any)),
  ]);
  const candidates = [...snaps[0].docs, ...snaps[1].docs];
  const seen = new Map<string, QueryDocumentSnapshot>();
  for (const doc of candidates) {
    if (!doc?.id || seen.has(doc.id)) continue;
    seen.set(doc.id, doc);
  }
  const matches = Array.from(seen.values()).filter((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return (
      String(data.propertyId || "") === propertyId &&
      uniqueUnitIds.includes(String(data.unitId || ""))
    );
  });
  return matches;
}

async function queueUnitRepairIfNeeded(params: {
  writes: QueuedWrite[];
  options: ReturnType<typeof parseCliArgs>;
  tenantId: string;
  unitDoc: Record<string, unknown> | null;
  snapshotStatus: string;
  report: TenantActionReport;
}) {
  const { writes, options, tenantId, unitDoc, snapshotStatus, report } = params;
  if (!options.repairUnits || !unitDoc || !isCurrentCanonicalLeaseStatus(snapshotStatus)) return;
  const { patch, repairedFields } = buildUnitRepairPatch(unitDoc);
  if (repairedFields.length === 0) return;
  report.unitRepairFields = repairedFields;
  writes.push({
    kind: "unit_repair",
    tenantId,
    ref: db.collection("units").doc(String(unitDoc.id)),
    data: materializeWriteData(patch),
    merge: true,
    report: { ...report, action: "unit_repaired", unitRepairFields: repairedFields },
  });
}

async function flushWrites(writes: QueuedWrite[], summary: MigrationSummary) {
  if (writes.length === 0) return;
  for (let index = 0; index < writes.length; index += BATCH_LIMIT) {
    const chunk = writes.slice(index, index + BATCH_LIMIT);
    const batch = db.batch();
    for (const write of chunk) {
      if (write.merge) batch.set(write.ref, write.data, { merge: true });
      else batch.set(write.ref, write.data);
    }
    await batch.commit();
    for (const write of chunk) {
      if (write.kind === "lease_create") {
        summary.leasesCreated += 1;
        write.report.action = "created";
        write.report.createdLeaseId = write.ref.id;
      } else if (write.kind === "lease_repair") {
        summary.existingLeasesRepaired += 1;
      } else if (write.kind === "unit_repair") {
        summary.unitsRepaired += 1;
      }
    }
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const summary = initialSummary(options);
  const reportItems: TenantActionReport[] = [];
  const queuedWrites: QueuedWrite[] = [];

  console.info("[lease-migration] starting", options);

  const tenantDocs = await loadTenants(options);
  console.info("[lease-migration] tenant scan size", { count: tenantDocs.length });

  for (const tenantDoc of tenantDocs) {
    summary.tenantsScanned += 1;
    const tenantId = tenantDoc.id;
    const tenantData = (tenantDoc.data() || {}) as Record<string, unknown>;
    const tenantName = getTenantDisplayName(tenantData);
    const snapshot = deriveLeaseSnapshot(tenantId, tenantData);
    const linkage = isMissingLinkage(snapshot);

    const baseReport: TenantActionReport = {
      tenantId,
      tenantName,
      propertyId: snapshot.propertyId,
      unitId: snapshot.unitId,
      status: snapshot.status,
      action: "unresolved",
      reasons: [],
      monthlyRent: snapshot.monthlyRent,
      startDate: timestampToReportValue(snapshot.startDate),
      endDate: timestampToReportValue(snapshot.endDate),
      diagnostics: {
        derivedFrom: snapshot.derivedFrom,
        currentLeaseHeuristicMatched: snapshot.currentLeaseHeuristicMatched,
      },
    };

    if (linkage.missingPropertyId) {
      summary.tenantsSkippedMissingPropertyId += 1;
      summary.unresolvedTenants += 1;
      reportItems.push({
        ...baseReport,
        action: "skipped_missing_property",
        reasons: ["Missing derivable propertyId"],
      });
      continue;
    }

    if (linkage.missingUnitId) {
      summary.tenantsSkippedMissingUnitId += 1;
      summary.unresolvedTenants += 1;
      reportItems.push({
        ...baseReport,
        action: "skipped_missing_unit",
        reasons: ["Missing derivable unitId"],
      });
      continue;
    }

    const property = await resolveProperty(snapshot.propertyId);
    const landlordId = normalizeStringId(tenantData.landlordId) || normalizeStringId(property?.landlordId) || null;
    const resolvedUnit = await resolveUnit(snapshot.propertyId, snapshot.unitId);
    const canonicalUnitId = resolvedUnit.canonicalUnitId;
    const unitIdsToMatch = [snapshot.unitId, canonicalUnitId].filter((value): value is string => Boolean(value));
    const existingMatches = await findExistingCanonicalLease(tenantId, String(snapshot.propertyId), unitIdsToMatch);

    if (options.validateOnly) {
      if (existingMatches.length === 0) {
        summary.validationMissingCanonicalLease += 1;
        summary.unresolvedTenants += 1;
        reportItems.push({
          ...baseReport,
          unitId: canonicalUnitId,
          action: "validated_missing",
          reasons: ["Legacy linkage exists but no canonical lease matched tenant/property/unit"],
          diagnostics: {
            ...baseReport.diagnostics,
            propertyResolved: Boolean(property),
            unitResolved: Boolean(resolvedUnit.unitDoc),
            canonicalUnitId,
          },
        });
      } else {
        reportItems.push({
          ...baseReport,
          unitId: canonicalUnitId,
          action: "validated_existing",
          reasons: ["Canonical lease already exists"],
          existingLeaseId: existingMatches[0].id,
          diagnostics: {
            ...baseReport.diagnostics,
            propertyResolved: Boolean(property),
            unitResolved: Boolean(resolvedUnit.unitDoc),
            canonicalUnitId,
            duplicateCanonicalLeaseIds: existingMatches.slice(1).map((doc) => doc.id),
          },
        });
      }
      continue;
    }

    if (existingMatches.length > 0) {
      summary.tenantsSkippedExistingCanonicalLease += 1;
      const primaryExisting = existingMatches[0];
      const primaryData = primaryExisting.data() as Record<string, unknown>;
      const { patch, repairedFields } = buildExistingLeaseRepairPatch(primaryData, {
        ...snapshot,
        unitId: canonicalUnitId,
      });
      const reasons = ["Canonical lease already exists"];
      const existingReport: TenantActionReport = {
        ...baseReport,
        unitId: canonicalUnitId,
        existingLeaseId: primaryExisting.id,
        action: "skipped_existing",
        reasons,
        diagnostics: {
          ...baseReport.diagnostics,
          propertyResolved: Boolean(property),
          unitResolved: Boolean(resolvedUnit.unitDoc),
          canonicalUnitId,
          duplicateCanonicalLeaseIds: existingMatches.slice(1).map((doc) => doc.id),
        },
      };

      if (options.repairExisting && repairedFields.length > 0) {
        queuedWrites.push({
          kind: "lease_repair",
          tenantId,
          ref: primaryExisting.ref,
          data: materializeWriteData(patch),
          merge: true,
          report: { ...existingReport, action: options.dryRun ? "repaired_existing" : "repaired_existing", repairedFields },
        });
        existingReport.action = "repaired_existing";
        existingReport.repairedFields = repairedFields;
      }

      await queueUnitRepairIfNeeded({
        writes: queuedWrites,
        options,
        tenantId,
        unitDoc: resolvedUnit.unitDoc,
        snapshotStatus: snapshot.status,
        report: existingReport,
              });

      reportItems.push(existingReport);
      continue;
    }

    const leaseRef = db.collection("leases").doc();
    const createData = buildLeaseCreateData({
      ...snapshot,
      unitId: canonicalUnitId,
    });
    const leasePayload = materializeWriteData({
      ...createData,
      landlordId,
      tenantIds: [tenantId],
      unitNumber: normalizeStringId(resolvedUnit.unitDoc?.unitNumber) || snapshot.unitId,
      unitLabel: normalizeStringId(resolvedUnit.unitDoc?.unitNumber) || snapshot.unitId,
      currentRent: snapshot.monthlyRent,
      createdAt: createData.createdAt || "SERVER_TIMESTAMP",
    });

    summary.leasesToCreate += 1;
    const createReport: TenantActionReport = {
      ...baseReport,
      unitId: canonicalUnitId,
      action: options.dryRun ? "will_create" : "created",
      reasons: ["No canonical lease matched tenant/property/unit"],
      createdLeaseId: leaseRef.id,
      diagnostics: {
        ...baseReport.diagnostics,
        propertyResolved: Boolean(property),
        unitResolved: Boolean(resolvedUnit.unitDoc),
        canonicalUnitId,
        landlordId,
      },
    };

    queuedWrites.push({
      kind: "lease_create",
      tenantId,
      ref: leaseRef,
      data: leasePayload,
      merge: false,
      report: createReport,
    });

    await queueUnitRepairIfNeeded({
      writes: queuedWrites,
      options,
      tenantId,
      unitDoc: resolvedUnit.unitDoc,
      snapshotStatus: snapshot.status,
      report: createReport,
    });

    reportItems.push(createReport);
  }

  if (!options.dryRun && !options.validateOnly) {
    await flushWrites(queuedWrites, summary);
  }

  if (options.dryRun) {
    summary.existingLeasesRepaired = queuedWrites.filter((write) => write.kind === "lease_repair").length;
    summary.unitsRepaired = queuedWrites.filter((write) => write.kind === "unit_repair").length;
  }

  await fs.mkdir(path.dirname(OUTPUT_REPORT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_REPORT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        options,
        summary,
        items: reportItems.map((item) => toPlainData(item)),
      },
      null,
      2
    ),
    "utf8"
  );

  console.info("[lease-migration] complete", summary);
  console.info("[lease-migration] report", { path: OUTPUT_REPORT_PATH });
}

main().catch((error) => {
  console.error("[lease-migration] fatal", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  });
  process.exitCode = 1;
});
