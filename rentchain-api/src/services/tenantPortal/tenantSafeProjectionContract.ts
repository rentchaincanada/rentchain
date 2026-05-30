export const TENANT_SAFE_PROJECTION_VERSION = "tenant_safe_projection_v1";

export type TenantSafeProjectionAudience = "tenant_workspace";

export type TenantSafeProjectionName =
  | "tenant_safe_workspace_projection"
  | "tenant_safe_workspace_context_projection"
  | "tenant_safe_profile_projection"
  | "tenant_safe_application_projection"
  | "tenant_safe_application_reuse_projection"
  | "tenant_safe_communications_projection"
  | "tenant_safe_maintenance_projection"
  | "tenant_safe_property_projection"
  | "tenant_safe_lease_notice_projection"
  | "tenant_safe_document_access_projection"
  | "tenant_safe_attachment_projection";

export type TenantSafeProjectionScopeType =
  | "tenant_current_lease"
  | "tenant_workspace_context"
  | "tenant_profile"
  | "tenant_application"
  | "tenant_application_reuse"
  | "tenant_communications"
  | "tenant_maintenance"
  | "tenant_property"
  | "tenant_lease_notice"
  | "tenant_document_access"
  | "tenant_attachment";

export type TenantSafeProjectionSensitivityClass = "sensitive";

export type TenantSafeProjectionSourceReference = {
  sourceCollection: string;
  sourceId: string;
};

export type TenantSafeProjectionProfile = {
  projectionName: TenantSafeProjectionName;
  projectionVersion: typeof TENANT_SAFE_PROJECTION_VERSION;
  audience: TenantSafeProjectionAudience;
  scopeType: TenantSafeProjectionScopeType;
  allowedSourceCollections: string[];
  allowedFieldGroups: string[];
  excludedFieldGroups: string[];
  sensitivityClass: TenantSafeProjectionSensitivityClass;
  authorityBasis: "authenticated_tenant_scope";
  relationshipBasis: string;
  internalReferencePolicy: string;
  redactionPolicy: string;
};

export type TenantSafeRedactionSummary = {
  redactionPolicy: string;
  redactedFieldGroups: string[];
  redactionCount: number;
};

export type TenantSafeProjectionMetadata = {
  projectionProfile: TenantSafeProjectionProfile;
  projectionVersion: typeof TENANT_SAFE_PROJECTION_VERSION;
  sensitivityClass: TenantSafeProjectionProfile["sensitivityClass"];
  authorityBasis: TenantSafeProjectionProfile["authorityBasis"];
  redactionSummary: TenantSafeRedactionSummary;
};

const ALLOWED_FIELD_GROUPS = [
  "tenant_visible_lease_summary",
  "tenant_visible_document_status",
  "tenant_signature_status",
  "payment_readiness_summary",
  "scoped_source_references",
  "operational_labels",
];

