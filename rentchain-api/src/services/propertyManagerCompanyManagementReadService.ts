import { db } from "../firebase";
import {
  LANDLORD_COMPANY_RELATIONSHIP_STATUSES,
  PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES,
  PROPERTY_MANAGER_COMPANY_ROLES,
  PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_STATUSES,
  PROPERTY_MANAGER_COMPANY_STATUSES,
  type LandlordCompanyRelationship,
  type PropertyManagerCompany,
  type PropertyManagerCompanyMembership,
  type PropertyManagerCompanyRelationshipScope,
  type PropertyManagerCompanyStaffAssignment,
} from "../lib/propertyManagerCompany";
import {
  LANDLORD_COMPANY_RELATIONSHIPS_COLLECTION,
  PROPERTY_MANAGER_COMPANIES_COLLECTION,
  PROPERTY_MANAGER_COMPANY_MEMBERSHIPS_COLLECTION,
  type PropertyManagerCompanyRelationshipFirestoreLike,
} from "./propertyManagerCompanyRelationshipService";
import { PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENTS_COLLECTION } from "./propertyManagerCompanyStaffAssignmentService";

type SnapshotLike = {
  id?: string;
  exists?: boolean;
  data: () => Record<string, unknown> | undefined;
};

type ServiceOptions = {
  firestore?: PropertyManagerCompanyRelationshipFirestoreLike;
};

type StaffAssignmentSummary = {
  total: number;
  active: number;
  suspended: number;
  removed: number;
};

export type PropertyManagerCompanyLookupProjection = {
  propertyManagerCompanyId: string;
  companyLabel: string;
  status: PropertyManagerCompany["status"];
};

export type PropertyManagerCompanyRelationshipManagementProjection = {
  relationshipId: string;
  landlordId?: string;
  propertyManagerCompanyId: string;
  propertyManagerCompanyLabel: string;
  landlordWorkspaceLabel: string;
  status: LandlordCompanyRelationship["status"];
  relationshipScope: PropertyManagerCompanyRelationshipScope;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  suspendedAt: string | null;
  reactivatedAt: string | null;
  terminatedAt: string | null;
  staffAssignmentSummary: StaffAssignmentSummary;
};

export type PropertyManagerCompanyMembershipProjection = {
  staffUserId: string;
  staffLabel: string;
  role: PropertyManagerCompanyMembership["role"];
  status: PropertyManagerCompanyMembership["status"];
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  removedAt: string | null;
};

export type PropertyManagerCompanyStaffAssignmentReadProjection = {
  assignmentId: string;
  propertyManagerCompanyId: string;
  relationshipId: string;
  staffUserId: string;
  staffLabel: string;
  staffDisplayLabel: string;
  staffRole: PropertyManagerCompanyStaffAssignment["staffRole"];
  status: PropertyManagerCompanyStaffAssignment["status"];
  propertyScope: PropertyManagerCompanyStaffAssignment["propertyScope"];
  workspaceScopes: PropertyManagerCompanyStaffAssignment["workspaceScopes"];
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  reactivatedAt: string | null;
  removedAt: string | null;
};

function readDb(
  firestore?: PropertyManagerCompanyRelationshipFirestoreLike
): PropertyManagerCompanyRelationshipFirestoreLike {
  return firestore || (db as unknown as PropertyManagerCompanyRelationshipFirestoreLike);
}

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireString(value: unknown, code: string, max = 500): string {
  const text = cleanString(value, max);
  if (!text) throw new Error(code);
  return text;
}

function normalizedLabel(value: unknown, fallback: string, unsafeValue?: string): string {
  const label = cleanString(value, 160).replace(/\s+/g, " ");
  if (!label || label === unsafeValue) return fallback;
  return label;
}

function companyFromSnapshot(snapshot: SnapshotLike): PropertyManagerCompany | null {
  const data = snapshot.data();
  if (!data) return null;
  return data as PropertyManagerCompany;
}

