export const TENANT_SAFE_PROJECTION_VERSION = "tenant_safe_projection_v1";

export type TenantSafeProjectionAudience = "tenant_workspace";

export type TenantSafeProjectionScopeType = "tenant_current_lease";

export type TenantSafeProjectionSensitivityClass = "sensitive";

export type TenantSafeProjectionSourceReference = {
  sourceCollection: string;
  sourceId: string;
};

export type TenantSafeProjectionProfile = {
  projectionName: "tenant_safe_workspace_projection";
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

const ALLOWED_FIELD_GROUPS = [
  "tenant_visible_lease_summary",
  "tenant_visible_document_status",
  "tenant_signature_status",
  "payment_readiness_summary",
  "scoped_source_references",
  "operational_labels",
];

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
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function deriveTenantSafeProjectionProfile(input: {
  scopeType: TenantSafeProjectionScopeType;
  sourceCollections: string[];
}): TenantSafeProjectionProfile {
  return {
    projectionName: "tenant_safe_workspace_projection",
    projectionVersion: TENANT_SAFE_PROJECTION_VERSION,
    audience: "tenant_workspace",
    scopeType: input.scopeType,
    allowedSourceCollections: uniqueSorted(input.sourceCollections),
    allowedFieldGroups: ALLOWED_FIELD_GROUPS,
    excludedFieldGroups: EXCLUDED_FIELD_GROUPS,
    sensitivityClass: "sensitive",
    authorityBasis: "authenticated_tenant_scope",
    relationshipBasis: "Projection must be derived from the authenticated tenant's current lease relationship.",
    internalReferencePolicy: "Internal IDs are scoped references for navigation/traceability, not primary display labels.",
    redactionPolicy: "Exclude landlord-only notes, raw/provider/payment/debug/private-message fields, and unrelated tenant data.",
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
