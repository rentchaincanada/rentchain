import crypto from "crypto";
import { SHARING_ROOM_REDACTIONS, sharingRoomSafetyFlags } from "./sharingRoomPolicyGuards";
import type {
  InstitutionalSharingRoom,
  SharingAccessControl,
  SharingAccessStatus,
  SharingInstitutionType,
  SharingRoomCreateRequest,
  SharingRoomEventType,
  SharingRoomStatus,
  SharingRoomType,
  SharingScopeKind,
  SharingScopeReference,
} from "./sharingRoomTypes";

const ROOM_TYPES = new Set<SharingRoomType>([
  "lender_review",
  "insurer_review",
  "auditor_review",
  "regulator_review",
  "operational_partner_review",
]);

const INSTITUTION_TYPES = new Set<SharingInstitutionType>(["lender", "insurer", "auditor", "regulator", "partner"]);

const SCOPE_KINDS = new Set<SharingScopeKind>([
  "evidence_pack",
  "institution_export",
  "review_timeline",
  "audit_compliance",
  "identity_lineage",
  "operator_review",
  "workflow",
]);

function asString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanId(value: unknown) {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toIsoDate(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function defaultExpiresAt(now: string) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + 14);
  return date.toISOString();
}

function scopeDestination(scopeKey: SharingScopeKind, scopeId: string): string | null {
  const encoded = encodeURIComponent(scopeId);
  if (scopeKey === "evidence_pack") return `/evidence-packs?scope=decision&scopeId=${encoded}`;
  if (scopeKey === "institution_export") return "/institution-exports";
  if (scopeKey === "review_timeline") return `/review-timeline?scope=decision&scopeId=${encoded}`;
  if (scopeKey === "audit_compliance") return "/audit-compliance";
  if (scopeKey === "identity_lineage") return `/identity-layer?identityId=${encoded}`;
  if (scopeKey === "operator_review") return `/review-timeline?scope=operator_review&scopeId=${encoded}`;
  if (scopeKey === "workflow") return "/decision-inbox";
  return null;
}

function labelScope(scopeKey: SharingScopeKind, scopeId: string) {
  return `${scopeKey.replace(/_/g, " ")} ${scopeId}`.trim();
}

export function parseSharingRoomCreateRequest(body: unknown): SharingRoomCreateRequest | null {
  const data = (body || {}) as Record<string, any>;
  const roomType = asString(data.roomType, 80) as SharingRoomType;
  const institutionType = asString(data.institutionType, 80) as SharingInstitutionType;
  const redactionLevel = asString(data.redactionLevel, 40) === "standard" ? "standard" : "strict";
  if (!ROOM_TYPES.has(roomType) || !INSTITUTION_TYPES.has(institutionType)) return null;
  const sharedScopes = Array.isArray(data.sharedScopes)
    ? data.sharedScopes
        .map((item: any) => {
          const scopeKey = asString(item?.scopeKey, 80) as SharingScopeKind;
          const scopeId = asString(item?.scopeId, 500);
          if (!SCOPE_KINDS.has(scopeKey) || !scopeId) return null;
          return {
            scopeKey,
            scopeId,
            label: asString(item?.label, 160) || null,
          };
        })
        .filter(Boolean)
        .slice(0, 12)
    : [];
  if (!sharedScopes.length) return null;
  return {
    roomType,
    institutionType,
    redactionLevel,
    expiresAt: toIsoDate(data.expiresAt),
    sharedScopes: sharedScopes as SharingRoomCreateRequest["sharedScopes"],
  };
}

export function buildSharingRoomId(input: { landlordId: string; roomType: SharingRoomType; createdAt: string; sharedScopes: unknown }) {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ landlordId: input.landlordId, roomType: input.roomType, createdAt: input.createdAt, sharedScopes: input.sharedScopes }))
    .digest("hex")
    .slice(0, 16);
  return cleanId(`institutional_sharing_room:${input.landlordId}:${input.roomType}:${hash}`);
}

