import type {
  InstitutionExportAudience,
  InstitutionExportPackageType,
  InstitutionExportProfile,
  InstitutionExportScope,
  InstitutionExportSensitivityClass,
  InstitutionExportSourceReference,
} from "./institutionExportTypes";

export const INSTITUTION_EXPORT_PROFILE_VERSION = "institution_export_allowlist_v1";

const ALLOWED_COLLECTIONS = [
  "auditEvents",
  "decisionItems",
  "leases",
  "maintenanceRequests",
  "portableAttestations",
  "properties",
  "units",
];

const ALLOWED_FIELD_GROUPS = [
  "aggregate_counts",
  "status_summaries",
  "occupancy_summaries",
  "delinquency_summaries",
  "audit_event_counts",
  "portable_trust_metadata",
  "redaction_categories",
];

const EXCLUDED_FIELD_GROUPS = [
  "tenant_contact_details",
  "identity_documents",
  "raw_provider_payloads",
  "raw_screening_reports",
  "raw_csv_values",
  "payment_account_details",
  "private_message_contents",
  "debug_payloads",
  "unrelated_resource_records",
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function deriveInstitutionExportProfile(input: {
  packageType: InstitutionExportPackageType;
  audience: InstitutionExportAudience;
  exportScope: InstitutionExportScope;
  sourceCollections: string[];
  hasRestrictedRedactions: boolean;
}): InstitutionExportProfile {
  const sensitivityClass: InstitutionExportSensitivityClass =
    input.hasRestrictedRedactions || input.audience !== "internal" ? "restricted" : "sensitive";

  return {
    exportProfile: "institutional_export_preview",
    exportVersion: INSTITUTION_EXPORT_PROFILE_VERSION,
    audienceCategory: input.audience,
    exportScope: input.exportScope,
    allowedCollections: uniqueSorted(input.sourceCollections).filter((collection) =>
      ALLOWED_COLLECTIONS.includes(collection)
    ),
    allowedFieldGroups: ALLOWED_FIELD_GROUPS,
    excludedFieldGroups: EXCLUDED_FIELD_GROUPS,
    sensitivityClass,
    authorityBasis: "landlord_scoped_preview",
    projectionPolicy: "Allowlisted aggregate preview only; do not include raw source records.",
    retentionPolicy: "Preview metadata only; retention policy must be approved before external sharing.",
    redactionPolicy: "Exclude raw/provider/payment credential/debug/private-message fields; include redaction categories only.",
    lineagePolicy: "Each represented source collection declares deterministic source IDs or count-only lineage.",
    auditExpectation: "Manual review and audit event linkage required before institutional export release.",
  };
}

export function deriveInstitutionExportSourceRefs(input: {
  properties: Array<Record<string, unknown>>;
  leases: Array<Record<string, unknown>>;
  units: Array<Record<string, unknown>>;
  maintenanceRequests: Array<Record<string, unknown>>;
  decisionItems: Array<Record<string, unknown>>;
  auditEvents: unknown[];
  portableAttestations: Array<Record<string, unknown>> | null;
}): InstitutionExportSourceReference[] {
  const refs: InstitutionExportSourceReference[] = [];

  function pushRecords(sourceCollection: string, records: Array<Record<string, unknown>>, idKeys: string[]) {
    for (const record of records) {
      const sourceId = idKeys.map((key) => String(record[key] ?? "").trim()).find(Boolean);
      if (!sourceId) continue;
      refs.push({ sourceCollection, sourceId });
    }
  }

  pushRecords("properties", input.properties, ["id", "propertyId"]);
  pushRecords("leases", input.leases, ["id", "leaseId"]);
  pushRecords("units", input.units, ["id", "unitId"]);
  pushRecords("maintenanceRequests", input.maintenanceRequests, ["id", "maintenanceRequestId", "workOrderId"]);
  pushRecords("decisionItems", input.decisionItems, ["id", "decisionId"]);
  pushRecords("portableAttestations", input.portableAttestations || [], ["attestationId", "id"]);

  input.auditEvents.forEach((event) => {
    if (!event || typeof event !== "object") return;
    const sourceId = String((event as Record<string, unknown>).id ?? (event as Record<string, unknown>).eventId ?? "").trim();
    if (sourceId) refs.push({ sourceCollection: "auditEvents", sourceId });
  });

  const byKey = new Map<string, InstitutionExportSourceReference>();
  for (const ref of refs) {
    byKey.set(`${ref.sourceCollection}:${ref.sourceId}`, ref);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.sourceCollection}:${a.sourceId}`.localeCompare(`${b.sourceCollection}:${b.sourceId}`)
  );
}
