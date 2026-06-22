import crypto from "crypto";
import { db } from "../firebase";
import {
  buildDelegatedAccessAuditEvent,
  createDelegatedAccessInvitation,
  isDelegatedInvitationExpired,
  transitionDelegatedInvitationStatus,
  type DelegatedAccessAuditEvent,
  type DelegatedAccessInvitation,
  type DelegatedAccessInvitationStatus,
  type DelegatedAccessPropertyScope,
  type DelegatedAccessResourceScope,
} from "../lib/delegatedAccess";

export const DELEGATED_ACCESS_INVITATIONS_COLLECTION = "delegatedAccessInvitations";
export const DELEGATED_ACCESS_AUDIT_EVENTS_COLLECTION = "delegatedAccessAuditEvents";

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

export type DelegatedAccessFirestoreLike = {
  collection: <T = Record<string, unknown>>(name: string) => CollectionLike<T>;
};

export type DelegatedInvitationProjection = Omit<DelegatedAccessInvitation, "tokenHash">;

type CreateInvitationInput = {
  landlordId: string;
  actorUserId: string;
  inviteeEmail: string;
  role: string;
  propertyScope: DelegatedAccessPropertyScope;
  workspaceScopes: string[];
  resourceScope?: DelegatedAccessResourceScope;
  permissionFlags: string[];
  expiresAt: string;
  now?: string;
};

type ServiceOptions = {
  firestore?: DelegatedAccessFirestoreLike;
};

