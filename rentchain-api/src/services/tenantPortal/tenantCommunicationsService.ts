import { db, FieldValue } from "../../config/firebase";
import type { TenancyContext } from "./tenancyContextService";
import { recordTenantEvent } from "./tenantEventLogService";

export type TenantCommunicationsWorkspace = {
  canSend: boolean;
  canSendReason: string | null;
  thread: {
    id: string;
    landlordLabel: string;
    propertyId: string | null;
    unitId: string | null;
    unreadCount: number;
    lastMessageAt: string | null;
    messages: TenantThreadMessage[];
  } | null;
};

export type TenantThreadMessage = {
  id: string;
  senderRole: "tenant" | "landlord";
  body: string;
  createdAt: string | null;
  createdAtMs: number | null;
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

function toIso(value: any): string | null {
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString() : null;
}

async function loadPropertyLandlord(propertyId: string | null) {
  const id = asString(propertyId);
  if (!id) return null;
  try {
    const snap = await db.collection("properties").doc(id).get();
    if (!snap.exists) return null;
    const data = (snap.data() as any) || {};
    return {
      landlordId: asString(data?.landlordId),
      landlordLabel: asString(data?.landlordName) || "Landlord",
    };
  } catch {
    return null;
  }
}

function buildConversationId(params: {
  landlordId: string;
  context: TenancyContext;
  userId: string;
}) {
  const scopeId = asString(params.context.tenantId) || asString(params.context.applicationId) || params.userId;
  return `${params.landlordId}__${scopeId}__${asString(params.context.unitId) || "na"}`;
}

export async function loadTenantCommunicationsWorkspace(params: {
  context: TenancyContext;
  userId: string;
}) : Promise<TenantCommunicationsWorkspace> {
  const propertyLandlord = await loadPropertyLandlord(params.context.propertyId);
  const landlordId = propertyLandlord?.landlordId;
  const canSend =
    Boolean(landlordId) &&
    (params.context.authority === "applicant" || params.context.authority === "active_tenant");

  if (!landlordId) {
    return {
      canSend: false,
      canSendReason: "No landlord communication context is linked to this workspace yet.",
      thread: null,
    };
  }

  const conversationId = buildConversationId({
    landlordId,
    context: params.context,
    userId: params.userId,
  });

  let conversationData: any = null;
  try {
    const conversationSnap = await db.collection("conversations").doc(conversationId).get();
    if (conversationSnap.exists) {
      conversationData = (conversationSnap.data() as any) || {};
    }
  } catch {
    conversationData = null;
  }

  let messages: TenantThreadMessage[] = [];
  try {
    const snap = await db
      .collection("messages")
      .where("conversationId", "==", conversationId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    messages = snap.docs
      .map((doc) => {
        const data = (doc.data() as any) || {};
        return {
          id: doc.id,
          senderRole: String(data?.senderRole || "").trim().toLowerCase() === "landlord" ? "landlord" : "tenant",
          body: String(data?.body || "").trim(),
          createdAt: toIso(data?.createdAt) || toIso(data?.createdAtMs),
          createdAtMs: toMillis(data?.createdAt) || toMillis(data?.createdAtMs),
        } satisfies TenantThreadMessage;
      })
      .sort((left, right) => Number(left.createdAtMs || 0) - Number(right.createdAtMs || 0));
  } catch {
    messages = [];
  }

  const lastReadAtTenant = toMillis(conversationData?.lastReadAtTenant);
  const unreadCount = messages.filter((message) => {
    if (message.senderRole !== "landlord") return false;
    if (!message.createdAtMs) return false;
    return !lastReadAtTenant || message.createdAtMs > lastReadAtTenant;
  }).length;

  return {
    canSend,
    canSendReason: canSend ? null : "Messaging becomes available once your tenancy or application context is fully linked.",
    thread: {
      id: conversationId,
      landlordLabel: propertyLandlord?.landlordLabel || "Landlord",
      propertyId: params.context.propertyId,
      unitId: params.context.unitId,
      unreadCount,
      lastMessageAt: toIso(conversationData?.lastMessageAt) || messages[messages.length - 1]?.createdAt || null,
      messages,
    },
  };
}

export async function sendTenantCommunicationMessage(params: {
  context: TenancyContext;
  userId: string;
  body: string;
}) {
  const propertyLandlord = await loadPropertyLandlord(params.context.propertyId);
  const landlordId = propertyLandlord?.landlordId;
  if (!landlordId) {
    return { ok: false as const, error: "LANDLORD_CONTEXT_MISSING" };
  }
  if (!(params.context.authority === "applicant" || params.context.authority === "active_tenant")) {
    return { ok: false as const, error: "TENANCY_CONTEXT_REQUIRED" };
  }

  const body = String(params.body || "").trim();
  if (!body) return { ok: false as const, error: "MESSAGE_BODY_REQUIRED" };
  if (body.length > 4000) return { ok: false as const, error: "MESSAGE_BODY_TOO_LONG" };

  const conversationId = buildConversationId({
    landlordId,
    context: params.context,
    userId: params.userId,
  });
  const now = Date.now();

  await db.collection("conversations").doc(conversationId).set(
    {
      landlordId,
      tenantId: asString(params.context.tenantId),
      propertyId: asString(params.context.propertyId),
      unitId: asString(params.context.unitId),
      applicationId: asString(params.context.applicationId),
      leaseId: asString(params.context.leaseId),
      createdAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
      lastReadAtTenant: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const messageRef = db.collection("messages").doc();
  await messageRef.set({
    conversationId,
    senderRole: "tenant",
    body,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
  });

  await recordTenantEvent({
    eventType: "tenant_message_sent",
    entityType: "conversation",
    entityId: conversationId,
    createdBy: params.userId,
    context: {
      propertyId: params.context.propertyId,
      rc_prop_id: params.context.rc_prop_id,
      applicationId: params.context.applicationId,
      leaseId: params.context.leaseId,
      tenantId: params.context.tenantId,
    },
    payload: {
      length: body.length,
    },
  });

  return {
    ok: true as const,
    message: {
      id: messageRef.id,
      senderRole: "tenant" as const,
      body,
      createdAt: new Date(now).toISOString(),
      createdAtMs: now,
    },
  };
}

export async function markTenantCommunicationsRead(params: {
  context: TenancyContext;
  userId: string;
}) {
  const propertyLandlord = await loadPropertyLandlord(params.context.propertyId);
  const landlordId = propertyLandlord?.landlordId;
  if (!landlordId) return { ok: false as const, error: "LANDLORD_CONTEXT_MISSING" };

  const conversationId = buildConversationId({
    landlordId,
    context: params.context,
    userId: params.userId,
  });
  await db.collection("conversations").doc(conversationId).set(
    {
      lastReadAtTenant: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { ok: true as const };
}