function relationshipFromSnapshot(snapshot: SnapshotLike): LandlordCompanyRelationship | null {
  const data = snapshot.data();
  if (!data) return null;
  return data as LandlordCompanyRelationship;
}

function membershipFromSnapshot(snapshot: SnapshotLike): PropertyManagerCompanyMembership | null {
  const data = snapshot.data();
  if (!data) return null;
  return data as PropertyManagerCompanyMembership;
}

function assignmentFromSnapshot(snapshot: SnapshotLike): PropertyManagerCompanyStaffAssignment | null {
  const data = snapshot.data();
  if (!data) return null;
  return data as PropertyManagerCompanyStaffAssignment;
}

function hasValidCompanyShape(company: PropertyManagerCompany | null): company is PropertyManagerCompany {
  return Boolean(
    company &&
      cleanString(company.companyId, 200) &&
      PROPERTY_MANAGER_COMPANY_STATUSES.includes(company.status)
  );
}

function hasValidRelationshipShape(
  relationship: LandlordCompanyRelationship | null
): relationship is LandlordCompanyRelationship {
  return Boolean(
    relationship &&
      cleanString(relationship.relationshipId, 200) &&
      cleanString(relationship.landlordId, 200) &&
      cleanString(relationship.propertyManagerCompanyId, 200) &&
      LANDLORD_COMPANY_RELATIONSHIP_STATUSES.includes(relationship.status)
  );
}

function hasValidMembershipShape(membership: PropertyManagerCompanyMembership | null): membership is PropertyManagerCompanyMembership {
  return Boolean(
    membership &&
      cleanString(membership.companyId, 200) &&
      cleanString(membership.userId, 200) &&
      PROPERTY_MANAGER_COMPANY_ROLES.includes(membership.role) &&
      PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES.includes(membership.status)
  );
}

function hasValidAssignmentShape(
  assignment: PropertyManagerCompanyStaffAssignment | null
): assignment is PropertyManagerCompanyStaffAssignment {
  return Boolean(
    assignment &&
      cleanString(assignment.assignmentId, 200) &&
      cleanString(assignment.propertyManagerCompanyId, 200) &&
      cleanString(assignment.relationshipId, 200) &&
      cleanString(assignment.staffUserId, 200) &&
      PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_STATUSES.includes(assignment.status)
  );
}

async function loadCompanies(firestore: PropertyManagerCompanyRelationshipFirestoreLike): Promise<PropertyManagerCompany[]> {
  const snapshot = await firestore.collection<PropertyManagerCompany>(PROPERTY_MANAGER_COMPANIES_COLLECTION).get?.();
  return (snapshot?.docs || []).map(companyFromSnapshot).filter(hasValidCompanyShape);
}

