import { db } from "../../config/firebase";
import type { TenancyContext } from "./tenancyContextService";
import { loadTenantProfileProjection } from "./tenantProfileService";

export type TenantNotificationItem = {
  id: string;
  type: "application" | "identity" | "document" | "lease" | "maintenance" | "message" | "invite" | "system";
  title: string;
  summary: string;
  createdAt: string;
  status: "info" | "success" | "warning";
  relatedPath: string | null;
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
    items.push({
      id: `application-${application.applicationId}`,
      type: "application",
      title: "Application status updated",
      summary: application.status ? `Current application status: ${application.status}.` : "Your application is active in the tenant workspace.",
      createdAt: application.updatedAt || application.createdAt || new Date().toISOString(),
      status: application.status && /approved|completed/i.test(application.status) ? "success" : "info",
      relatedPath: "/tenant/application",
    });
  }

  if (identity.identityVerification.status !== "verified") {
    items.push({
      id: `identity-${params.context.propertyId || params.userId}`,
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
    });
  }

  identity.documentChecklist
    .filter((entry) => entry.status !== "verified")
    .slice(0, 4)
    .forEach((entry, index) => {
      items.push({
        id: `document-${entry.code}-${index}`,
        type: "document",
        title: `${entry.label} is ${entry.status.replace(/_/g, " ")}`,
        summary: entry.nextStep || "Open your profile to see the current checklist and next steps.",
        createdAt: new Date().toISOString(),
        status: entry.status === "needs_review" || entry.status === "missing" ? "warning" : "info",
        relatedPath: "/tenant/profile",
      });
    });

  if (lease) {
    items.push({
      id: `lease-${lease.leaseId}`,
      type: "lease",
      title: "Lease summary available",
      summary: lease.status ? `Your lease is currently ${lease.status}.` : "Your lease summary is available in the tenant workspace.",
      createdAt: lease.startDate || new Date().toISOString(),
      status: lease.status && /active|current/i.test(lease.status) ? "success" : "info",
      relatedPath: "/tenant/lease",
    });
  }

  if (params.context.tenantId) {
    const maintenanceDocs = await queryDocs("maintenanceRequests", "tenantId", params.context.tenantId, 10);
    maintenanceDocs.forEach((doc) => {
      const data = (doc.data() as any) || {};
      items.push({
        id: `maintenance-${doc.id}`,
        type: "maintenance",
        title: String(data?.title || "Maintenance request").trim() || "Maintenance request",
        summary: `Status: ${String(data?.status || "submitted").trim() || "submitted"}`,
        createdAt: toIso(data?.updatedAt || data?.createdAt),
        status: /blocked|cancelled|urgent/i.test(String(data?.status || "")) ? "warning" : "info",
        relatedPath: `/tenant/maintenance/${doc.id}`,
      });
    });

    const inviteDocs = await queryDocs("tenancy_invites", "redeemed_by_uid", params.userId, 5);
    inviteDocs.forEach((doc) => {
      const data = (doc.data() as any) || {};
      items.push({
        id: `invite-${doc.id}`,
        type: "invite",
        title: "Invite linked to your workspace",
        summary: "A tenancy invite was redeemed and linked to your tenant workspace.",
        createdAt: toIso(data?.redeemed_at || data?.created_at),
        status: "success",
        relatedPath: "/tenant/invite/redeem",
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
              id: `message-${entry.id}`,
              type: "message",
              title: "New landlord message",
              summary: String(entry.data?.body || "").trim().slice(0, 180) || "You have a new message from your landlord.",
              createdAt: toIso(entry.data?.createdAt || entry.data?.createdAtMs),
              status: "info",
              relatedPath: "/tenant/messages",
            });
          });
      }
    } catch {
      // Fail closed to the feed items already assembled.
    }
  }

  return items
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 30);
}
