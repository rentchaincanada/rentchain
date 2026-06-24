import crypto from "crypto";
import {
  LANDLORD_COMPANY_RELATIONSHIP_STATUSES,
  PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES,
  PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES,
  PROPERTY_MANAGER_COMPANY_ROLES,
  PROPERTY_MANAGER_COMPANY_STATUSES,
  PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES,
  type LandlordCompanyRelationship,
  type LandlordCompanyRelationshipStatus,
  type PropertyManagerCompany,
  type PropertyManagerCompanyMembership,
  type PropertyManagerCompanyMembershipStatus,
  type PropertyManagerCompanyPropertyScope,
  type PropertyManagerCompanyRelationshipScope,
  type PropertyManagerCompanyRole,
  type PropertyManagerCompanyStatus,
  type PropertyManagerCompanyWorkspaceScope,
} from "./propertyManagerCompanyTypes";

type CompanyInput = {
  companyId?: string;
  companyName: string;
  status?: PropertyManagerCompanyStatus;
  createdByUserId: string;
  createdAt?: string;
};

type MembershipInput = {
  membershipId?: string;
  companyId: string;
  userId: string;
  role: string;
  status?: PropertyManagerCompanyMembershipStatus;
  invitedByUserId?: string | null;
  createdByUserId: string;
  createdAt?: string;
};

type RelationshipInput = {
  relationshipId?: string;
  landlordId: string;
  propertyManagerCompanyId: string;
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: string[];
  createdByLandlordOwnerUserId: string;
  acceptedByCompanyAdminUserId?: string | null;
  status?: LandlordCompanyRelationshipStatus;
  createdAt?: string;
  startedAt?: string | null;
};

export class PropertyManagerCompanyValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PropertyManagerCompanyValidationError";
  }
}

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireString(value: unknown, code: string, max = 500): string {
  const text = cleanString(value, max);
  if (!text) throw new PropertyManagerCompanyValidationError(code);
  return text;
}

function parseDate(value: unknown, code: string): string {
  const text = requireString(value, code, 120);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) throw new PropertyManagerCompanyValidationError(code);
  return new Date(parsed).toISOString();
}

