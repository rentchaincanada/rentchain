import crypto from "crypto";
import { db } from "../firebase";
import {
  buildDelegatedAccessAuditEvent,
  createDelegatedAccessGrant,
  createDelegatedAccessInvitation,
  isDelegatedInvitationExpired,
  revokeDelegatedAccessGrant,
  transitionDelegatedInvitationStatus,
  type DelegatedAccessAuditEvent,
  type DelegatedAccessGrant,
  type DelegatedAccessInvitation,
  type DelegatedAccessInvitationStatus,
  type DelegatedAccessPropertyScope,
  type DelegatedAccessResourceScope,
} from "../lib/delegatedAccess";

export const DELEGATED_ACCESS_INVITATIONS_COLLECTION = "delegatedAccessInvitations";
export const DELEGATED_ACCESS_GRANTS_COLLECTION = "delegatedAccessGrants";
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
export type DelegatedGrantProjection = DelegatedAccessGrant;
export type DelegatedDelegateSummary = {
  delegateUserId: string;
  delegateEmail: string | null;
  roles: string[];
  activeGrantCount: number;
  revokedGrantCount: number;
  workspaceScopes: string[];
  propertyScopeSummary: string;
  lastActiveAt: string | null;
};

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

type AcceptInvitationInput = {
  actorUserId: string;
  actorEmail?: string | null;
  token: string;
  now?: string;
};

