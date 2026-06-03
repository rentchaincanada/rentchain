import { db, FieldValue } from "../../firebase";
import { buildEmailHtml, buildEmailText } from "../../email/templates/baseEmailTemplate";
import { sendEmail } from "../emailService";
import type { TenancyContext } from "./tenancyContextService";
import { recordTenantEvent } from "./tenantEventLogService";
import {
  deriveTenantSafeProjectionMetadata,
  deriveTenantSafeSourceRefs,
  type TenantSafeProjectionMetadata,
  type TenantSafeProjectionSourceReference,
} from "./tenantSafeProjectionContract";

type TenantProjectionMetadataFields = TenantSafeProjectionMetadata & {
  sourceCollections: string[];
  sourceRefs: TenantSafeProjectionSourceReference[];
};

export type TenantCommunicationsWorkspace = TenantProjectionMetadataFields & {
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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

async function loadLandlordEmail(landlordId: string | null) {
  const id = asString(landlordId);
  if (!id) return null;
  try {
    const userSnap = await db.collection("users").doc(id).get();
    if (userSnap.exists) {
      const email = asString((userSnap.data() as any)?.email);
      if (email && emailRegex.test(email)) return email;
    }
  } catch {
    // ignore lookup failures
  }
  try {
    const landlordSnap = await db.collection("landlords").doc(id).get();
    if (landlordSnap.exists) {
      const email = asString((landlordSnap.data() as any)?.email);
      if (email && emailRegex.test(email)) return email;
    }
  } catch {
    // ignore lookup failures
  }
  return null;
}

function buildConversationId(params: {
  landlordId: string;
  context: TenancyContext;
  userId: string;
}) {
  const scopeId = asString(params.context.tenantId) || asString(params.context.applicationId) || params.userId;
  return `${params.landlordId}__${scopeId}__${asString(params.context.unitId) || "na"}`;
}

function buildCommunicationsMetadata(context: TenancyContext) {
  const sourceRefs = deriveTenantSafeSourceRefs({
    leaseId: context.leaseId,
    propertyId: context.propertyId,
    unitId: context.unitId,
    tenantId: context.tenantId,
  });
  const sourceCollections = Array.from(new Set(sourceRefs.map((item) => item.sourceCollection))).sort((a, b) =>
    a.localeCompare(b)
  );
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_communications_projection",
    scopeType: "tenant_communications",
    sourceCollections,
    relationshipBasis: "Communications projection must be derived from the authenticated tenant workspace context.",
  });
  return { ...metadata, sourceCollections, sourceRefs };
}

function conversationMatchesContext(conversation: any, context: TenancyContext, landlordId: string) {
  if (asString(conversation?.landlordId) !== landlordId) return false;
  const tenantId = asString(context.tenantId);
  const applicationId = asString(context.applicationId);
  const leaseId = asString(context.leaseId);
  const propertyId = asString(context.propertyId);
  const unitId = asString(context.unitId);
  if (tenantId && asString(conversation?.tenantId) === tenantId) return true;
  if (applicationId && asString(conversation?.applicationId) === applicationId) return true;
  if (leaseId && asString(conversation?.leaseId) === leaseId) return true;
  return Boolean(
    unitId &&
      asString(conversation?.unitId) === unitId &&
      (!propertyId || !asString(conversation?.propertyId) || asString(conversation?.propertyId) === propertyId)
  );
}

