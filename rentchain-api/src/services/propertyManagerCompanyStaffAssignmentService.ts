import { db } from "../firebase";
import {
  buildPropertyManagerCompanyAuditEvent,
  createPropertyManagerCompanyStaffAssignment,
  reactivatePropertyManagerCompanyStaffAssignment,
  removePropertyManagerCompanyStaffAssignment,
  suspendPropertyManagerCompanyStaffAssignment,
  type LandlordCompanyRelationship,
  type PropertyManagerCompanyAuditEvent,
  type PropertyManagerCompanyAuditOutcome,
  type PropertyManagerCompanyMembership,
  type PropertyManagerCompanyPropertyScope,
  type PropertyManagerCompanyStaffAssignment,
  type PropertyManagerCompanyStaffAssignmentStatus,
} from "../lib/propertyManagerCompany";
import {
  LANDLORD_COMPANY_RELATIONSHIPS_COLLECTION,
  PROPERTY_MANAGER_COMPANY_AUDIT_EVENTS_COLLECTION,
  PROPERTY_MANAGER_COMPANY_MEMBERSHIPS_COLLECTION,
  type PropertyManagerCompanyRelationshipFirestoreLike,
} from "./propertyManagerCompanyRelationshipService";

export const PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENTS_COLLECTION = "propertyManagerCompanyStaffAssignments";

type SnapshotLike = {
  id?: string;
  exists?: boolean;
  data: () => Record<string, unknown> | undefined;
};

type ServiceOptions = {
  firestore?: PropertyManagerCompanyRelationshipFirestoreLike;
};

type CreateAssignmentInput = {
  actorUserId: string;
  companyId: string;
  relationshipId: string;
  staffUserId: string;
  staffRole: string;
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: string[];
  now?: string;
};

type ListAssignmentsInput = {
  actorUserId: string;
  companyId: string;
  relationshipId?: string | null;
};

type AssignmentLifecycleInput = {
  actorUserId: string;
  companyId: string;
  assignmentId: string;
  reason?: string | null;
  now?: string;
};

export type PropertyManagerCompanyStaffAssignmentProjection = Omit<PropertyManagerCompanyStaffAssignment, "auditEventIds"> & {
  staffDisplayLabel: string;
};