function delegatedDb(firestore?: DelegatedAccessFirestoreLike): DelegatedAccessFirestoreLike {
  return firestore || (db as unknown as DelegatedAccessFirestoreLike);
}

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireString(value: unknown, code: string, max = 500): string {
  const text = cleanString(value, max);
  if (!text) throw new Error(code);
  return text;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createTokenHash(): string {
  return sha256(crypto.randomBytes(32).toString("hex"));
}

function projectInvitation(invitation: DelegatedAccessInvitation): DelegatedInvitationProjection {
  const { tokenHash: _tokenHash, ...safe } = invitation;
  return safe;
}

function invitationFromSnapshot(snapshot: SnapshotLike): DelegatedAccessInvitation | null {
  const data = snapshot.data();
  if (!data) return null;
  return data as DelegatedAccessInvitation;
}

async function appendAuditEvent(event: DelegatedAccessAuditEvent, firestore: DelegatedAccessFirestoreLike) {
  const ref = firestore.collection<DelegatedAccessAuditEvent>(DELEGATED_ACCESS_AUDIT_EVENTS_COLLECTION).doc(event.eventId);
  if (ref.create) {
    await ref.create(event);
    return;
  }
  if (!ref.set) throw new Error("delegated_access_audit_append_unavailable");
  await ref.set(event, { merge: false });
}

async function saveInvitation(invitation: DelegatedAccessInvitation, firestore: DelegatedAccessFirestoreLike) {
  const ref = firestore
    .collection<DelegatedAccessInvitation>(DELEGATED_ACCESS_INVITATIONS_COLLECTION)
    .doc(invitation.invitationId);
  if (!ref.set) throw new Error("delegated_access_invitation_write_unavailable");
  await ref.set(invitation, { merge: false });
}

export async function createDelegatedAccessInvitationRecord(
  input: CreateInvitationInput,
  options: ServiceOptions = {}
): Promise<{ invitation: DelegatedInvitationProjection; auditEvent: DelegatedAccessAuditEvent }> {
  const firestore = delegatedDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const now = input.now || new Date().toISOString();
  const invitation = createDelegatedAccessInvitation({
    landlordId,
    inviteeEmail: input.inviteeEmail,
    role: input.role,
    propertyScope: input.propertyScope,
    workspaceScopes: input.workspaceScopes,
    resourceScope: input.resourceScope,
    permissionFlags: input.permissionFlags,
    tokenHash: createTokenHash(),
    expiresAt: input.expiresAt,
    createdByUserId: actorUserId,
    createdAt: now,
  });
  const auditEvent = buildDelegatedAccessAuditEvent({
    eventType: "delegated_invite_created",
    actorUserId,
    actingForLandlordId: landlordId,
    delegatedRole: "landlord_owner",
    permissionScope: {
      role: invitation.role,
      workspaceScopes: invitation.workspaceScopes,
      propertyScope: invitation.propertyScope,
      resourceScope: invitation.resourceScope,
      permissionFlags: invitation.permissionFlags,
      billingAccess: false,
      exportAccess: invitation.permissionFlags.includes("export"),
    },
    actionType: "invite_created",
    targetResourceType: "delegate_invitation",
    targetResourceId: invitation.invitationId,
    timestamp: now,
    outcome: "allowed",
    after: {
      status: invitation.status,
      role: invitation.role,
      workspaceScopes: invitation.workspaceScopes,
      propertyScopeMode: invitation.propertyScope.mode,
      expiresAt: invitation.expiresAt,
    },
  });
  const withAudit: DelegatedAccessInvitation = {
    ...invitation,
    auditEventIds: [auditEvent.eventId],
  };
  await saveInvitation(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { invitation: projectInvitation(withAudit), auditEvent };
}

export async function listDelegatedAccessInvitationRecords(
  input: { landlordId: string; now?: string },
  options: ServiceOptions = {}
): Promise<{ invitations: DelegatedInvitationProjection[]; expiredInvitationIds: string[] }> {
  const firestore = delegatedDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const snapshot = await firestore.collection<DelegatedAccessInvitation>(DELEGATED_ACCESS_INVITATIONS_COLLECTION).get?.();
  const invitations = (snapshot?.docs || [])
    .map(invitationFromSnapshot)
    .filter((invitation): invitation is DelegatedAccessInvitation => Boolean(invitation))
    .filter((invitation) => invitation.landlordId === landlordId)
    .map((invitation) => {
      if (isDelegatedInvitationExpired(invitation, input.now || new Date())) {
        return { ...invitation, status: "expired" as DelegatedAccessInvitationStatus };
      }
      return invitation;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    invitations: invitations.map(projectInvitation),
    expiredInvitationIds: invitations.filter((invitation) => invitation.status === "expired").map((i) => i.invitationId),
  };
}

async function loadInvitationForLandlord(
  landlordId: string,
  invitationId: string,
  firestore: DelegatedAccessFirestoreLike
): Promise<DelegatedAccessInvitation | null> {
  const ref = firestore.collection<DelegatedAccessInvitation>(DELEGATED_ACCESS_INVITATIONS_COLLECTION).doc(invitationId);
  const snapshot = await ref.get?.();
  if (!snapshot?.exists) return null;
  const invitation = invitationFromSnapshot(snapshot);
  if (!invitation || invitation.landlordId !== landlordId) return null;
  return invitation;
}

export async function cancelDelegatedAccessInvitationRecord(
  input: { landlordId: string; actorUserId: string; invitationId: string; now?: string },
  options: ServiceOptions = {}
): Promise<{ invitation: DelegatedInvitationProjection; auditEvent: DelegatedAccessAuditEvent }> {
  const firestore = delegatedDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const invitationId = requireString(input.invitationId, "missing_invitation_id");
  const invitation = await loadInvitationForLandlord(landlordId, invitationId, firestore);
  if (!invitation) throw new Error("delegated_invitation_not_found");
  const now = input.now || new Date().toISOString();
  const cancelled = transitionDelegatedInvitationStatus(invitation, "cancelled", {
    actorUserId,
    timestamp: now,
  });
  const auditEvent = buildDelegatedAccessAuditEvent({
    eventType: "delegated_invite_cancelled",
    actorUserId,
    actingForLandlordId: landlordId,
    delegatedRole: "landlord_owner",
    permissionScope: null,
    actionType: "invite_cancelled",
    targetResourceType: "delegate_invitation",
    targetResourceId: cancelled.invitationId,
    timestamp: now,
    outcome: "allowed",
    before: { status: invitation.status },
    after: { status: cancelled.status },
  });
  const withAudit = { ...cancelled, auditEventIds: [...cancelled.auditEventIds, auditEvent.eventId] };
  await saveInvitation(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { invitation: projectInvitation(withAudit), auditEvent };
}

export async function expireDelegatedAccessInvitationRecord(
  input: { landlordId: string; actorUserId: string; invitationId: string; now?: string },
  options: ServiceOptions = {}
): Promise<{ invitation: DelegatedInvitationProjection; auditEvent: DelegatedAccessAuditEvent | null; changed: boolean }> {
  const firestore = delegatedDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const invitationId = requireString(input.invitationId, "missing_invitation_id");
  const invitation = await loadInvitationForLandlord(landlordId, invitationId, firestore);
  if (!invitation) throw new Error("delegated_invitation_not_found");
  const now = input.now || new Date().toISOString();
  if (!isDelegatedInvitationExpired(invitation, now)) {
    return { invitation: projectInvitation(invitation), auditEvent: null, changed: false };
  }
  const expired = transitionDelegatedInvitationStatus(invitation, "expired", { timestamp: now });
  const auditEvent = buildDelegatedAccessAuditEvent({
    eventType: "delegated_invite_expired",
    actorUserId,
    actingForLandlordId: landlordId,
    delegatedRole: "landlord_owner",
    permissionScope: null,
    actionType: "invite_expired",
    targetResourceType: "delegate_invitation",
    targetResourceId: expired.invitationId,
    timestamp: now,
    outcome: "expired",
    before: { status: invitation.status },
    after: { status: expired.status },
  });
  const withAudit = { ...expired, auditEventIds: [...expired.auditEventIds, auditEvent.eventId] };
  await saveInvitation(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { invitation: projectInvitation(withAudit), auditEvent, changed: true };
}