function accessControl(input: {
  sharingRoomId: string;
  institutionType: SharingInstitutionType;
  redactionLevel: "strict" | "standard";
  allowedScopes: SharingScopeKind[];
  expiresAt: string | null;
  status?: SharingAccessStatus;
}): SharingAccessControl {
  return {
    accessControlId: cleanId(`${input.sharingRoomId}:access:view_only`),
    accessType: "view_only",
    institutionType: input.institutionType,
    status: input.status || "pending_review",
    manualApprovalRequired: true,
    publicAccess: false,
    downloadEnabled: false,
    externalSubmissionEnabled: false,
    allowedScopes: Array.from(new Set(input.allowedScopes)),
    redactionLevel: input.redactionLevel,
    expiresAt: input.expiresAt,
  };
}

function deriveStatus(input: {
  status?: unknown;
  accessStatus: SharingAccessStatus;
  expiresAt: string | null;
  now: string;
  sharedScopes: SharingScopeReference[];
}): SharingRoomStatus {
  const existing = asString(input.status, 80) as SharingRoomStatus;
  if (existing === "blocked") return "blocked";
  if (!input.sharedScopes.length || input.sharedScopes.some((scope) => scope.status === "blocked")) return "blocked";
  const expiresAt = input.expiresAt ? new Date(input.expiresAt).getTime() : null;
  if (input.accessStatus === "revoked" || input.accessStatus === "expired") return "expired";
  if (expiresAt && expiresAt <= new Date(input.now).getTime()) return "expired";
  if (input.accessStatus === "active") return "active";
  return "review_required";
}

function normalizeScopeReference(raw: unknown): SharingScopeReference | null {
  const data = (raw || {}) as Record<string, unknown>;
  const scopeKey = asString(data.scopeKey, 80) as SharingScopeKind;
  const scopeId = asString(data.scopeId, 500);
  if (!SCOPE_KINDS.has(scopeKey) || !scopeId) return null;
  const destination = asString(data.destination, 500) || scopeDestination(scopeKey, scopeId);
  return {
    scopeKey,
    scopeId,
    label: asString(data.label, 160) || labelScope(scopeKey, scopeId),
    status: asString(data.status, 80) === "blocked" ? "blocked" : asString(data.status, 80) === "missing" ? "missing" : "available",
    destination,
    blockedReason: asString(data.blockedReason, 500) || null,
  };
}

export function buildInstitutionalSharingRoom(input: {
  landlordId: string;
  request: SharingRoomCreateRequest;
  actor: InstitutionalSharingRoom["createdBy"];
  now?: string;
}): InstitutionalSharingRoom {
  const createdAt = toIsoDate(input.now) || new Date().toISOString();
  const expiresAt = input.request.expiresAt || defaultExpiresAt(createdAt);
  const sharedScopes = input.request.sharedScopes
    .map((scope) =>
      normalizeScopeReference({
        ...scope,
        label: scope.label || labelScope(scope.scopeKey, scope.scopeId),
      })
    )
    .filter(Boolean) as SharingScopeReference[];
  const sharingRoomId = buildSharingRoomId({
    landlordId: input.landlordId,
    roomType: input.request.roomType,
    createdAt,
    sharedScopes,
  });
  const accessControls = accessControl({
    sharingRoomId,
    institutionType: input.request.institutionType,
    redactionLevel: input.request.redactionLevel,
    allowedScopes: sharedScopes.map((scope) => scope.scopeKey),
    expiresAt,
  });
  const auditReferences = canonicalSharingRoomEvents({
    eventTypes: ["institutional_sharing_room_created", "institutional_sharing_room_review_required", "institutional_sharing_room_redaction_applied"],
    occurredAt: createdAt,
  });
  return {
    sharingRoomId,
    landlordId: input.landlordId,
    roomType: input.request.roomType,
    status: deriveStatus({ accessStatus: accessControls.status, expiresAt, now: createdAt, sharedScopes }),
    ...sharingRoomSafetyFlags(),
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    createdBy: input.actor,
    accessControls,
    sharedScopes,
    redactions: SHARING_ROOM_REDACTIONS,
    auditReferences,
    timelineReferences: sharedScopes.filter((scope) => scope.scopeKey === "review_timeline" || scope.scopeKey === "operator_review"),
    evidenceReferences: sharedScopes.filter((scope) => scope.scopeKey === "evidence_pack" || scope.scopeKey === "institution_export"),
  };
}

