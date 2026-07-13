import type {
  EvidenceItem,
  EvidenceItemSource,
  EvidenceProjectionProfile,
  EvidencePackScope,
  EvidencePackSensitivityClass,
  EvidenceSourceReference,
} from "./evidencePackTypes";

export const EVIDENCE_PROJECTION_PROFILE_VERSION = "evidence_projection_profile_v1";

const SOURCE_COLLECTION_BY_ITEM_SOURCE: Record<EvidenceItemSource, string> = {
  audit_compliance: "auditComplianceReadiness",
  canonical_events: "canonicalEvents",
  decision_inbox: "decisionItems",
  institution_exports: "institutionExportPackages",
  lease_ledger: "leases",
  maintenance: "maintenanceRequests",
  operator_review: "operatorReviewSessions",
  renewal_notice_communications: "renewalNoticeCommunications",
  registry: "properties",
  workflow_routing: "decisionItems",
  unknown: "unknown",
};

const ALLOWED_FIELD_GROUPS = [
  "operational_labels",
  "status_summaries",
  "timestamps",
  "scoped_source_references",
  "redaction_categories",
  "manual_review_metadata",
];

const EXCLUDED_FIELD_GROUPS = [
  "raw_provider_payloads",
  "raw_csv_values",
  "payment_account_details",
  "private_message_bodies",
  "identity_documents",
  "debug_payloads",
  "unrelated_resource_records",
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function deriveEvidenceProjectionProfile(input: {
  scope: EvidencePackScope;
  sourceCollections: string[];
  hasRestrictedRedactions: boolean;
}): EvidenceProjectionProfile {
  return {
    profileName: "landlord_evidence_review",
    profileVersion: EVIDENCE_PROJECTION_PROFILE_VERSION,
    audience: "landlord_operational_review",
    scopeType: input.scope,
    allowedSourceCollections: uniqueSorted(input.sourceCollections),
    sensitivityClass: input.hasRestrictedRedactions ? "restricted" : "sensitive",
    allowedFieldGroups: ALLOWED_FIELD_GROUPS,
    excludedFieldGroups: EXCLUDED_FIELD_GROUPS,
    redactionPolicy: "Exclude raw/provider/payment credential/debug/private-message fields; include redaction categories only.",
    internalReferencePolicy: "Internal IDs may appear only as scoped source references, never as primary display labels.",
    sourceLineagePolicy: "Each included evidence item declares a source collection and source ID when available.",
  };
}

export function deriveEvidenceSourceReferences(items: EvidenceItem[]): EvidenceSourceReference[] {
  const byKey = new Map<string, EvidenceSourceReference>();
  for (const item of items) {
    const sourceId = String(item.sourceId || "").trim();
    if (!sourceId) continue;
    const sourceCollection = SOURCE_COLLECTION_BY_ITEM_SOURCE[item.source] || "unknown";
    const reference: EvidenceSourceReference = {
      sourceCollection,
      sourceId,
      itemType: item.itemType,
      itemLabel: item.label,
    };
    byKey.set(`${sourceCollection}:${sourceId}:${item.itemType}`, reference);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.sourceCollection}:${a.sourceId}:${a.itemType}`.localeCompare(
      `${b.sourceCollection}:${b.sourceId}:${b.itemType}`,
    ),
  );
}