const SURFACE_ALLOWED_FIELD_GROUPS: Record<TenantSafeProjectionScopeType, string[]> = {
  tenant_current_lease: ALLOWED_FIELD_GROUPS,
  tenant_workspace_context: [
    "tenant_workspace_context",
    "tenant_visible_profile_summary",
    "tenant_visible_application_summary",
    "tenant_visible_lease_summary",
    "tenant_visible_maintenance_summary",
    "derived_identity_signals",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_profile: [
    "tenant_visible_profile_summary",
    "tenant_visible_identity_status",
    "tenant_visible_document_status",
    "tenant_visible_application_summary",
    "tenant_visible_lease_summary",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_application: [
    "tenant_visible_application_summary",
    "tenant_visible_document_status",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_application_reuse: [
    "tenant_owned_reuse_profile",
    "tenant_visible_application_reuse_fields",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_communications: [
    "tenant_visible_communications_thread",
    "tenant_visible_message_bodies",
    "tenant_read_state_summary",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_maintenance: [
    "tenant_visible_maintenance_summary",
    "tenant_visible_maintenance_lifecycle",
    "tenant_safe_evidence",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_property: [
    "tenant_visible_property_summary",
    "tenant_visible_unit_summary",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_lease_notice: [
    "tenant_visible_lease_notice_summary",
    "tenant_visible_notice_text",
    "tenant_visible_response_options",
    "tenant_response_state",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_document_access: [
    "tenant_visible_document_status",
    "tenant_scoped_signed_url",
    "tenant_visible_document_labels",
    "scoped_source_references",
    "operational_labels",
  ],
  tenant_attachment: [
    "tenant_visible_attachment_summary",
    "tenant_visible_document_status",
    "tenant_safe_evidence",
    "scoped_source_references",
    "operational_labels",
  ],
};

const EXCLUDED_FIELD_GROUPS = [
  "landlord_only_notes",
  "other_tenant_records",
  "raw_provider_payloads",
  "raw_screening_reports",
  "raw_csv_values",
  "payment_account_details",
  "debug_payloads",
  "route_source_metadata",
  "stack_traces",
  "private_message_bodies",
  "storage_paths",
  "provider_delivery_payloads",
  "landlord_internal_workflow_state",
];

const SURFACE_REDACTION_POLICIES: Record<TenantSafeProjectionScopeType, string> = {
  tenant_current_lease: "Exclude landlord-only notes, raw/provider/payment/debug/private-message fields, and unrelated tenant data.",
  tenant_workspace_context:
    "Exclude landlord-only notes, raw/provider/payment/debug/private-message fields, unrelated tenant data, and raw internal actor references.",
  tenant_profile:
    "Exclude landlord-only notes, raw/provider/debug fields, unrelated tenant data, and raw screening payload references.",
  tenant_application:
    "Exclude raw application payloads, screening payloads, landlord-only notes, unrelated tenant data, and debug fields.",
  tenant_application_reuse:
    "Expose only tenant-owned reusable application fields; exclude screening payloads, consents, documents, notes, and unrelated tenant data.",
  tenant_communications:
    "Expose only tenant-visible conversation state and tenant-visible message bodies; exclude private/internal message bodies and debug fields.",
  tenant_maintenance:
    "Expose only tenant-visible maintenance lifecycle fields and tenant-safe evidence; exclude raw actor identifiers, internal costs, landlord-only notes, and storage paths.",
  tenant_property:
    "Expose only tenant-visible property and unit labels; exclude owner internals, management notes, and debug fields.",
  tenant_lease_notice:
    "Expose notice text, deadlines, tenant response options, and tenant-owned response state; exclude landlord internal notes, processing state, provider delivery payloads, and unrelated notices.",
  tenant_document_access:
    "Expose only tenant-scoped document URL, status, label, and expiry; exclude storage paths, bucket names, provider payloads, raw document metadata, and unrelated documents.",
  tenant_attachment:
    "Expose only tenant-safe attachment labels, status, dates, and tenant-visible document links; exclude storage paths, bucket names, provider payloads, raw metadata, and unrelated evidence.",
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function deriveTenantSafeProjectionProfile(input: {
  projectionName?: TenantSafeProjectionName;
  scopeType: TenantSafeProjectionScopeType;
  sourceCollections: string[];
  allowedFieldGroups?: string[];
  excludedFieldGroups?: string[];
  relationshipBasis?: string;
  internalReferencePolicy?: string;
  redactionPolicy?: string;
}): TenantSafeProjectionProfile {
  return {
    projectionName: input.projectionName || "tenant_safe_workspace_projection",
    projectionVersion: TENANT_SAFE_PROJECTION_VERSION,
    audience: "tenant_workspace",
    scopeType: input.scopeType,
    allowedSourceCollections: uniqueSorted(input.sourceCollections),
    allowedFieldGroups: input.allowedFieldGroups || SURFACE_ALLOWED_FIELD_GROUPS[input.scopeType],
    excludedFieldGroups: input.excludedFieldGroups || EXCLUDED_FIELD_GROUPS,
    sensitivityClass: "sensitive",
    authorityBasis: "authenticated_tenant_scope",
    relationshipBasis:
      input.relationshipBasis ||
      "Projection must be derived from the authenticated tenant's current lease relationship.",
    internalReferencePolicy:
      input.internalReferencePolicy ||
      "Internal IDs are scoped references for navigation/traceability, not primary display labels.",
    redactionPolicy: input.redactionPolicy || SURFACE_REDACTION_POLICIES[input.scopeType],
  };
}

export function deriveTenantSafeProjectionMetadata(input: {
  projectionName?: TenantSafeProjectionName;
  scopeType: TenantSafeProjectionScopeType;
  sourceCollections: string[];
  allowedFieldGroups?: string[];
  excludedFieldGroups?: string[];
  relationshipBasis?: string;
  internalReferencePolicy?: string;
  redactionPolicy?: string;
}): TenantSafeProjectionMetadata {
  const projectionProfile = deriveTenantSafeProjectionProfile(input);
  return {
    projectionProfile,
    projectionVersion: projectionProfile.projectionVersion,
    sensitivityClass: projectionProfile.sensitivityClass,
    authorityBasis: projectionProfile.authorityBasis,
    redactionSummary: {
      redactionPolicy: projectionProfile.redactionPolicy,
      redactedFieldGroups: projectionProfile.excludedFieldGroups,
      redactionCount: projectionProfile.excludedFieldGroups.length,
    },
  };
}

export function deriveTenantSafeSourceRefs(input: {
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
}): TenantSafeProjectionSourceReference[] {
  const refs: TenantSafeProjectionSourceReference[] = [];
  if (input.leaseId) refs.push({ sourceCollection: "leases", sourceId: input.leaseId });
  if (input.propertyId) refs.push({ sourceCollection: "properties", sourceId: input.propertyId });
  if (input.unitId) refs.push({ sourceCollection: "units", sourceId: input.unitId });
  if (input.tenantId) refs.push({ sourceCollection: "tenants", sourceId: input.tenantId });

  const byKey = new Map<string, TenantSafeProjectionSourceReference>();
  for (const ref of refs) byKey.set(`${ref.sourceCollection}:${ref.sourceId}`, ref);
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.sourceCollection}:${a.sourceId}`.localeCompare(`${b.sourceCollection}:${b.sourceId}`)
  );
}