async function loadRelationships(
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<LandlordCompanyRelationship[]> {
  const snapshot = await firestore.collection<LandlordCompanyRelationship>(LANDLORD_COMPANY_RELATIONSHIPS_COLLECTION).get?.();
  return (snapshot?.docs || []).map(relationshipFromSnapshot).filter(hasValidRelationshipShape);
}

async function loadMemberships(
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<PropertyManagerCompanyMembership[]> {
  const snapshot = await firestore.collection<PropertyManagerCompanyMembership>(PROPERTY_MANAGER_COMPANY_MEMBERSHIPS_COLLECTION).get?.();
  return (snapshot?.docs || []).map(membershipFromSnapshot).filter(hasValidMembershipShape);
}

async function loadAssignments(
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<PropertyManagerCompanyStaffAssignment[]> {
  const snapshot = await firestore.collection<PropertyManagerCompanyStaffAssignment>(PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENTS_COLLECTION).get?.();
  return (snapshot?.docs || []).map(assignmentFromSnapshot).filter(hasValidAssignmentShape);
}

function safeCompanyLabel(company: PropertyManagerCompany | null, companyId: string): string {
  return normalizedLabel(company?.safeDisplayLabel || company?.companyName, "Property manager company", companyId);
}

function safeStaffLabel(membership: PropertyManagerCompanyMembership | null, staffUserId: string): string {
  const record = membership as (PropertyManagerCompanyMembership & { safeDisplayLabel?: unknown; displayName?: unknown }) | null;
  return normalizedLabel(record?.safeDisplayLabel || record?.displayName, "Company staff", staffUserId);
}

function safeLandlordWorkspaceLabel(relationship: LandlordCompanyRelationship): string {
  const record = relationship as LandlordCompanyRelationship & { landlordWorkspaceLabel?: unknown; landlordLabel?: unknown };
  return normalizedLabel(record.landlordWorkspaceLabel || record.landlordLabel, "Landlord workspace", relationship.landlordId);
}

function assignmentSummary(assignments: PropertyManagerCompanyStaffAssignment[]): StaffAssignmentSummary {
  return assignments.reduce(
    (summary, assignment) => {
      summary.total += 1;
      if (assignment.status === "active") summary.active += 1;
      if (assignment.status === "suspended") summary.suspended += 1;
      if (assignment.status === "removed") summary.removed += 1;
      return summary;
    },
    { total: 0, active: 0, suspended: 0, removed: 0 }
  );
}

function projectRelationship(input: {
  relationship: LandlordCompanyRelationship;
  company: PropertyManagerCompany | null;
  assignments: PropertyManagerCompanyStaffAssignment[];
  includeLandlordId?: boolean;
}): PropertyManagerCompanyRelationshipManagementProjection {
  const projection: PropertyManagerCompanyRelationshipManagementProjection = {
    relationshipId: input.relationship.relationshipId,
    propertyManagerCompanyId: input.relationship.propertyManagerCompanyId,
    propertyManagerCompanyLabel: safeCompanyLabel(input.company, input.relationship.propertyManagerCompanyId),
    landlordWorkspaceLabel: safeLandlordWorkspaceLabel(input.relationship),
    status: input.relationship.status,
    relationshipScope: input.relationship.relationshipScope,
    createdAt: input.relationship.createdAt,
    updatedAt: input.relationship.updatedAt,
    startedAt: input.relationship.startedAt,
    suspendedAt: input.relationship.suspendedAt,
    reactivatedAt: input.relationship.reactivatedAt,
    terminatedAt: input.relationship.terminatedAt,
    staffAssignmentSummary: assignmentSummary(input.assignments),
  };
  if (input.includeLandlordId) projection.landlordId = input.relationship.landlordId;
  return projection;
}

function projectMembership(membership: PropertyManagerCompanyMembership): PropertyManagerCompanyMembershipProjection {
  return {
    staffUserId: membership.userId,
    staffLabel: safeStaffLabel(membership, membership.userId),
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    suspendedAt: membership.suspendedAt,
    removedAt: membership.removedAt,
  };
}

function projectAssignment(
  assignment: PropertyManagerCompanyStaffAssignment,
  membership: PropertyManagerCompanyMembership | null
): PropertyManagerCompanyStaffAssignmentReadProjection {
  const staffLabel = safeStaffLabel(membership, assignment.staffUserId);
  return {
    assignmentId: assignment.assignmentId,
    propertyManagerCompanyId: assignment.propertyManagerCompanyId,
    relationshipId: assignment.relationshipId,
    staffUserId: assignment.staffUserId,
    staffLabel,
    staffDisplayLabel: staffLabel,
    staffRole: assignment.staffRole,
    status: assignment.status,
    propertyScope: assignment.propertyScope,
    workspaceScopes: assignment.workspaceScopes,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    suspendedAt: assignment.suspendedAt,
    reactivatedAt: assignment.reactivatedAt,
    removedAt: assignment.removedAt,
  };
}

function requireCompanyManagerMembership(
  memberships: PropertyManagerCompanyMembership[],
  companyId: string,
  actorUserId: string
): PropertyManagerCompanyMembership {
  const membership = memberships.find((candidate) => candidate.companyId === companyId && candidate.userId === actorUserId);
  if (!membership) throw new Error("property_manager_company_membership_not_found");
  if (membership.status !== "active") throw new Error("property_manager_company_membership_not_active");
  if (!["company_owner", "company_admin"].includes(membership.role)) {
    throw new Error("company_management_read_role_not_allowed");
  }
  return membership;
}

export async function searchPropertyManagerCompaniesForLandlord(
  input: { query?: string | null },
  options: ServiceOptions = {}
): Promise<{ companies: PropertyManagerCompanyLookupProjection[] }> {
  const firestore = readDb(options.firestore);
  const query = cleanString(input.query, 120).toLowerCase();
  const companies = (await loadCompanies(firestore))
    .filter((company) => company.status === "active")
    .filter((company) => {
      if (!query) return true;
      return safeCompanyLabel(company, company.companyId).toLowerCase().includes(query);
    })
    .sort((a, b) => safeCompanyLabel(a, a.companyId).localeCompare(safeCompanyLabel(b, b.companyId)))
    .slice(0, 25)
    .map((company) => ({
      propertyManagerCompanyId: company.companyId,
      companyLabel: safeCompanyLabel(company, company.companyId),
      status: company.status,
    }));
  return { companies };
}

export async function listLandlordPropertyManagerRelationshipManagementRecords(
  input: { landlordId: string },
  options: ServiceOptions = {}
): Promise<{ relationships: PropertyManagerCompanyRelationshipManagementProjection[] }> {
  const firestore = readDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const [companies, relationships, assignments] = await Promise.all([
    loadCompanies(firestore),
    loadRelationships(firestore),
    loadAssignments(firestore),
  ]);
  const companyById = new Map(companies.map((company) => [company.companyId, company]));
  const relationshipsForLandlord = relationships
    .filter((relationship) => relationship.landlordId === landlordId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return {
    relationships: relationshipsForLandlord.map((relationship) =>
      projectRelationship({
        relationship,
        company: companyById.get(relationship.propertyManagerCompanyId) || null,
        assignments: assignments.filter((assignment) => assignment.relationshipId === relationship.relationshipId),
        includeLandlordId: true,
      })
    ),
  };
}

export async function listMyPropertyManagerCompanyContexts(
  input: { actorUserId: string },
  options: ServiceOptions = {}
): Promise<{ companies: Array<PropertyManagerCompanyLookupProjection & { role: PropertyManagerCompanyMembership["role"] }> }> {
  const firestore = readDb(options.firestore);
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const [companies, memberships] = await Promise.all([loadCompanies(firestore), loadMemberships(firestore)]);
  const companyById = new Map(companies.map((company) => [company.companyId, company]));
  const contexts = memberships
    .filter((membership) => membership.userId === actorUserId)
    .filter((membership) => membership.status === "active")
    .filter((membership) => ["company_owner", "company_admin"].includes(membership.role))
    .map((membership) => ({ membership, company: companyById.get(membership.companyId) || null }))
    .filter((context): context is { membership: PropertyManagerCompanyMembership; company: PropertyManagerCompany } =>
      hasValidCompanyShape(context.company)
    )
    .sort((a, b) =>
      safeCompanyLabel(a.company, a.company.companyId).localeCompare(safeCompanyLabel(b.company, b.company.companyId))
    )
    .map(({ membership, company }) => ({
      propertyManagerCompanyId: company.companyId,
      companyLabel: safeCompanyLabel(company, company.companyId),
      status: company.status,
      role: membership.role,
    }));
  return { companies: contexts };
}

export async function listCompanyRelationshipManagementRecords(
  input: { actorUserId: string; companyId: string },
  options: ServiceOptions = {}
): Promise<{ relationships: PropertyManagerCompanyRelationshipManagementProjection[] }> {
  const firestore = readDb(options.firestore);
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const [companies, memberships, relationships, assignments] = await Promise.all([
    loadCompanies(firestore),
    loadMemberships(firestore),
    loadRelationships(firestore),
    loadAssignments(firestore),
  ]);
  requireCompanyManagerMembership(memberships, companyId, actorUserId);
  const company = companies.find((candidate) => candidate.companyId === companyId) || null;
  const relationshipsForCompany = relationships
    .filter((relationship) => relationship.propertyManagerCompanyId === companyId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return {
    relationships: relationshipsForCompany.map((relationship) =>
      projectRelationship({
        relationship,
        company,
        assignments: assignments.filter((assignment) => assignment.relationshipId === relationship.relationshipId),
      })
    ),
  };
}

export async function listCompanyMembersForManagement(
  input: { actorUserId: string; companyId: string },
  options: ServiceOptions = {}
): Promise<{ members: PropertyManagerCompanyMembershipProjection[] }> {
  const firestore = readDb(options.firestore);
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const memberships = await loadMemberships(firestore);
  requireCompanyManagerMembership(memberships, companyId, actorUserId);
  const members = memberships
    .filter((membership) => membership.companyId === companyId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .map(projectMembership);
  return { members };
}

export async function listCompanyStaffAssignmentsForManagement(
  input: { actorUserId: string; companyId: string; relationshipId?: string | null },
  options: ServiceOptions = {}
): Promise<{ assignments: PropertyManagerCompanyStaffAssignmentReadProjection[] }> {
  const firestore = readDb(options.firestore);
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const relationshipId = cleanString(input.relationshipId, 200);
  const [memberships, relationships, assignments] = await Promise.all([
    loadMemberships(firestore),
    loadRelationships(firestore),
    loadAssignments(firestore),
  ]);
  requireCompanyManagerMembership(memberships, companyId, actorUserId);
  if (relationshipId && !relationships.some((relationship) => relationship.relationshipId === relationshipId && relationship.propertyManagerCompanyId === companyId)) {
    throw new Error("landlord_company_relationship_not_found");
  }
  const membershipByUserId = new Map(
    memberships.filter((membership) => membership.companyId === companyId).map((membership) => [membership.userId, membership])
  );
  return {
    assignments: assignments
      .filter((assignment) => assignment.propertyManagerCompanyId === companyId)
      .filter((assignment) => !relationshipId || assignment.relationshipId === relationshipId)
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .map((assignment) => projectAssignment(assignment, membershipByUserId.get(assignment.staffUserId) || null)),
  };
}

export async function listLandlordRelationshipStaffAssignmentsForManagement(
  input: { landlordId: string; relationshipId: string },
  options: ServiceOptions = {}
): Promise<{ assignments: PropertyManagerCompanyStaffAssignmentReadProjection[] }> {
  const firestore = readDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const relationshipId = requireString(input.relationshipId, "missing_relationship_id");
  const [memberships, relationships, assignments] = await Promise.all([
    loadMemberships(firestore),
    loadRelationships(firestore),
    loadAssignments(firestore),
  ]);
  const relationship = relationships.find((candidate) => candidate.relationshipId === relationshipId && candidate.landlordId === landlordId);
  if (!relationship) throw new Error("landlord_company_relationship_not_found");
  const membershipByUserId = new Map(
    memberships
      .filter((membership) => membership.companyId === relationship.propertyManagerCompanyId)
      .map((membership) => [membership.userId, membership])
  );
  return {
    assignments: assignments
      .filter((assignment) => assignment.relationshipId === relationship.relationshipId)
      .filter((assignment) => assignment.propertyManagerCompanyId === relationship.propertyManagerCompanyId)
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .map((assignment) => projectAssignment(assignment, membershipByUserId.get(assignment.staffUserId) || null)),
  };
}
