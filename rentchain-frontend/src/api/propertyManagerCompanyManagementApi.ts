import { apiFetch } from "./apiFetch";

export type PropertyManagerCompanyRelationshipStatus = "pending" | "active" | "suspended" | "terminated";
export type PropertyManagerCompanyMembershipStatus = "invited" | "active" | "suspended" | "removed";
export type PropertyManagerCompanyStatus = "active" | "suspended" | "archived";
export type PropertyManagerCompanyStaffAssignmentStatus = "active" | "suspended" | "removed";
export type PropertyManagerCompanyRole =
  | "company_owner"
  | "company_admin"
  | "regional_manager"
  | "property_manager"
  | "leasing_agent"
  | "office_administrator"
  | "maintenance_coordinator"
  | "read_only_staff";
export type PropertyManagerCompanyStaffAssignmentRole =
  | "regional_manager"
  | "property_manager"
  | "leasing_agent"
  | "office_administrator"
  | "maintenance_coordinator"
  | "read_only_staff";
export type PropertyManagerCompanyPropertyScopeMode = "all_current_properties" | "selected_properties";
export type PropertyManagerCompanyWorkspaceScope =
  | "dashboard"
  | "operations"
  | "properties"
  | "tenants"
  | "leases"
  | "payments"
  | "unified_inbox"
  | "scheduling"
  | "work_orders"
  | "evidence_exports"
  | "settings_billing";

export type PropertyManagerCompanyPropertyScope = {
  mode: PropertyManagerCompanyPropertyScopeMode;
  propertyIds: string[];
};

export type PropertyManagerCompanyRelationshipScope = {
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: PropertyManagerCompanyWorkspaceScope[];
};

export type StaffAssignmentSummary = {
  total: number;
  active: number;
  suspended: number;
  removed: number;
};

export type PropertyManagerCompanyLookup = {
  propertyManagerCompanyId: string;
  companyLabel: string;
  status: PropertyManagerCompanyStatus;
  role?: PropertyManagerCompanyRole;
};

export type PropertyManagerCompanyRelationship = {
  relationshipId: string;
  landlordId?: string;
  propertyManagerCompanyId: string;
  propertyManagerCompanyLabel: string;
  landlordWorkspaceLabel: string;
  status: PropertyManagerCompanyRelationshipStatus;
  relationshipScope: PropertyManagerCompanyRelationshipScope;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  suspendedAt: string | null;
  reactivatedAt: string | null;
  terminatedAt: string | null;
  staffAssignmentSummary: StaffAssignmentSummary;
};

export type PropertyManagerCompanyMember = {
  staffUserId: string;
  staffLabel: string;
  role: PropertyManagerCompanyRole;
  status: PropertyManagerCompanyMembershipStatus;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  removedAt: string | null;
};

export type PropertyManagerCompanyStaffAssignment = {
  assignmentId: string;
  propertyManagerCompanyId: string;
  relationshipId: string;
  staffUserId: string;
  staffLabel: string;
  staffDisplayLabel?: string;
  staffRole: PropertyManagerCompanyStaffAssignmentRole;
  status: PropertyManagerCompanyStaffAssignmentStatus;
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: PropertyManagerCompanyWorkspaceScope[];
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  reactivatedAt: string | null;
  removedAt: string | null;
};

export type CreateLandlordCompanyRelationshipInput = {
  propertyManagerCompanyId: string;
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: PropertyManagerCompanyWorkspaceScope[];
};

export type CreateStaffAssignmentInput = {
  relationshipId: string;
  staffUserId: string;
  staffRole: PropertyManagerCompanyStaffAssignmentRole;
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: PropertyManagerCompanyWorkspaceScope[];
};

export async function searchPropertyManagerCompanies(query: string): Promise<PropertyManagerCompanyLookup[]> {
  const params = new URLSearchParams();
  const clean = String(query || "").trim();
  if (clean) params.set("q", clean);
  const response = await apiFetch<{ ok: true; companies: PropertyManagerCompanyLookup[] }>(
    `/landlord/property-manager-companies/search${params.toString() ? `?${params.toString()}` : ""}`
  );
  return response.companies || [];
}

export async function fetchLandlordPropertyManagerRelationships(): Promise<PropertyManagerCompanyRelationship[]> {
  const response = await apiFetch<{ ok: true; relationships: PropertyManagerCompanyRelationship[] }>(
    "/landlord/property-manager-company-relationships"
  );
  return response.relationships || [];
}

export async function createLandlordPropertyManagerRelationship(input: CreateLandlordCompanyRelationshipInput) {
  return apiFetch<{ ok: true; relationship: PropertyManagerCompanyRelationship }>(
    "/landlord/property-manager-company-relationships",
    {
      method: "POST",
      body: input,
    }
  );
}

export async function suspendLandlordPropertyManagerRelationship(relationshipId: string, reason?: string) {
  return apiFetch<{ ok: true; relationship: PropertyManagerCompanyRelationship }>(
    `/landlord/property-manager-company-relationships/${encodeURIComponent(relationshipId)}/suspend`,
    {
      method: "POST",
      body: { reason: String(reason || "").trim() || null },
    }
  );
}