export function normalizeInstitutionalSharingRoom(raw: unknown, now?: string): InstitutionalSharingRoom | null {
  const data = (raw || {}) as Record<string, any>;
  const sharingRoomId = asString(data.sharingRoomId || data.id, 500);
  const landlordId = asString(data.landlordId, 240);
  const roomType = asString(data.roomType, 80) as SharingRoomType;
  const createdAt = toIsoDate(data.createdAt);
  if (!sharingRoomId || !landlordId || !ROOM_TYPES.has(roomType) || !createdAt) return null;
  const sharedScopes = Array.isArray(data.sharedScopes)
    ? (data.sharedScopes.map(normalizeScopeReference).filter(Boolean) as SharingScopeReference[])
    : [];
  const accessData = data.accessControls || {};
  const institutionType = INSTITUTION_TYPES.has(asString(accessData.institutionType, 80) as SharingInstitutionType)
    ? (asString(accessData.institutionType, 80) as SharingInstitutionType)
    : "lender";
  const expiresAt = toIsoDate(data.expiresAt || accessData.expiresAt);
  const accessStatusRaw = asString(accessData.status, 80) as SharingAccessStatus;
  const accessControls = accessControl({
    sharingRoomId,
    institutionType,
    redactionLevel: asString(accessData.redactionLevel, 40) === "standard" ? "standard" : "strict",
    allowedScopes: sharedScopes.map((scope) => scope.scopeKey),
    expiresAt,
    status: ["pending_review", "active", "expired", "revoked"].includes(accessStatusRaw) ? accessStatusRaw : "pending_review",
  });
  const evaluatedAt = toIsoDate(now) || new Date().toISOString();
  const status = deriveStatus({
    status: data.status,
    accessStatus: accessControls.status,
    expiresAt,
    now: evaluatedAt,
    sharedScopes,
  });
  return {
    sharingRoomId,
    landlordId,
    roomType,
    status,
    ...sharingRoomSafetyFlags(),
    createdAt,
    updatedAt: toIsoDate(data.updatedAt) || createdAt,
    expiresAt,
    createdBy: {
      userId: asString(data.createdBy?.userId, 240) || null,
      role: ["admin", "operator"].includes(asString(data.createdBy?.role, 80)) ? asString(data.createdBy?.role, 80) as any : "landlord",
      email: asString(data.createdBy?.email, 320) || null,
    },
    accessControls,
    sharedScopes,
    redactions: Array.isArray(data.redactions) && data.redactions.length ? data.redactions : SHARING_ROOM_REDACTIONS,
    auditReferences: Array.isArray(data.auditReferences) ? data.auditReferences : [],
    timelineReferences: sharedScopes.filter((scope) => scope.scopeKey === "review_timeline" || scope.scopeKey === "operator_review"),
    evidenceReferences: sharedScopes.filter((scope) => scope.scopeKey === "evidence_pack" || scope.scopeKey === "institution_export"),
  };
}

export function revokeInstitutionalSharingRoom(input: { room: InstitutionalSharingRoom; now?: string }): InstitutionalSharingRoom {
  const updatedAt = toIsoDate(input.now) || new Date().toISOString();
  return {
    ...input.room,
    status: "expired",
    updatedAt,
    accessControls: {
      ...input.room.accessControls,
      status: "revoked",
    },
    auditReferences: [
      ...input.room.auditReferences,
      ...canonicalSharingRoomEvents({ eventTypes: ["institutional_sharing_room_access_revoked"], occurredAt: updatedAt }),
    ],
  };
}

export function canonicalSharingRoomEvents(input: {
  eventTypes: SharingRoomEventType[];
  occurredAt: string;
}): InstitutionalSharingRoom["auditReferences"] {
  return input.eventTypes.map((eventType) => ({
    eventType,
    occurredAt: input.occurredAt,
    summary: eventType.replace(/_/g, " "),
  }));
}
