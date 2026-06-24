import { db } from "../firebase";
import {
  activateLandlordCompanyRelationship,
  buildPropertyManagerCompanyAuditEvent,
  buildRelationshipScope,
  createLandlordCompanyRelationship,
  reactivateLandlordCompanyRelationship,
  suspendLandlordCompanyRelationship,
  terminateLandlordCompanyRelationship,
  type LandlordCompanyRelationship,
  type LandlordCompanyRelationshipStatus,
  type PropertyManagerCompany,
  type PropertyManagerCompanyAuditEvent,
  type PropertyManagerCompanyAuditOutcome,
  type PropertyManagerCompanyMembership,
  type PropertyManagerCompanyPropertyScope,
} from "../lib/propertyManagerCompany";

export const PROPERTY_MANAGER_COMPANIES_COLLECTION = "propertyManagerCompanies";
export const PROPERTY_MANAGER_COMPANY_MEMBERSHIPS_COLLECTION = "propertyManagerCompanyMemberships";
export const LANDLORD_COMPANY_RELATIONSHIPS_COLLECTION = "landlordCompanyRelationships";
export const PROPERTY_MANAGER_COMPANY_AUDIT_EVENTS_COLLECTION = "propertyManagerCompanyAuditEvents";

type SnapshotLike = {
  id?: string;
  exists?: boolean;
  data: () => Record<string, unknown> | undefined;
};

type DocumentRefLike<T> = {
  id?: string;
  get?: () => Promise<SnapshotLike>;
  set?: (data: T, options?: { merge?: boolean }) => Promise<unknown>;
  create?: (data: T) => Promise<unknown>;
};

type CollectionLike<T> = {
  doc: (id?: string) => DocumentRefLike<T>;
  get?: () => Promise<{ docs: SnapshotLike[] }>;
};

export type PropertyManagerCompanyRelationshipFirestoreLike = {
  collection: <T = Record<string, unknown>>(name: string) => CollectionLike<T>;
};

type CreateRelationshipInput = {
  landlordId: string;
  actorUserId: string;
  propertyManagerCompanyId: string;
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: string[];
  requestedStatus?: unknown;
  now?: string;
};

type LifecycleInput = {
  landlordId: string;
  actorUserId: string;
  relationshipId: string;
  reason?: string | null;
  now?: string;
};

type AcceptRelationshipInput = {
  actorUserId: string;
  companyId: string;
  relationshipId: string;
  now?: string;
};

type ServiceOptions = {
  firestore?: PropertyManagerCompanyRelationshipFirestoreLike;
};

export type LandlordCompanyRelationshipProjection = Omit<LandlordCompanyRelationship, "auditEventIds"> & {
  propertyManagerCompanyLabel: string;
};

