import { createHash } from "crypto";
import { db } from "../../firebase";
import type { TenancyContext } from "./tenancyContextService";
import { loadTenantProfileProjection } from "./tenantProfileService";

export type TenantNotificationSourceRef = {
  sourceType: "application" | "identity" | "document" | "lease" | "maintenance" | "message" | "invite" | "system";
  referenceKey: string;
  label: string;
};

export type TenantNotificationItem = {
  id: string;
  type: "application" | "identity" | "document" | "lease" | "maintenance" | "message" | "invite" | "system";
  title: string;
  summary: string;
  createdAt: string;
  status: "info" | "success" | "warning";
  relatedPath: string | null;
  sourceRefs: TenantNotificationSourceRef[];
  read: boolean;
  readAt: number | null;
};

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function toIso(value: any): string {
  const millis = toMillis(value) || Date.now();
  return new Date(millis).toISOString();
}

function safeHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function tenantNotificationScopeKey(context: TenancyContext, userId: string): string {
  return safeHash(
    [
      context.tenantId || "tenant",
      context.applicationId || "application",
      context.leaseId || "lease",
      context.propertyId || "property",
      userId || "user",
    ].join(":")
  );
}

function safeNotificationId(type: TenantNotificationItem["type"], value: string | null, fallback: string): string {
  return `${type}-${safeHash(`${type}:${value || fallback}`)}`;
}

function safeSourceRef(
  sourceType: TenantNotificationSourceRef["sourceType"],
  value: string | null,
  label: string,
  fallback: string
): TenantNotificationSourceRef {
  return {
    sourceType,
    referenceKey: `${sourceType}:${safeHash(`${sourceType}:${value || fallback}`)}`,
    label,
  };
}

function notificationCreatedAtMs(item: Pick<TenantNotificationItem, "createdAt">): number {
  return toMillis(item.createdAt) || Date.now();
}

function normalizeReadAt(readAt: unknown, createdAt: string): number | null {
  const millis = toMillis(readAt);
  if (!millis) return null;
  const createdAtMs = notificationCreatedAtMs({ createdAt });
  return Math.min(millis, createdAtMs);
}

async function queryDocs(collectionName: string, field: string, value: string | null, limit = 25) {
  const normalized = asString(value);
  if (!normalized) return [];
  try {
    const snap = await db.collection(collectionName).where(field, "==", normalized).limit(limit).get();
    return snap.docs || [];
  } catch {
    return [];
  }
}

async function loadTenantNotificationReadMap(params: {
  context: TenancyContext;
  userId: string;
}): Promise<Map<string, number>> {
  const scopeKey = tenantNotificationScopeKey(params.context, params.userId);
  try {
    const snap = await db.collection("tenantNotificationReads").where("tenantScopeKey", "==", scopeKey).limit(250).get();
    const readMap = new Map<string, number>();
    for (const doc of snap.docs || []) {
      const data = (doc.data() as any) || {};
      if (asString(data?.userId) !== asString(params.userId)) continue;
      const notificationId = asString(data?.notificationId);
      const readAtMs = toMillis(data?.readAtMs);
      if (notificationId && readAtMs) readMap.set(notificationId, readAtMs);
    }
    return readMap;
  } catch {
    return new Map();
  }
}

function applyReadState(items: TenantNotificationItem[], readMap: Map<string, number>): TenantNotificationItem[] {
  return items.map((item) => {
    const readAt = normalizeReadAt(readMap.get(item.id), item.createdAt);
    return {
      ...item,
      read: Boolean(readAt),
      readAt,
    };
  });
}