function assignmentDb(
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

async function loadRelationship(
  relationshipId: string,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<LandlordCompanyRelationship | null> {
  const ref = firestore
    .collection<LandlordCompanyRelationship>(LANDLORD_COMPANY_RELATIONSHIPS_COLLECTION)
    .doc(relationshipId);
  const snapshot = await ref.get?.();
  if (!snapshot?.exists) return null;
  return relationshipFromSnapshot(snapshot);
}

async function loadAssignment(
  assignmentId: string,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<PropertyManagerCompanyStaffAssignment | null> {
  const ref = firestore
    .collection<PropertyManagerCompanyStaffAssignment>(PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENTS_COLLECTION)
    .doc(assignmentId);
  const snapshot = await ref.get?.();
  if (!snapshot?.exists) return null;
  return assignmentFromSnapshot(snapshot);
}

async function loadMembership(
  companyId: string,
  userId: string,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike,
  missingCode = "property_manager_company_membership_not_found"
): Promise<PropertyManagerCompanyMembership> {
  const snapshot = await firestore.collection<PropertyManagerCompanyMembership>(PROPERTY_MANAGER_COMPANY_MEMBERSHIPS_COLLECTION).get?.();
  const membership = (snapshot?.docs || [])
    .map(membershipFromSnapshot)
    .find((candidate): candidate is PropertyManagerCompanyMembership => {
      return Boolean(candidate && candidate.companyId === companyId && candidate.userId === userId);
    });
  if (!membership) throw new Error(missingCode);
  return membership;
}

function requireCompanyAssignmentManager(membership: PropertyManagerCompanyMembership, companyId: string) {
  if (membership.companyId !== companyId) throw new Error("property_manager_company_membership_mismatch");
  if (membership.status !== "active") throw new Error("property_manager_company_membership_not_active");
  if (
    ![
      "company_owner",
      "company_admin",
      "regional_manager",
      "property_manager",
      "leasing_agent",
      "office_administrator",
      "maintenance_coordinator",
      "read_only_staff",
    ].includes(membership.role)
  ) {
    throw new Error("invalid_company_role");
  }
  if (!["company_owner", "company_admin"].includes(membership.role)) {
    throw new Error("company_assignment_manager_required");
  }
}

function requireRelationshipForCompany(
  relationship: LandlordCompanyRelationship | null,
  companyId: string
): LandlordCompanyRelationship {
  if (!relationship || relationship.propertyManagerCompanyId !== companyId) {
    throw new Error("landlord_company_relationship_not_found");
  }
  return relationship;
}

function requireAssignmentForCompany(
  assignment: PropertyManagerCompanyStaffAssignment | null,
  companyId: string
): PropertyManagerCompanyStaffAssignment {
  if (!assignment || assignment.propertyManagerCompanyId !== companyId) {
    throw new Error("property_manager_company_staff_assignment_not_found");
  }
  return assignment;
}

function projectAssignment(assignment: PropertyManagerCompanyStaffAssignment): PropertyManagerCompanyStaffAssignmentProjection {
  const { auditEventIds: _auditEventIds, ...safe } = assignment;
  return {
    ...safe,
    staffDisplayLabel: "Company staff",
  };
}

async function appendAuditEvent(
  event: PropertyManagerCompanyAuditEvent,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
) {
  const ref = firestore
    .collection<PropertyManagerCompanyAuditEvent>(PROPERTY_MANAGER_COMPANY_AUDIT_EVENTS_COLLECTION)
    .doc(event.eventId);
  if (ref.create) {
    await ref.create(event);
    return;
  }
  if (!ref.set) throw new Error("property_manager_company_audit_append_unavailable");
  await ref.set(event, { merge: false });
}

async function saveAssignment(
  assignment: PropertyManagerCompanyStaffAssignment,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
) {
  const ref = firestore
    .collection<PropertyManagerCompanyStaffAssignment>(PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENTS_COLLECTION)
    .doc(assignment.assignmentId);
  if (!ref.set) throw new Error("property_manager_company_staff_assignment_write_unavailable");
  await ref.set(assignment, { merge: false });
}

function buildAssignmentAuditEvent(input: {
  eventType:
    | "staff_assignment_created"
    | "staff_assignment_suspended"
    | "staff_assignment_reactivated"
    | "staff_assignment_removed";
  actorUserId: string;
  companyId: string;
  landlordId: string;
  relationshipId: string;
  assignment: PropertyManagerCompanyStaffAssignment;
  from: PropertyManagerCompanyStaffAssignmentStatus | null;
  to: PropertyManagerCompanyStaffAssignmentStatus;
  outcome: PropertyManagerCompanyAuditOutcome;
  timestamp: string;
  reason?: string | null;
}): PropertyManagerCompanyAuditEvent {
  return buildPropertyManagerCompanyAuditEvent({
    eventType: input.eventType,
    actorUserId: input.actorUserId,
    actorCompanyId: input.companyId,
    propertyManagerCompanyId: input.companyId,
    actingForLandlordId: input.landlordId,
    relationshipId: input.relationshipId,
    assignmentId: input.assignment.assignmentId,
    staffUserId: input.assignment.staffUserId,
    role: input.assignment.staffRole,
    scope: {
      propertyScope: input.assignment.propertyScope,
      workspaceScopes: input.assignment.workspaceScopes,
    },
    targetResourceType: "staff_assignment",
    targetResourceId: input.assignment.assignmentId,
    outcome: input.outcome,
    timestamp: input.timestamp,
    reason: input.reason || null,
    statusTransition: {
      from: input.from,
      to: input.to,
    },
  });
}

export async function listPropertyManagerCompanyStaffAssignmentRecords(
  input: ListAssignmentsInput,
  options: ServiceOptions = {}
): Promise<{ assignments: PropertyManagerCompanyStaffAssignmentProjection[] }> {
  const firestore = assignmentDb(options.firestore);
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const relationshipId = cleanString(input.relationshipId, 200);
  const actorMembership = await loadMembership(companyId, actorUserId, firestore);
  requireCompanyAssignmentManager(actorMembership, companyId);

  if (relationshipId) {
    requireRelationshipForCompany(await loadRelationship(relationshipId, firestore), companyId);
  }

  const snapshot = await firestore.collection<PropertyManagerCompanyStaffAssignment>(PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENTS_COLLECTION).get?.();
  const assignments = (snapshot?.docs || [])
    .map(assignmentFromSnapshot)
    .filter((assignment): assignment is PropertyManagerCompanyStaffAssignment => Boolean(assignment))
    .filter((assignment) => assignment.propertyManagerCompanyId === companyId)
    .filter((assignment) => !relationshipId || assignment.relationshipId === relationshipId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return { assignments: assignments.map(projectAssignment) };
}

export async function createPropertyManagerCompanyStaffAssignmentRecord(
  input: CreateAssignmentInput,
  options: ServiceOptions = {}
): Promise<{ assignment: PropertyManagerCompanyStaffAssignmentProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = assignmentDb(options.firestore);
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const relationshipId = requireString(input.relationshipId, "missing_relationship_id");
  const staffUserId = requireString(input.staffUserId, "missing_staff_user_id");
  const now = input.now || new Date().toISOString();

  const actorMembership = await loadMembership(companyId, actorUserId, firestore);
  requireCompanyAssignmentManager(actorMembership, companyId);
  const staffMembership = await loadMembership(
    companyId,
    staffUserId,
    firestore,
    "property_manager_company_staff_membership_not_found"
  );
  const relationship = requireRelationshipForCompany(await loadRelationship(relationshipId, firestore), companyId);

  const assignment = createPropertyManagerCompanyStaffAssignment({
    relationship,
    assignedByMembership: actorMembership,
    staffMembership,
    staffRole: input.staffRole,
    propertyScope: input.propertyScope,
    workspaceScopes: input.workspaceScopes,
    createdAt: now,
  });
  const auditEvent = buildAssignmentAuditEvent({
    eventType: "staff_assignment_created",
    actorUserId,
    companyId,
    landlordId: relationship.landlordId,
    relationshipId,
    assignment,
    from: null,
    to: "active",
    outcome: "created",
    timestamp: now,
  });
  const withAudit = { ...assignment, auditEventIds: [auditEvent.eventId] };
  await saveAssignment(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { assignment: projectAssignment(withAudit), auditEvent };
}

export async function suspendPropertyManagerCompanyStaffAssignmentRecord(
  input: AssignmentLifecycleInput,
  options: ServiceOptions = {}
): Promise<{ assignment: PropertyManagerCompanyStaffAssignmentProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = assignmentDb(options.firestore);
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const assignmentId = requireString(input.assignmentId, "missing_assignment_id");
  const now = input.now || new Date().toISOString();

  const actorMembership = await loadMembership(companyId, actorUserId, firestore);
  const assignment = requireAssignmentForCompany(await loadAssignment(assignmentId, firestore), companyId);
  const relationship = requireRelationshipForCompany(await loadRelationship(assignment.relationshipId, firestore), companyId);
  const suspended = suspendPropertyManagerCompanyStaffAssignment(assignment, {
    actorMembership,
    suspendedAt: now,
    reason: input.reason || null,
  });
  const auditEvent = buildAssignmentAuditEvent({
    eventType: "staff_assignment_suspended",
    actorUserId,
    companyId,
    landlordId: relationship.landlordId,
    relationshipId: relationship.relationshipId,
    assignment: suspended,
    from: assignment.status,
    to: "suspended",
    outcome: "suspended",
    timestamp: now,
    reason: input.reason || null,
  });
  const withAudit = { ...suspended, auditEventIds: [...suspended.auditEventIds, auditEvent.eventId] };
  await saveAssignment(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { assignment: projectAssignment(withAudit), auditEvent };
}

export async function reactivatePropertyManagerCompanyStaffAssignmentRecord(
  input: AssignmentLifecycleInput,
  options: ServiceOptions = {}
): Promise<{ assignment: PropertyManagerCompanyStaffAssignmentProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = assignmentDb(options.firestore);
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const assignmentId = requireString(input.assignmentId, "missing_assignment_id");
  const now = input.now || new Date().toISOString();

  const actorMembership = await loadMembership(companyId, actorUserId, firestore);
  const assignment = requireAssignmentForCompany(await loadAssignment(assignmentId, firestore), companyId);
  const staffMembership = await loadMembership(
    companyId,
    assignment.staffUserId,
    firestore,
    "property_manager_company_staff_membership_not_found"
  );
  const relationship = requireRelationshipForCompany(await loadRelationship(assignment.relationshipId, firestore), companyId);
  const reactivated = reactivatePropertyManagerCompanyStaffAssignment(assignment, {
    actorMembership,
    staffMembership,
    relationship,
    reactivatedAt: now,
  });
  const auditEvent = buildAssignmentAuditEvent({
    eventType: "staff_assignment_reactivated",
    actorUserId,
    companyId,
    landlordId: relationship.landlordId,
    relationshipId: relationship.relationshipId,
    assignment: reactivated,
    from: assignment.status,
    to: "active",
    outcome: "allowed",
    timestamp: now,
  });
  const withAudit = { ...reactivated, auditEventIds: [...reactivated.auditEventIds, auditEvent.eventId] };
  await saveAssignment(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { assignment: projectAssignment(withAudit), auditEvent };
}

export async function removePropertyManagerCompanyStaffAssignmentRecord(
  input: AssignmentLifecycleInput,
  options: ServiceOptions = {}
): Promise<{ assignment: PropertyManagerCompanyStaffAssignmentProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = assignmentDb(options.firestore);
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const assignmentId = requireString(input.assignmentId, "missing_assignment_id");
  const now = input.now || new Date().toISOString();

  const actorMembership = await loadMembership(companyId, actorUserId, firestore);
  const assignment = requireAssignmentForCompany(await loadAssignment(assignmentId, firestore), companyId);
  const relationship = requireRelationshipForCompany(await loadRelationship(assignment.relationshipId, firestore), companyId);
  const removed = removePropertyManagerCompanyStaffAssignment(assignment, {
    actorMembership,
    removedAt: now,
    reason: input.reason || null,
  });
  const auditEvent = buildAssignmentAuditEvent({
    eventType: "staff_assignment_removed",
    actorUserId,
    companyId,
    landlordId: relationship.landlordId,
    relationshipId: relationship.relationshipId,
    assignment: removed,
    from: assignment.status,
    to: "removed",
    outcome: "removed",
    timestamp: now,
    reason: input.reason || null,
  });
  const withAudit = { ...removed, auditEventIds: [...removed.auditEventIds, auditEvent.eventId] };
  await saveAssignment(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { assignment: projectAssignment(withAudit), auditEvent };
}