function relationshipDb(
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

function companyFromSnapshot(snapshot: SnapshotLike): PropertyManagerCompany | null {
  const data = snapshot.data();
  if (!data) return null;
  return data as PropertyManagerCompany;
}

function membershipFromSnapshot(snapshot: SnapshotLike): PropertyManagerCompanyMembership | null {
  const data = snapshot.data();
  if (!data) return null;
  return data as PropertyManagerCompanyMembership;
}

function safeCompanyLabel(company: PropertyManagerCompany | null, propertyManagerCompanyId: string): string {
  const label = cleanString(company?.safeDisplayLabel || company?.companyName, 160).replace(/\s+/g, " ");
  if (!label || label === propertyManagerCompanyId) return "Property manager company";
  return label;
}

async function loadCompany(
  propertyManagerCompanyId: string,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<PropertyManagerCompany | null> {
  const ref = firestore
    .collection<PropertyManagerCompany>(PROPERTY_MANAGER_COMPANIES_COLLECTION)
    .doc(propertyManagerCompanyId);
  const snapshot = await ref.get?.();
  if (!snapshot?.exists) return null;
  return companyFromSnapshot(snapshot);
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

async function requireActiveCompany(
  propertyManagerCompanyId: string,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<PropertyManagerCompany> {
  const company = await loadCompany(propertyManagerCompanyId, firestore);
  if (!company) throw new Error("property_manager_company_not_found");
  if (company.status !== "active") throw new Error("property_manager_company_not_active");
  return company;
}

async function requireCompanyAcceptanceMembership(
  companyId: string,
  actorUserId: string,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<PropertyManagerCompanyMembership> {
  const snapshot = await firestore.collection<PropertyManagerCompanyMembership>(PROPERTY_MANAGER_COMPANY_MEMBERSHIPS_COLLECTION).get?.();
  const membership = (snapshot?.docs || [])
    .map(membershipFromSnapshot)
    .find((candidate): candidate is PropertyManagerCompanyMembership => {
      return Boolean(candidate && candidate.companyId === companyId && candidate.userId === actorUserId);
    });
  if (!membership) throw new Error("property_manager_company_membership_not_found");
  if (membership.companyId !== companyId || membership.userId !== actorUserId) {
    throw new Error("property_manager_company_membership_mismatch");
  }
  if (membership.status !== "active") throw new Error("property_manager_company_membership_not_active");
  if (!["company_owner", "company_admin"].includes(membership.role)) {
    throw new Error("property_manager_company_acceptance_role_not_allowed");
  }
  return membership;
}

function assertRelationshipScopeValid(relationship: LandlordCompanyRelationship) {
  buildRelationshipScope({
    propertyScope: relationship.relationshipScope?.propertyScope as PropertyManagerCompanyPropertyScope,
    workspaceScopes: relationship.relationshipScope?.workspaceScopes || [],
  });
}

async function projectRelationship(
  relationship: LandlordCompanyRelationship,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<LandlordCompanyRelationshipProjection> {
  const { auditEventIds: _auditEventIds, ...safe } = relationship;
  const company = await loadCompany(relationship.propertyManagerCompanyId, firestore);
  return {
    ...safe,
    propertyManagerCompanyLabel: safeCompanyLabel(company, relationship.propertyManagerCompanyId),
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

async function saveRelationship(
  relationship: LandlordCompanyRelationship,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
) {
  const ref = firestore
    .collection<LandlordCompanyRelationship>(LANDLORD_COMPANY_RELATIONSHIPS_COLLECTION)
    .doc(relationship.relationshipId);
  if (!ref.set) throw new Error("landlord_company_relationship_write_unavailable");
  await ref.set(relationship, { merge: false });
}

async function loadRelationshipForLandlord(
  landlordId: string,
  relationshipId: string,
  firestore: PropertyManagerCompanyRelationshipFirestoreLike
): Promise<LandlordCompanyRelationship | null> {
  const ref = firestore
    .collection<LandlordCompanyRelationship>(LANDLORD_COMPANY_RELATIONSHIPS_COLLECTION)
    .doc(relationshipId);
  const snapshot = await ref.get?.();
  if (!snapshot?.exists) return null;
  const relationship = relationshipFromSnapshot(snapshot);
  if (!relationship || relationship.landlordId !== landlordId) return null;
  return relationship;
}

function buildRelationshipAuditEvent(input: {
  eventType:
    | "landlord_company_relationship_created"
    | "landlord_company_relationship_activated"
    | "landlord_company_relationship_suspended"
    | "landlord_company_relationship_reactivated"
    | "landlord_company_relationship_terminated";
  actorUserId: string;
  propertyManagerCompanyId: string;
  landlordId: string;
  relationshipId: string;
  relationshipScope: LandlordCompanyRelationship["relationshipScope"];
  from: LandlordCompanyRelationshipStatus | null;
  to: LandlordCompanyRelationshipStatus;
  outcome: PropertyManagerCompanyAuditOutcome;
  timestamp: string;
  reason?: string | null;
  actorCompanyId?: string | null;
  role?: PropertyManagerCompanyMembership["role"] | null;
}): PropertyManagerCompanyAuditEvent {
  return buildPropertyManagerCompanyAuditEvent({
    eventType: input.eventType,
    actorUserId: input.actorUserId,
    actorCompanyId: input.actorCompanyId || null,
    propertyManagerCompanyId: input.propertyManagerCompanyId,
    actingForLandlordId: input.landlordId,
    relationshipId: input.relationshipId,
    role: input.role || null,
    scope: input.relationshipScope,
    targetResourceType: "landlord_company_relationship",
    targetResourceId: input.relationshipId,
    outcome: input.outcome,
    timestamp: input.timestamp,
    reason: input.reason || null,
    statusTransition: {
      from: input.from,
      to: input.to,
    },
  });
}

export async function listLandlordCompanyRelationshipRecords(
  input: { landlordId: string },
  options: ServiceOptions = {}
): Promise<{ relationships: LandlordCompanyRelationshipProjection[] }> {
  const firestore = relationshipDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const snapshot = await firestore.collection<LandlordCompanyRelationship>(LANDLORD_COMPANY_RELATIONSHIPS_COLLECTION).get?.();
  const relationships = (snapshot?.docs || [])
    .map(relationshipFromSnapshot)
    .filter((relationship): relationship is LandlordCompanyRelationship => Boolean(relationship))
    .filter((relationship) => relationship.landlordId === landlordId)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return {
    relationships: await Promise.all(relationships.map((relationship) => projectRelationship(relationship, firestore))),
  };
}

export async function createLandlordCompanyRelationshipRecord(
  input: CreateRelationshipInput,
  options: ServiceOptions = {}
): Promise<{ relationship: LandlordCompanyRelationshipProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = relationshipDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const propertyManagerCompanyId = requireString(input.propertyManagerCompanyId, "missing_property_manager_company_id");
  const requestedStatus = cleanString(input.requestedStatus, 80).toLowerCase();
  if (requestedStatus && requestedStatus !== "pending") {
    throw new Error("relationship_activation_requires_company_acceptance");
  }
  const company = await requireActiveCompany(propertyManagerCompanyId, firestore);
  const now = input.now || new Date().toISOString();
  const relationship = createLandlordCompanyRelationship({
    landlordId,
    propertyManagerCompanyId: company.companyId,
    propertyScope: input.propertyScope,
    workspaceScopes: input.workspaceScopes,
    createdByLandlordOwnerUserId: actorUserId,
    status: "pending",
    createdAt: now,
  });
  const auditEvent = buildRelationshipAuditEvent({
    eventType: "landlord_company_relationship_created",
    actorUserId,
    propertyManagerCompanyId: relationship.propertyManagerCompanyId,
    landlordId,
    relationshipId: relationship.relationshipId,
    relationshipScope: relationship.relationshipScope,
    from: null,
    to: "pending",
    outcome: "created",
    timestamp: now,
  });
  const withAudit = { ...relationship, auditEventIds: [auditEvent.eventId] };
  await saveRelationship(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return {
    relationship: {
      ...(await projectRelationship(withAudit, firestore)),
      propertyManagerCompanyLabel: safeCompanyLabel(company, relationship.propertyManagerCompanyId),
    },
    auditEvent,
  };
}

export async function suspendLandlordCompanyRelationshipRecord(
  input: LifecycleInput,
  options: ServiceOptions = {}
): Promise<{ relationship: LandlordCompanyRelationshipProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = relationshipDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const relationshipId = requireString(input.relationshipId, "missing_relationship_id");
  const relationship = await loadRelationshipForLandlord(landlordId, relationshipId, firestore);
  if (!relationship) throw new Error("landlord_company_relationship_not_found");
  const now = input.now || new Date().toISOString();
  const suspended = suspendLandlordCompanyRelationship(relationship, { suspendedByUserId: actorUserId, suspendedAt: now });
  const auditEvent = buildRelationshipAuditEvent({
    eventType: "landlord_company_relationship_suspended",
    actorUserId,
    propertyManagerCompanyId: suspended.propertyManagerCompanyId,
    landlordId,
    relationshipId: suspended.relationshipId,
    relationshipScope: suspended.relationshipScope,
    from: relationship.status,
    to: "suspended",
    outcome: "suspended",
    timestamp: now,
    reason: input.reason || null,
  });
  const withAudit = { ...suspended, auditEventIds: [...suspended.auditEventIds, auditEvent.eventId] };
  await saveRelationship(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { relationship: await projectRelationship(withAudit, firestore), auditEvent };
}

export async function acceptLandlordCompanyRelationshipRecord(
  input: AcceptRelationshipInput,
  options: ServiceOptions = {}
): Promise<{ relationship: LandlordCompanyRelationshipProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = relationshipDb(options.firestore);
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const companyId = requireString(input.companyId, "missing_property_manager_company_id");
  const relationshipId = requireString(input.relationshipId, "missing_relationship_id");
  const now = input.now || new Date().toISOString();

  await requireActiveCompany(companyId, firestore);
  const membership = await requireCompanyAcceptanceMembership(companyId, actorUserId, firestore);
  const relationship = await loadRelationship(relationshipId, firestore);
  if (!relationship || relationship.propertyManagerCompanyId !== companyId) {
    throw new Error("landlord_company_relationship_not_found");
  }
  if (relationship.status !== "pending") throw new Error("relationship_not_pending");
  assertRelationshipScopeValid(relationship);

  const activated = activateLandlordCompanyRelationship(relationship, {
    acceptedByCompanyAdminUserId: actorUserId,
    startedAt: now,
  });
  const auditEvent = buildRelationshipAuditEvent({
    eventType: "landlord_company_relationship_activated",
    actorUserId,
    actorCompanyId: companyId,
    propertyManagerCompanyId: activated.propertyManagerCompanyId,
    landlordId: activated.landlordId,
    relationshipId: activated.relationshipId,
    relationshipScope: activated.relationshipScope,
    from: "pending",
    to: "active",
    outcome: "allowed",
    timestamp: now,
    role: membership.role,
  });
  const withAudit = { ...activated, auditEventIds: [...activated.auditEventIds, auditEvent.eventId] };
  await saveRelationship(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { relationship: await projectRelationship(withAudit, firestore), auditEvent };
}

export async function reactivateLandlordCompanyRelationshipRecord(
  input: LifecycleInput,
  options: ServiceOptions = {}
): Promise<{ relationship: LandlordCompanyRelationshipProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = relationshipDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const relationshipId = requireString(input.relationshipId, "missing_relationship_id");
  const relationship = await loadRelationshipForLandlord(landlordId, relationshipId, firestore);
  if (!relationship) throw new Error("landlord_company_relationship_not_found");
  await requireActiveCompany(relationship.propertyManagerCompanyId, firestore);
  const now = input.now || new Date().toISOString();
  const reactivated = reactivateLandlordCompanyRelationship(relationship, { reactivatedAt: now });
  const auditEvent = buildRelationshipAuditEvent({
    eventType: "landlord_company_relationship_reactivated",
    actorUserId,
    propertyManagerCompanyId: reactivated.propertyManagerCompanyId,
    landlordId,
    relationshipId: reactivated.relationshipId,
    relationshipScope: reactivated.relationshipScope,
    from: relationship.status,
    to: "active",
    outcome: "allowed",
    timestamp: now,
    reason: input.reason || null,
  });
  const withAudit = { ...reactivated, auditEventIds: [...reactivated.auditEventIds, auditEvent.eventId] };
  await saveRelationship(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { relationship: await projectRelationship(withAudit, firestore), auditEvent };
}

export async function terminateLandlordCompanyRelationshipRecord(
  input: LifecycleInput,
  options: ServiceOptions = {}
): Promise<{ relationship: LandlordCompanyRelationshipProjection; auditEvent: PropertyManagerCompanyAuditEvent }> {
  const firestore = relationshipDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const relationshipId = requireString(input.relationshipId, "missing_relationship_id");
  const relationship = await loadRelationshipForLandlord(landlordId, relationshipId, firestore);
  if (!relationship) throw new Error("landlord_company_relationship_not_found");
  if (!["pending", "active", "suspended"].includes(relationship.status)) {
    throw new Error("invalid_relationship_status_transition");
  }
  const now = input.now || new Date().toISOString();
  const terminated = terminateLandlordCompanyRelationship(relationship, {
    terminatedByUserId: actorUserId,
    terminatedAt: now,
    reason: input.reason || null,
  });
  const auditEvent = buildRelationshipAuditEvent({
    eventType: "landlord_company_relationship_terminated",
    actorUserId,
    propertyManagerCompanyId: terminated.propertyManagerCompanyId,
    landlordId,
    relationshipId: terminated.relationshipId,
    relationshipScope: terminated.relationshipScope,
    from: relationship.status,
    to: "terminated",
    outcome: "terminated",
    timestamp: now,
    reason: input.reason || null,
  });
  const withAudit = { ...terminated, auditEventIds: [...terminated.auditEventIds, auditEvent.eventId] };
  await saveRelationship(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { relationship: await projectRelationship(withAudit, firestore), auditEvent };
}