export async function reactivateLandlordPropertyManagerRelationship(relationshipId: string, reason?: string) {
  return apiFetch<{ ok: true; relationship: PropertyManagerCompanyRelationship }>(
    `/landlord/property-manager-company-relationships/${encodeURIComponent(relationshipId)}/reactivate`,
    {
      method: "POST",
      body: { reason: String(reason || "").trim() || null },
    }
  );
}

export async function terminateLandlordPropertyManagerRelationship(relationshipId: string, reason?: string) {
  return apiFetch<{ ok: true; relationship: PropertyManagerCompanyRelationship }>(
    `/landlord/property-manager-company-relationships/${encodeURIComponent(relationshipId)}/terminate`,
    {
      method: "POST",
      body: { reason: String(reason || "").trim() || null },
    }
  );
}

export async function fetchLandlordPropertyManagerRelationshipAssignments(
  relationshipId: string
): Promise<PropertyManagerCompanyStaffAssignment[]> {
  const response = await apiFetch<{ ok: true; assignments: PropertyManagerCompanyStaffAssignment[] }>(
    `/landlord/property-manager-company-relationships/${encodeURIComponent(relationshipId)}/staff-assignments`
  );
  return response.assignments || [];
}

export async function fetchMyPropertyManagerCompanies(): Promise<PropertyManagerCompanyLookup[]> {
  const response = await apiFetch<{ ok: true; companies: PropertyManagerCompanyLookup[] }>(
    "/property-manager-companies/my-companies"
  );
  return response.companies || [];
}

export async function fetchCompanyPropertyManagerRelationships(
  companyId: string
): Promise<PropertyManagerCompanyRelationship[]> {
  const response = await apiFetch<{ ok: true; relationships: PropertyManagerCompanyRelationship[] }>(
    `/property-manager-companies/${encodeURIComponent(companyId)}/relationships`
  );
  return response.relationships || [];
}

export async function acceptCompanyPropertyManagerRelationship(companyId: string, relationshipId: string) {
  return apiFetch<{ ok: true; relationship: PropertyManagerCompanyRelationship }>(
    `/property-manager-companies/${encodeURIComponent(companyId)}/relationships/${encodeURIComponent(relationshipId)}/accept`,
    { method: "POST" }
  );
}

export async function fetchPropertyManagerCompanyMembers(companyId: string): Promise<PropertyManagerCompanyMember[]> {
  const response = await apiFetch<{ ok: true; members: PropertyManagerCompanyMember[] }>(
    `/property-manager-companies/${encodeURIComponent(companyId)}/members`
  );
  return response.members || [];
}

export async function fetchPropertyManagerCompanyStaffAssignments(
  companyId: string,
  relationshipId?: string
): Promise<PropertyManagerCompanyStaffAssignment[]> {
  const params = new URLSearchParams();
  if (relationshipId) params.set("relationshipId", relationshipId);
  const response = await apiFetch<{ ok: true; assignments: PropertyManagerCompanyStaffAssignment[] }>(
    `/property-manager-companies/${encodeURIComponent(companyId)}/staff-assignments${
      params.toString() ? `?${params.toString()}` : ""
    }`
  );
  return response.assignments || [];
}

export async function createPropertyManagerCompanyStaffAssignment(
  companyId: string,
  input: CreateStaffAssignmentInput
) {
  return apiFetch<{ ok: true; assignment: PropertyManagerCompanyStaffAssignment }>(
    `/property-manager-companies/${encodeURIComponent(companyId)}/staff-assignments`,
    {
      method: "POST",
      body: input,
    }
  );
}

export async function suspendPropertyManagerCompanyStaffAssignment(
  companyId: string,
  assignmentId: string,
  reason?: string
) {
  return apiFetch<{ ok: true; assignment: PropertyManagerCompanyStaffAssignment }>(
    `/property-manager-companies/${encodeURIComponent(companyId)}/staff-assignments/${encodeURIComponent(
      assignmentId
    )}/suspend`,
    {
      method: "POST",
      body: { reason: String(reason || "").trim() || null },
    }
  );
}

export async function reactivatePropertyManagerCompanyStaffAssignment(companyId: string, assignmentId: string) {
  return apiFetch<{ ok: true; assignment: PropertyManagerCompanyStaffAssignment }>(
    `/property-manager-companies/${encodeURIComponent(companyId)}/staff-assignments/${encodeURIComponent(
      assignmentId
    )}/reactivate`,
    { method: "POST" }
  );
}

export async function removePropertyManagerCompanyStaffAssignment(companyId: string, assignmentId: string, reason?: string) {
  return apiFetch<{ ok: true; assignment: PropertyManagerCompanyStaffAssignment }>(
    `/property-manager-companies/${encodeURIComponent(companyId)}/staff-assignments/${encodeURIComponent(
      assignmentId
    )}/remove`,
    {
      method: "POST",
      body: { reason: String(reason || "").trim() || null },
    }
  );
}