function hashId(prefix: string, parts: readonly unknown[]): string {
  const digest = crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

function dedupeStrings<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function isPropertyManagerCompanyStatus(value: unknown): value is PropertyManagerCompanyStatus {
  return PROPERTY_MANAGER_COMPANY_STATUSES.includes(value as PropertyManagerCompanyStatus);
}

export function isPropertyManagerCompanyMembershipStatus(value: unknown): value is PropertyManagerCompanyMembershipStatus {
  return PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES.includes(value as PropertyManagerCompanyMembershipStatus);
}

export function isPropertyManagerCompanyRole(value: unknown): value is PropertyManagerCompanyRole {
  return PROPERTY_MANAGER_COMPANY_ROLES.includes(value as PropertyManagerCompanyRole);
}

export function isLandlordCompanyRelationshipStatus(value: unknown): value is LandlordCompanyRelationshipStatus {
  return LANDLORD_COMPANY_RELATIONSHIP_STATUSES.includes(value as LandlordCompanyRelationshipStatus);
}

export function assertPropertyManagerCompanyRole(value: unknown): PropertyManagerCompanyRole {
  if (!isPropertyManagerCompanyRole(value)) throw new PropertyManagerCompanyValidationError("invalid_company_role");
  return value;
}

function assertWorkspaceScope(value: unknown): PropertyManagerCompanyWorkspaceScope {
  if (!PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES.includes(value as PropertyManagerCompanyWorkspaceScope)) {
    throw new PropertyManagerCompanyValidationError("invalid_workspace_scope");
  }
  return value as PropertyManagerCompanyWorkspaceScope;
}

function normalizeWorkspaceScopes(values: string[]): PropertyManagerCompanyWorkspaceScope[] {
  const scopes = dedupeStrings(values.map(assertWorkspaceScope));
  if (scopes.length === 0) throw new PropertyManagerCompanyValidationError("missing_workspace_scope");
  if (scopes.includes("settings_billing")) {
    throw new PropertyManagerCompanyValidationError("company_billing_scope_not_allowed");
  }
  return scopes;
}

export function normalizeCompanyDisplayLabel(companyName: unknown): string {
  return requireString(companyName, "missing_company_name", 160).replace(/\s+/g, " ");
}

export function normalizeCompanyPropertyScope(scope: PropertyManagerCompanyPropertyScope): PropertyManagerCompanyPropertyScope {
  if (!PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES.includes(scope?.mode)) {
    throw new PropertyManagerCompanyValidationError("invalid_property_scope_mode");
  }
  const propertyIds = dedupeStrings((scope.propertyIds || []).map((id) => requireString(id, "invalid_property_scope")));
  if (scope.mode === "selected_properties" && propertyIds.length === 0) {
    throw new PropertyManagerCompanyValidationError("missing_selected_property_scope");
  }
  if (scope.mode === "all_current_properties" && propertyIds.length > 0) {
    throw new PropertyManagerCompanyValidationError("property_scope_mode_mismatch");
  }
  return {
    mode: scope.mode,
    propertyIds,
  };
}

export function buildRelationshipScope(input: {
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: string[];
}): PropertyManagerCompanyRelationshipScope {
  return {
    propertyScope: normalizeCompanyPropertyScope(input.propertyScope),
    workspaceScopes: normalizeWorkspaceScopes(input.workspaceScopes),
  };
}

export function createPropertyManagerCompany(input: CompanyInput): PropertyManagerCompany {
  const companyName = normalizeCompanyDisplayLabel(input.companyName);
  const createdByUserId = requireString(input.createdByUserId, "missing_created_by_user_id");
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const status = input.status || "active";
  if (!isPropertyManagerCompanyStatus(status)) throw new PropertyManagerCompanyValidationError("invalid_company_status");
  return {
    companyId: input.companyId || hashId("pm_company", [companyName, createdByUserId, createdAt]),
    companyName,
    safeDisplayLabel: companyName,
    status,
    createdByUserId,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createPropertyManagerCompanyMembership(input: MembershipInput): PropertyManagerCompanyMembership {
  const companyId = requireString(input.companyId, "missing_company_id");
  const userId = requireString(input.userId, "missing_user_id");
  const createdByUserId = requireString(input.createdByUserId, "missing_created_by_user_id");
  const role = assertPropertyManagerCompanyRole(input.role);
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const status = input.status || "active";
  if (!isPropertyManagerCompanyMembershipStatus(status)) {
    throw new PropertyManagerCompanyValidationError("invalid_membership_status");
  }
  return {
    membershipId: input.membershipId || hashId("pm_membership", [companyId, userId, role, createdAt]),
    companyId,
    userId,
    role,
    status,
    invitedByUserId: input.invitedByUserId ? cleanString(input.invitedByUserId, 200) : null,
    createdByUserId,
    createdAt,
    updatedAt: createdAt,
    suspendedAt: null,
    suspendedByUserId: null,
    removedAt: null,
    removedByUserId: null,
  };
}

export function suspendPropertyManagerCompanyMembership(
  membership: PropertyManagerCompanyMembership,
  context: { suspendedByUserId: string; suspendedAt?: string }
): PropertyManagerCompanyMembership {
  if (membership.status !== "active") throw new PropertyManagerCompanyValidationError("membership_not_active");
  const suspendedByUserId = requireString(context.suspendedByUserId, "missing_suspended_by_user_id");
  const suspendedAt = context.suspendedAt ? parseDate(context.suspendedAt, "invalid_suspended_at") : new Date().toISOString();
  return {
    ...membership,
    status: "suspended",
    suspendedAt,
    suspendedByUserId,
    updatedAt: suspendedAt,
  };
}

export function removePropertyManagerCompanyMembership(
  membership: PropertyManagerCompanyMembership,
  context: { removedByUserId: string; removedAt?: string }
): PropertyManagerCompanyMembership {
  if (membership.status === "removed") throw new PropertyManagerCompanyValidationError("membership_already_removed");
  const removedByUserId = requireString(context.removedByUserId, "missing_removed_by_user_id");
  const removedAt = context.removedAt ? parseDate(context.removedAt, "invalid_removed_at") : new Date().toISOString();
  return {
    ...membership,
    status: "removed",
    removedAt,
    removedByUserId,
    updatedAt: removedAt,
  };
}

export function createLandlordCompanyRelationship(input: RelationshipInput): LandlordCompanyRelationship {
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const propertyManagerCompanyId = requireString(input.propertyManagerCompanyId, "missing_property_manager_company_id");
  const createdByLandlordOwnerUserId = requireString(input.createdByLandlordOwnerUserId, "missing_created_by_landlord_owner_user_id");
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const status = input.status || "pending";
  if (!isLandlordCompanyRelationshipStatus(status)) {
    throw new PropertyManagerCompanyValidationError("invalid_relationship_status");
  }
  const relationshipScope = buildRelationshipScope(input);
  const startedAt = input.startedAt ? parseDate(input.startedAt, "invalid_started_at") : status === "active" ? createdAt : null;
  return {
    relationshipId: input.relationshipId || hashId("landlord_pm_relationship", [landlordId, propertyManagerCompanyId, createdAt]),
    landlordId,
    propertyManagerCompanyId,
    status,
    relationshipScope,
    createdByLandlordOwnerUserId,
    acceptedByCompanyAdminUserId: input.acceptedByCompanyAdminUserId ? cleanString(input.acceptedByCompanyAdminUserId, 200) : null,
    createdAt,
    updatedAt: createdAt,
    startedAt,
    suspendedAt: null,
    suspendedByUserId: null,
    reactivatedAt: null,
    terminatedAt: null,
    terminatedByUserId: null,
    terminationReason: null,
    auditEventIds: [],
  };
}

export function activateLandlordCompanyRelationship(
  relationship: LandlordCompanyRelationship,
  context: { acceptedByCompanyAdminUserId: string; startedAt?: string }
): LandlordCompanyRelationship {
  if (relationship.status !== "pending") throw new PropertyManagerCompanyValidationError("relationship_not_pending");
  const acceptedByCompanyAdminUserId = requireString(context.acceptedByCompanyAdminUserId, "missing_accepted_by_company_admin_user_id");
  const startedAt = context.startedAt ? parseDate(context.startedAt, "invalid_started_at") : new Date().toISOString();
  return {
    ...relationship,
    status: "active",
    acceptedByCompanyAdminUserId,
    startedAt,
    updatedAt: startedAt,
  };
}

export function suspendLandlordCompanyRelationship(
  relationship: LandlordCompanyRelationship,
  context: { suspendedByUserId: string; suspendedAt?: string }
): LandlordCompanyRelationship {
  if (relationship.status !== "active") throw new PropertyManagerCompanyValidationError("relationship_not_active");
  const suspendedByUserId = requireString(context.suspendedByUserId, "missing_suspended_by_user_id");
  const suspendedAt = context.suspendedAt ? parseDate(context.suspendedAt, "invalid_suspended_at") : new Date().toISOString();
  return {
    ...relationship,
    status: "suspended",
    suspendedAt,
    suspendedByUserId,
    updatedAt: suspendedAt,
  };
}

export function reactivateLandlordCompanyRelationship(
  relationship: LandlordCompanyRelationship,
  context: { reactivatedAt?: string }
): LandlordCompanyRelationship {
  if (relationship.status !== "suspended") throw new PropertyManagerCompanyValidationError("relationship_not_suspended");
  const reactivatedAt = context.reactivatedAt ? parseDate(context.reactivatedAt, "invalid_reactivated_at") : new Date().toISOString();
  return {
    ...relationship,
    status: "active",
    reactivatedAt,
    updatedAt: reactivatedAt,
  };
}

export function terminateLandlordCompanyRelationship(
  relationship: LandlordCompanyRelationship,
  context: { terminatedByUserId: string; terminatedAt?: string; reason?: string | null }
): LandlordCompanyRelationship {
  if (relationship.status === "terminated") throw new PropertyManagerCompanyValidationError("relationship_already_terminated");
  const terminatedByUserId = requireString(context.terminatedByUserId, "missing_terminated_by_user_id");
  const terminatedAt = context.terminatedAt ? parseDate(context.terminatedAt, "invalid_terminated_at") : new Date().toISOString();
  return {
    ...relationship,
    status: "terminated",
    terminatedAt,
    terminatedByUserId,
    terminationReason: context.reason ? cleanString(context.reason, 500) : null,
    updatedAt: terminatedAt,
  };
}