type RevokeGrantInput = {
  landlordId: string;
  actorUserId: string;
  grantId: string;
  reason?: string | null;
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

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createTokenHash(): string {
  return sha256(crypto.randomBytes(32).toString("hex"));
}

function projectInvitation(invitation: DelegatedAccessInvitation): DelegatedInvitationProjection {
  const { tokenHash: _tokenHash, ...safe } = invitation;
  return safe;
}

function projectGrant(grant: DelegatedAccessGrant): DelegatedGrantProjection {
  return grant;
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

async function createGrant(grant: DelegatedAccessGrant, firestore: DelegatedAccessFirestoreLike) {
  const ref = firestore.collection<DelegatedAccessGrant>(DELEGATED_ACCESS_GRANTS_COLLECTION).doc(grant.grantId);
  if (ref.create) {
    await ref.create(grant);
    return;
  }
  if (!ref.set) throw new Error("delegated_access_grant_write_unavailable");
  await ref.set(grant, { merge: false });
}

async function saveGrant(grant: DelegatedAccessGrant, firestore: DelegatedAccessFirestoreLike) {
  const ref = firestore.collection<DelegatedAccessGrant>(DELEGATED_ACCESS_GRANTS_COLLECTION).doc(grant.grantId);
  if (!ref.set) throw new Error("delegated_access_grant_write_unavailable");
  await ref.set(grant, { merge: false });
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

function grantFromSnapshot(snapshot: SnapshotLike): DelegatedAccessGrant | null {
  const data = snapshot.data();
  if (!data) return null;
  return data as DelegatedAccessGrant;
}

async function listGrantsForLandlord(
  landlordId: string,
  firestore: DelegatedAccessFirestoreLike
): Promise<DelegatedAccessGrant[]> {
  const snapshot = await firestore.collection<DelegatedAccessGrant>(DELEGATED_ACCESS_GRANTS_COLLECTION).get?.();
  return (snapshot?.docs || [])
    .map(grantFromSnapshot)
    .filter((grant): grant is DelegatedAccessGrant => Boolean(grant))
    .filter((grant) => grant.landlordId === landlordId && ["active", "revoked"].includes(grant.status))
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
}

async function loadGrantForLandlord(
  landlordId: string,
  grantId: string,
  firestore: DelegatedAccessFirestoreLike
): Promise<DelegatedAccessGrant | null> {
  const ref = firestore.collection<DelegatedAccessGrant>(DELEGATED_ACCESS_GRANTS_COLLECTION).doc(grantId);
  const snapshot = await ref.get?.();
  if (!snapshot?.exists) return null;
  const grant = grantFromSnapshot(snapshot);
  if (!grant || grant.landlordId !== landlordId) return null;
  return grant;
}

async function loadInvitationByTokenHash(
  tokenHash: string,
  firestore: DelegatedAccessFirestoreLike
): Promise<DelegatedAccessInvitation | null> {
  const snapshot = await firestore.collection<DelegatedAccessInvitation>(DELEGATED_ACCESS_INVITATIONS_COLLECTION).get?.();
  const invitations = (snapshot?.docs || [])
    .map(invitationFromSnapshot)
    .filter((invitation): invitation is DelegatedAccessInvitation => Boolean(invitation));
  return invitations.find((invitation) => timingSafeEqualHex(invitation.tokenHash, tokenHash)) || null;
}

function stableGrantId(invitation: DelegatedAccessInvitation, delegateUserId: string): string {
  const digest = sha256(JSON.stringify([invitation.invitationId, delegateUserId])).slice(0, 24);
  return `delegated_grant_${digest}`;
}

function propertyScopeSummary(grants: DelegatedAccessGrant[]): string {
  const modes = Array.from(new Set(grants.map((grant) => grant.permissionScope.propertyScope.mode))).sort();
  if (modes.includes("all_current_properties")) return "all_current_properties";
  const propertyIds = new Set<string>();
  for (const grant of grants) {
    for (const propertyId of grant.permissionScope.propertyScope.propertyIds || []) {
      propertyIds.add(propertyId);
    }
  }
  if (propertyIds.size > 0) return `selected:${propertyIds.size}`;
  return modes[0] || "none";
}

function summarizeDelegates(grants: DelegatedAccessGrant[]): DelegatedDelegateSummary[] {
  const byDelegate = new Map<string, DelegatedAccessGrant[]>();
  for (const grant of grants) {
    if (!byDelegate.has(grant.delegateUserId)) byDelegate.set(grant.delegateUserId, []);
    byDelegate.get(grant.delegateUserId)!.push(grant);
  }
  return Array.from(byDelegate.entries())
    .map(([delegateUserId, delegateGrants]) => {
      const activeGrants = delegateGrants.filter((grant) => grant.status === "active");
      const revokedGrants = delegateGrants.filter((grant) => grant.status === "revoked");
      const workspaceScopes = Array.from(
        new Set(delegateGrants.flatMap((grant) => grant.permissionScope.workspaceScopes))
      ).sort();
      const roles = Array.from(new Set(delegateGrants.map((grant) => grant.role))).sort();
      const newest = delegateGrants
        .map((grant) => grant.updatedAt || grant.acceptedAt || grant.createdAt)
        .filter(Boolean)
        .sort()
        .at(-1) || null;
      return {
        delegateUserId,
        delegateEmail: delegateGrants.find((grant) => grant.delegateEmail)?.delegateEmail || null,
        roles,
        activeGrantCount: activeGrants.length,
        revokedGrantCount: revokedGrants.length,
        workspaceScopes,
        propertyScopeSummary: propertyScopeSummary(delegateGrants),
        lastActiveAt: newest,
      };
    })
    .sort((a, b) => String(b.lastActiveAt || "").localeCompare(String(a.lastActiveAt || "")));
}

export async function listDelegatedAccessGrantRecords(
  input: { landlordId: string },
  options: ServiceOptions = {}
): Promise<{ grants: DelegatedGrantProjection[] }> {
  const firestore = delegatedDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const grants = await listGrantsForLandlord(landlordId, firestore);
  return { grants: grants.map(projectGrant) };
}

export async function listDelegatedAccessDelegateRecords(
  input: { landlordId: string },
  options: ServiceOptions = {}
): Promise<{ delegates: DelegatedDelegateSummary[] }> {
  const firestore = delegatedDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const grants = await listGrantsForLandlord(landlordId, firestore);
  return { delegates: summarizeDelegates(grants) };
}

export async function acceptDelegatedAccessInvitationRecord(
  input: AcceptInvitationInput,
  options: ServiceOptions = {}
): Promise<{
  invitation: DelegatedInvitationProjection;
  grant: DelegatedGrantProjection;
  auditEvent: DelegatedAccessAuditEvent;
}> {
  const firestore = delegatedDb(options.firestore);
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const rawToken = requireString(input.token, "missing_invitation_token", 2000);
  const now = input.now || new Date().toISOString();
  const tokenHash = sha256(rawToken);
  const invitation = await loadInvitationByTokenHash(tokenHash, firestore);
  if (!invitation) throw new Error("invalid_invitation_token");
  if (invitation.status !== "pending") throw new Error("invitation_not_pending");
  if (isDelegatedInvitationExpired(invitation, now)) throw new Error("invitation_expired");

  const accepted = transitionDelegatedInvitationStatus(invitation, "accepted", {
    acceptedByUserId: actorUserId,
    timestamp: now,
  });
  const grant = createDelegatedAccessGrant({
    grantId: stableGrantId(invitation, actorUserId),
    landlordId: invitation.landlordId,
    delegateUserId: actorUserId,
    delegateEmail: input.actorEmail || invitation.inviteeEmail,
    role: invitation.role,
    propertyScope: invitation.propertyScope,
    workspaceScopes: invitation.workspaceScopes,
    resourceScope: invitation.resourceScope,
    permissionFlags: invitation.permissionFlags,
    createdByUserId: invitation.createdByUserId,
    createdAt: now,
    acceptedAt: now,
  });
  const auditEvent = buildDelegatedAccessAuditEvent({
    eventType: "delegated_invite_accepted",
    actorUserId,
    actingForLandlordId: invitation.landlordId,
    delegatedRole: invitation.role,
    permissionScope: grant.permissionScope,
    actionType: "invite_accepted",
    targetResourceType: "delegate_invitation",
    targetResourceId: invitation.invitationId,
    timestamp: now,
    outcome: "allowed",
    before: { status: invitation.status },
    after: {
      status: accepted.status,
      grantId: grant.grantId,
      role: grant.role,
      workspaceScopes: grant.permissionScope.workspaceScopes,
      propertyScopeMode: grant.permissionScope.propertyScope.mode,
    },
  });
  const grantWithAudit = { ...grant, auditEventIds: [auditEvent.eventId] };
  const invitationWithAudit = { ...accepted, auditEventIds: [...accepted.auditEventIds, auditEvent.eventId] };
  await createGrant(grantWithAudit, firestore);
  await saveInvitation(invitationWithAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return {
    invitation: projectInvitation(invitationWithAudit),
    grant: projectGrant(grantWithAudit),
    auditEvent,
  };
}

export async function revokeDelegatedAccessGrantRecord(
  input: RevokeGrantInput,
  options: ServiceOptions = {}
): Promise<{ grant: DelegatedGrantProjection; auditEvent: DelegatedAccessAuditEvent }> {
  const firestore = delegatedDb(options.firestore);
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const actorUserId = requireString(input.actorUserId, "missing_actor_user_id");
  const grantId = requireString(input.grantId, "missing_grant_id");
  const grant = await loadGrantForLandlord(landlordId, grantId, firestore);
  if (!grant) throw new Error("delegated_grant_not_found");
  const now = input.now || new Date().toISOString();
  const revoked = revokeDelegatedAccessGrant(grant, {
    revokedByUserId: actorUserId,
    revokedAt: now,
    reason: input.reason || null,
  });
  const auditEvent = buildDelegatedAccessAuditEvent({
    eventType: "delegated_access_revoked",
    actorUserId,
    actingForLandlordId: landlordId,
    delegatedRole: "landlord_owner",
    permissionScope: grant.permissionScope,
    actionType: "grant_revoked",
    targetResourceType: "delegate_grant",
    targetResourceId: grant.grantId,
    timestamp: now,
    outcome: "revoked",
    before: { status: grant.status },
    after: {
      status: revoked.status,
      delegateUserId: revoked.delegateUserId,
      role: revoked.role,
      workspaceScopes: revoked.permissionScope.workspaceScopes,
      propertyScopeMode: revoked.permissionScope.propertyScope.mode,
      revokedAt: revoked.revokedAt,
      reason: revoked.revocationReason,
    },
  });
  const withAudit = { ...revoked, auditEventIds: [...revoked.auditEventIds, auditEvent.eventId] };
  await saveGrant(withAudit, firestore);
  await appendAuditEvent(auditEvent, firestore);
  return { grant: projectGrant(withAudit), auditEvent };
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