export async function listTenantNotificationFeed(params: {
  context: TenancyContext;
  userId: string;
  userEmail?: string | null;
}) : Promise<TenantNotificationItem[]> {
  const profile = await loadTenantProfileProjection({
    context: params.context,
    userId: params.userId,
    userEmail: params.userEmail,
  });

  const items: TenantNotificationItem[] = [];
  const application = profile.profile.application;
  const lease = profile.profile.lease;
  const identity = profile.identity;

  if (application) {
    const id = safeNotificationId("application", application.applicationId, "current");
    items.push({
      id,
      type: "application",
      title: "Application status updated",
      summary: application.status ? `Current application status: ${application.status}.` : "Your application is active in the tenant workspace.",
      createdAt: application.updatedAt || application.createdAt || new Date().toISOString(),
      status: application.status && /approved|completed/i.test(application.status) ? "success" : "info",
      relatedPath: "/tenant/application",
      sourceRefs: [safeSourceRef("application", application.applicationId, "Application", "current")],
      read: false,
      readAt: null,
    });
  }

  if (identity.identityVerification.status !== "verified") {
    items.push({
      id: safeNotificationId("identity", params.context.propertyId || params.userId, "identity"),
      type: "identity",
      title: "Identity verification needs attention",
      summary:
        identity.identityVerification.note ||
        (identity.identityVerification.status === "pending"
          ? "Your identity verification is still being processed."
          : identity.identityVerification.status === "missing"
          ? "Identity verification has not started yet."
          : "Identity verification needs a manual review step."),
      createdAt: identity.identityVerification.updatedAt || new Date().toISOString(),
      status: identity.identityVerification.status === "needs_review" ? "warning" : "info",
      relatedPath: "/tenant/profile",
      sourceRefs: [safeSourceRef("identity", params.context.propertyId || params.userId, "Identity verification", "identity")],
      read: false,
      readAt: null,
    });
  }

  identity.documentChecklist
    .filter((entry) => entry.status !== "verified")
    .slice(0, 4)
    .forEach((entry, index) => {
      items.push({
        id: safeNotificationId("document", `${entry.code}-${index}`, "checklist"),
        type: "document",
        title: `${entry.label} is ${entry.status.replace(/_/g, " ")}`,
        summary: entry.nextStep || "Open your profile to see the current checklist and next steps.",
        createdAt: new Date().toISOString(),
        status: entry.status === "needs_review" || entry.status === "missing" ? "warning" : "info",
        relatedPath: "/tenant/profile",
        sourceRefs: [safeSourceRef("document", entry.code, entry.label || "Document checklist", `checklist-${index}`)],
        read: false,
        readAt: null,
      });
    });

  if (lease) {
    const id = safeNotificationId("lease", lease.leaseId, "current");
    const tenantSafeLeaseReady =
      lease.leasePdfStatus === "available" ||
      lease.signatureStatus === "awaiting_tenant_signature" ||
      lease.signatureStatus === "awaiting_landlord_signature" ||
      lease.signatureStatus === "signed";
    items.push({
      id,
      type: "lease",
      title: tenantSafeLeaseReady ? "Lease document available" : "Lease setup in progress",
      summary: tenantSafeLeaseReady
        ? "A tenant-safe lease document or signing step is available in the tenant workspace."
        : "A lease record is visible, but no tenant-safe lease document or signing step is available yet.",
      createdAt: lease.startDate || new Date().toISOString(),
      status: lease.status && /active|current/i.test(lease.status) ? "success" : "info",
      relatedPath: "/tenant/lease",
      sourceRefs: [safeSourceRef("lease", lease.leaseId, "Lease summary", "current")],
      read: false,
      readAt: null,
    });
  }

  if (params.context.tenantId) {
    const maintenanceDocs = await queryDocs("maintenanceRequests", "tenantId", params.context.tenantId, 10);
    maintenanceDocs.forEach((doc) => {
      const data = (doc.data() as any) || {};
      items.push({
        id: safeNotificationId("maintenance", doc.id, "request"),
        type: "maintenance",
        title: String(data?.title || "Maintenance request").trim() || "Maintenance request",
        summary: `Status: ${String(data?.status || "submitted").trim() || "submitted"}`,
        createdAt: toIso(data?.updatedAt || data?.createdAt),
        status: /blocked|cancelled|urgent/i.test(String(data?.status || "")) ? "warning" : "info",
        relatedPath: "/tenant/maintenance",
        sourceRefs: [safeSourceRef("maintenance", doc.id, "Maintenance request", "request")],
        read: false,
        readAt: null,
      });
    });

    const inviteDocs = await queryDocs("tenancy_invites", "redeemed_by_uid", params.userId, 5);
    inviteDocs.forEach((doc) => {
      const data = (doc.data() as any) || {};
      items.push({
        id: safeNotificationId("invite", doc.id, "invite"),
        type: "invite",
        title: "Invite linked to your workspace",
        summary: "A tenancy invite was redeemed and linked to your tenant workspace.",
        createdAt: toIso(data?.redeemed_at || data?.created_at),
        status: "success",
        relatedPath: "/tenant/invite/redeem",
        sourceRefs: [safeSourceRef("invite", doc.id, "Tenancy invite", "invite")],
        read: false,
        readAt: null,
      });
    });
  }

  if (params.context.propertyId) {
    try {
      const propertySnap = await db.collection("properties").doc(params.context.propertyId).get();
      const property = propertySnap.exists ? ((propertySnap.data() as any) || {}) : {};
      const landlordId = asString(property?.landlordId);
      const conversationId =
        landlordId && (params.context.tenantId || params.context.applicationId || params.userId)
          ? `${landlordId}__${params.context.tenantId || params.context.applicationId || params.userId}__${asString(params.context.unitId) || "na"}`
          : null;
      if (conversationId) {
        const messageDocs = await queryDocs("messages", "conversationId", conversationId, 10);
        messageDocs
          .map((doc) => ({ id: doc.id, data: (doc.data() as any) || {} }))
          .filter((entry) => String(entry.data?.senderRole || "").trim().toLowerCase() === "landlord")
          .slice(0, 4)
          .forEach((entry) => {
            items.push({
              id: safeNotificationId("message", entry.id, "message"),
              type: "message",
              title: "New landlord message",
              summary: String(entry.data?.body || "").trim().slice(0, 180) || "You have a new message from your landlord.",
              createdAt: toIso(entry.data?.createdAt || entry.data?.createdAtMs),
              status: "info",
              relatedPath: "/tenant/messages",
              sourceRefs: [safeSourceRef("message", entry.id, "Landlord message", "message")],
              read: false,
              readAt: null,
            });
          });
      }
    } catch {
      // Fail closed to the feed items already assembled.
    }
  }

  const readMap = await loadTenantNotificationReadMap({
    context: params.context,
    userId: params.userId,
  });

  return applyReadState(items, readMap)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 30);
}

export async function markTenantNotificationRead(params: {
  context: TenancyContext;
  userId: string;
  userEmail?: string | null;
  notificationId: string;
}): Promise<{ ok: true; readAt: number } | { ok: false; error: "NOTIFICATION_ID_REQUIRED" | "NOTIFICATION_NOT_FOUND" }> {
  const notificationId = asString(params.notificationId);
  if (!notificationId) return { ok: false, error: "NOTIFICATION_ID_REQUIRED" };

  const items = await listTenantNotificationFeed({
    context: params.context,
    userId: params.userId,
    userEmail: params.userEmail,
  });
  const item = items.find((entry) => entry.id === notificationId);
  if (!item) return { ok: false, error: "NOTIFICATION_NOT_FOUND" };

  const readAt = normalizeReadAt(Date.now(), item.createdAt) || notificationCreatedAtMs(item);
  const scopeKey = tenantNotificationScopeKey(params.context, params.userId);
  await db.collection("tenantNotificationReads").doc(`${scopeKey}_${notificationId}`).set(
    {
      tenantScopeKey: scopeKey,
      notificationId,
      userId: params.userId,
      readAtMs: readAt,
      updatedAtMs: Date.now(),
    },
    { merge: true }
  );

  return { ok: true, readAt };
}