async function loadLatestMessageMillis(conversationId: string): Promise<number | null> {
  const id = asString(conversationId);
  if (!id) return null;
  try {
    const snap = await db
      .collection("messages")
      .where("conversationId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    const doc = snap.docs?.[0];
    if (!doc) return null;
    const data = (doc.data() as any) || {};
    return toMillis(data?.createdAt) || toMillis(data?.createdAtMs);
  } catch {
    return null;
  }
}

async function resolveTenantConversation(params: {
  landlordId: string;
  context: TenancyContext;
  userId: string;
}) {
  const deterministicId = buildConversationId(params);
  const deterministicSnap = await db.collection("conversations").doc(deterministicId).get();
  const candidates: Array<{ id: string; data: any }> = [];
  if (deterministicSnap.exists) {
    candidates.push({
      id: deterministicSnap.id,
      data: (deterministicSnap.data() as any) || {},
    });
  }

  const tenantId = asString(params.context.tenantId);
  if (tenantId) {
    try {
      const snap = await db.collection("conversations").where("tenantId", "==", tenantId).limit(25).get();
      for (const doc of snap.docs || []) {
        if (!candidates.some((candidate) => candidate.id === doc.id)) {
          candidates.push({ id: doc.id, data: (doc.data() as any) || {} });
        }
      }
    } catch {
      // fall back to deterministic conversation id
    }
  }

  const unitId = asString(params.context.unitId);
  if (unitId) {
    try {
      const snap = await db.collection("conversations").where("unitId", "==", unitId).limit(25).get();
      for (const doc of snap.docs || []) {
        if (!candidates.some((candidate) => candidate.id === doc.id)) {
          candidates.push({ id: doc.id, data: (doc.data() as any) || {} });
        }
      }
    } catch {
      // fall back to deterministic conversation id
    }
  }

  const leaseId = asString(params.context.leaseId);
  if (leaseId) {
    try {
      const snap = await db.collection("conversations").where("leaseId", "==", leaseId).limit(25).get();
      for (const doc of snap.docs || []) {
        if (!candidates.some((candidate) => candidate.id === doc.id)) {
          candidates.push({ id: doc.id, data: (doc.data() as any) || {} });
        }
      }
    } catch {
      // fall back to deterministic conversation id
    }
  }

  const applicationId = asString(params.context.applicationId);
  if (applicationId) {
    try {
      const snap = await db.collection("conversations").where("applicationId", "==", applicationId).limit(25).get();
      for (const doc of snap.docs || []) {
        if (!candidates.some((candidate) => candidate.id === doc.id)) {
          candidates.push({ id: doc.id, data: (doc.data() as any) || {} });
        }
      }
    } catch {
      // fall back to deterministic conversation id
    }
  }

  const matches = candidates.filter((entry) =>
    entry.id === deterministicId || conversationMatchesContext(entry.data, params.context, params.landlordId)
  );
  const scoredMatches = await Promise.all(
    matches.map(async (entry) => {
      const latestMessageAt = await loadLatestMessageMillis(entry.id);
      return {
        ...entry,
        latestMessageAt,
        latestConversationAt: toMillis(entry.data?.lastMessageAt),
      };
    })
  );
  scoredMatches.sort((left, right) => {
    const messagePresenceDiff = Number(Boolean(right.latestMessageAt)) - Number(Boolean(left.latestMessageAt));
    if (messagePresenceDiff !== 0) return messagePresenceDiff;
    const activityDiff =
      (right.latestMessageAt || right.latestConversationAt || 0) -
      (left.latestMessageAt || left.latestConversationAt || 0);
    if (activityDiff !== 0) return activityDiff;
    if (left.id === deterministicId) return -1;
    if (right.id === deterministicId) return 1;
    return left.id.localeCompare(right.id);
  });
  if (scoredMatches[0]) return scoredMatches[0];

  return {
    id: deterministicId,
    data: null,
  };
}

export async function loadTenantCommunicationsWorkspace(params: {
  context: TenancyContext;
  userId: string;
}) : Promise<TenantCommunicationsWorkspace> {
  const projectionMetadata = buildCommunicationsMetadata(params.context);
  const propertyLandlord = await loadPropertyLandlord(params.context.propertyId);
  const landlordId = propertyLandlord?.landlordId;
  const canSend =
    Boolean(landlordId) &&
    (params.context.authority === "applicant" || params.context.authority === "active_tenant");

  if (!landlordId) {
    return {
      ...projectionMetadata,
      canSend: false,
      canSendReason: "No landlord communication context is linked to this workspace yet.",
      thread: null,
    };
  }

  const conversation = await resolveTenantConversation({
    landlordId,
    context: params.context,
    userId: params.userId,
  });
  const conversationId = conversation.id;
  const conversationData = conversation.data;

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
    ...projectionMetadata,
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
  const existingConversation = await resolveTenantConversation({
    landlordId,
    context: params.context,
    userId: params.userId,
  });
  const targetConversationId = existingConversation.id || conversationId;
  const now = Date.now();

  await db.collection("conversations").doc(targetConversationId).set(
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
    conversationId: targetConversationId,
    senderRole: "tenant",
    body,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
  });

  await recordTenantEvent({
    eventType: "tenant_message_sent",
    entityType: "conversation",
    entityId: targetConversationId,
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

  try {
    const recipientEmail = await loadLandlordEmail(landlordId);
    const from =
      process.env.EMAIL_FROM ||
      process.env.SENDGRID_FROM_EMAIL ||
      process.env.SENDGRID_FROM ||
      process.env.FROM_EMAIL;
    if (recipientEmail && from && emailRegex.test(recipientEmail)) {
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
      const preview = body.length > 280 ? `${body.slice(0, 280)}...` : body;
      await sendEmail({
        to: recipientEmail,
        from,
        replyTo: from,
        subject: "New tenant message",
        text: buildEmailText({
          intro: preview,
          ctaText: "Open messages",
          ctaUrl: `${baseUrl}/messages`,
        }),
        html: buildEmailHtml({
          title: "New tenant message",
          intro: preview,
          ctaText: "Open messages",
          ctaUrl: `${baseUrl}/messages`,
        }),
      });
    }
  } catch (error: any) {
    console.error("[tenant-communications] email send failed", {
      landlordId,
      conversationId: targetConversationId,
      message: error?.message || "send_failed",
    });
  }

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
  const existingConversation = await resolveTenantConversation({
    landlordId,
    context: params.context,
    userId: params.userId,
  });
  await db.collection("conversations").doc(existingConversation.id || conversationId).set(
    {
      lastReadAtTenant: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const tenantReadId = asString(params.context.tenantId) || asString(params.userId);
  const resolvedConversationId = existingConversation.id || conversationId;
  if (tenantReadId && resolvedConversationId) {
    const snap = await db
      .collection("messages")
      .where("conversationId", "==", resolvedConversationId)
      .limit(200)
      .get();
    const now = Date.now();
    await Promise.all(
      snap.docs.map((doc) =>
        db
          .collection("tenantMessageReads")
          .doc(`${tenantReadId}_${doc.id}`)
          .set(
            {
              tenantId: tenantReadId,
              messageId: doc.id,
              readAtMs: now,
              createdAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
      )
    );
  }
  return { ok: true as const };
}
