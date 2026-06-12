import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireLandlord } from "../middleware/requireLandlord";
import { requireAuth } from "../middleware/requireAuth";
import { db, FieldValue } from "../firebase";
import { buildUpgradeRequiredResponse, requireCapability } from "../services/capabilityGuard";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";
import { getEffectiveLandlordId, getEffectiveTenantId, resolveRequestAuthority } from "../auth/requestAuthority";

const router = Router();
router.use(authenticateJwt);

type Role = "landlord" | "tenant";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEASE_LOOKUP_CANDIDATES = 10;
const MAX_TENANT_LOOKUP_CANDIDATES = 2;
const CURRENT_LEASE_STATUSES = new Set([
  "active",
  "current",
  "signed",
  "notice_pending",
  "renewal_pending",
  "renewal_accepted",
]);

function toMillis(v: any): number | null {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  return null;
}

function normalizeConversation(doc: any) {
  const data = doc.data() as any;
  const id = doc.id;
  const lastMessageAt = toMillis(data.lastMessageAt) || null;
  const normalizeReadState = (value: any, role: Role) => {
    const readAt = toMillis(value) || null;
    if (readAt != null && lastMessageAt != null && readAt > lastMessageAt) {
      console.warn("[messages] read state exceeds last message timestamp", {
        conversationId: id,
        role,
      });
      return lastMessageAt;
    }
    return readAt;
  };
  return {
    id,
    landlordId: data.landlordId || null,
    tenantId: data.tenantId || null,
    tenantEmail: data.tenantEmail || data.applicantEmail || data.email || null,
    tenantName: data.tenantName || data.tenantDisplayName || data.applicantName || null,
    propertyId: data.propertyId || null,
    unitId: data.unitId || null,
    applicationId: data.applicationId || null,
    leaseId: data.leaseId || data.currentLeaseId || null,
    propertySnapshotLabel: data.propertyDisplayLabel || data.propertyName || data.propertyLabel || null,
    unitSnapshotLabel: data.unitDisplayLabel || data.unitLabel || data.unitNumber || null,
    lastMessageAt,
    lastReadAtLandlord: normalizeReadState(data.lastReadAtLandlord, "landlord"),
    lastReadAtTenant: normalizeReadState(data.lastReadAtTenant, "tenant"),
    createdAt: toMillis(data.createdAt) || null,
  };
}

function normalizeUnitLabel(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return /^unit\b/i.test(raw) ? raw : `Unit ${raw}`;
}

function buildPropertyLabel(property: any) {
  return (
    stringOrNull(property?.name) ||
    stringOrNull(property?.propertyName) ||
    stringOrNull(property?.propertyAddress) ||
    stringOrNull(property?.addressLine1) ||
    stringOrNull(property?.address) ||
    null
  );
}

function buildTenantLabel(tenant: any) {
  return stringOrNull(tenant?.fullName) || stringOrNull(tenant?.name) || stringOrNull(tenant?.email) || null;
}

function buildTenantEmail(tenant: any) {
  return (
    stringOrNull(tenant?.email) ||
    stringOrNull(tenant?.applicantEmail) ||
    stringOrNull(tenant?.tenantEmail) ||
    null
  );
}

function logLookupFailure(scope: string, context: Record<string, unknown>, err: any) {
  console.warn(`[messages] ${scope} lookup failed`, {
    ...context,
    message: err?.message || "lookup_failed",
  });
}

async function lookupPropertyIdForUnit(unitId: string | null) {
  const target = stringOrNull(unitId);
  if (!target) return null;
  try {
    const unitSnap = await db.collection("units").doc(target).get();
    if (!unitSnap.exists) return null;
    return stringOrNull((unitSnap.data() as any)?.propertyId);
  } catch (err: any) {
    logLookupFailure("unit property", { unitId: target }, err);
    return null;
  }
}

async function loadCurrentLeaseForTenant(tenantId: string | null, hintedLeaseId?: string | null) {
  const targetTenantId = stringOrNull(tenantId);
  const targetLeaseId = stringOrNull(hintedLeaseId);
  try {
    if (targetLeaseId) {
      const snap = await db.collection("leases").doc(targetLeaseId).get();
      if (snap.exists) return { id: snap.id, raw: snap.data() as any };
    }
  } catch (err: any) {
    logLookupFailure("lease by id", { tenantId: targetTenantId, leaseId: targetLeaseId }, err);
  }
  if (!targetTenantId) return null;

  const candidates: Array<{ id: string; raw: any }> = [];
  try {
    const directSnap = await db.collection("leases").where("tenantId", "==", targetTenantId).limit(MAX_LEASE_LOOKUP_CANDIDATES).get();
    for (const doc of (directSnap.docs || []).slice(0, MAX_LEASE_LOOKUP_CANDIDATES)) {
      candidates.push({ id: doc.id, raw: doc.data() as any });
    }
  } catch (err: any) {
    logLookupFailure("leases by tenantId", { tenantId: targetTenantId, limit: MAX_LEASE_LOOKUP_CANDIDATES }, err);
  }
  try {
    const arraySnap = await db.collection("leases").where("tenantIds", "array-contains", targetTenantId).limit(MAX_LEASE_LOOKUP_CANDIDATES).get();
    for (const doc of (arraySnap.docs || []).slice(0, MAX_LEASE_LOOKUP_CANDIDATES)) {
      if (!candidates.some((candidate) => candidate.id === doc.id)) {
        candidates.push({ id: doc.id, raw: doc.data() as any });
      }
    }
  } catch (err: any) {
    logLookupFailure("leases by tenantIds", { tenantId: targetTenantId, limit: MAX_LEASE_LOOKUP_CANDIDATES }, err);
  }

  if (candidates.length > MAX_LEASE_LOOKUP_CANDIDATES) {
    console.warn("[messages] lease lookup candidate cap applied", {
      tenantId: targetTenantId,
      count: candidates.length,
      limit: MAX_LEASE_LOOKUP_CANDIDATES,
    });
  }
  candidates.sort((left, right) => {
    const currentScore = (raw: any) =>
      ["active", "current", "signed", "notice_pending", "renewal_pending", "renewal_accepted"].includes(
        String(raw?.status || "").trim().toLowerCase()
      )
        ? 1
        : 0;
    const statusDiff = currentScore(right.raw) - currentScore(left.raw);
    if (statusDiff !== 0) return statusDiff;
    return (toMillis(right.raw?.updatedAt || right.raw?.createdAt) || 0) - (toMillis(left.raw?.updatedAt || left.raw?.createdAt) || 0);
  });

  return candidates.slice(0, MAX_LEASE_LOOKUP_CANDIDATES)[0] || null;
}

function scoreLeaseForMessages(raw: any) {
  return CURRENT_LEASE_STATUSES.has(String(raw?.status || "").trim().toLowerCase()) ? 1 : 0;
}

async function loadCurrentLeaseForConversation(
  conversation: ReturnType<typeof normalizeConversation>,
  tenant:
    | {
        id?: string | null;
        raw: any;
        currentLeaseId?: string | null;
      }
    | null
) {
  const tenantId =
    stringOrNull(conversation.tenantId) ||
    stringOrNull(tenant?.id) ||
    stringOrNull(tenant?.raw?.tenantId) ||
    stringOrNull(tenant?.raw?.userId) ||
    stringOrNull(tenant?.raw?.uid);
  const hintedLeaseId =
    stringOrNull(conversation.leaseId) ||
    stringOrNull(tenant?.currentLeaseId) ||
    stringOrNull(tenant?.raw?.currentLeaseId) ||
    stringOrNull(tenant?.raw?.leaseId);

  const tenantLease = await loadCurrentLeaseForTenant(tenantId, hintedLeaseId);
  if (tenantLease) return tenantLease;

  const unitId = stringOrNull(conversation.unitId);
  if (!unitId) return null;

  try {
    const snap = await db.collection("leases").where("unitId", "==", unitId).limit(MAX_LEASE_LOOKUP_CANDIDATES).get();
    const candidates = (snap.docs || []).slice(0, MAX_LEASE_LOOKUP_CANDIDATES)
      .map((doc: any) => ({ id: doc.id, raw: doc.data() as any }))
      .filter((lease: any) => {
        const leaseLandlordId = stringOrNull(lease.raw?.landlordId);
        const leasePropertyId = stringOrNull(lease.raw?.propertyId);
        if (leaseLandlordId && leaseLandlordId !== conversation.landlordId) return false;
        if (conversation.propertyId && leasePropertyId && leasePropertyId !== conversation.propertyId) return false;
        return true;
      });
    candidates.sort((left, right) => {
      const statusDiff = scoreLeaseForMessages(right.raw) - scoreLeaseForMessages(left.raw);
      if (statusDiff !== 0) return statusDiff;
      return (toMillis(right.raw?.updatedAt || right.raw?.createdAt) || 0) - (toMillis(left.raw?.updatedAt || left.raw?.createdAt) || 0);
    });
    return candidates[0] || null;
  } catch (err: any) {
    logLookupFailure("leases by unitId", {
      conversationId: conversation.id,
      tenantId,
      unitId,
      limit: MAX_LEASE_LOOKUP_CANDIDATES,
    }, err);
    return null;
  }
}

async function loadTenantForConversation(conversation: ReturnType<typeof normalizeConversation>) {
  const tenantId = stringOrNull(conversation.tenantId);
  const tenantEmail = String(conversation.tenantEmail || "").trim().toLowerCase();

  if (tenantId) {
    try {
      const directSnap = await db.collection("tenants").doc(tenantId).get();
      if (directSnap.exists) return { id: directSnap.id, raw: directSnap.data() as any };
    } catch (err: any) {
      logLookupFailure("tenant by id", { conversationId: conversation.id, tenantId }, err);
    }

    for (const field of ["tenantId", "userId", "uid"]) {
      try {
        const snap = await db.collection("tenants").where(field, "==", tenantId).limit(MAX_TENANT_LOOKUP_CANDIDATES).get();
        const doc = snap.docs?.[0];
        if (doc) return { id: doc.id, raw: doc.data() as any };
      } catch (err: any) {
        logLookupFailure("tenant by alternate id", { conversationId: conversation.id, field, tenantId }, err);
      }
    }
  }

  if (tenantEmail && emailRegex.test(tenantEmail)) {
    for (const field of ["email", "applicantEmail"]) {
      try {
        const snap = await db.collection("tenants").where(field, "==", tenantEmail).limit(MAX_TENANT_LOOKUP_CANDIDATES).get();
        const doc = snap.docs?.[0];
        if (doc) return { id: doc.id, raw: doc.data() as any };
      } catch (err: any) {
        logLookupFailure("tenant by email", { conversationId: conversation.id, field, tenantEmail }, err);
      }
    }
  }

  const lease = await loadCurrentLeaseForConversation(conversation, null);
  const leaseTenantId = stringOrNull(lease?.raw?.tenantId);
  if (leaseTenantId) {
    try {
      const tenantSnap = await db.collection("tenants").doc(leaseTenantId).get();
      if (tenantSnap.exists) return { id: tenantSnap.id, raw: tenantSnap.data() as any };
    } catch (err: any) {
      logLookupFailure("tenant by lease tenantId", { conversationId: conversation.id, tenantId: leaseTenantId }, err);
    }
  }

  console.warn("[messages] tenant lookup missed", {
    conversationId: conversation.id,
    tenantId,
    tenantEmail: tenantEmail || null,
  });
  return null;
}

async function enrichConversationDisplay<T extends ReturnType<typeof normalizeConversation>>(conversations: T[]) {
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const tenantEntries = await Promise.all(
    conversations.map(async (conversation) => [conversation.id, await loadTenantForConversation(conversation)] as const)
  );

  const tenantByConversationId = new Map<
    string,
    {
      id: string | null;
      raw: any;
      label: string | null;
      email: string | null;
      unitLabel: string | null;
      unitId: string | null;
      propertyId: string | null;
      currentLeaseId: string | null;
    }
  >(
    tenantEntries.map(([conversationId, tenant]) => [
      conversationId,
      {
        id: tenant?.id || null,
        raw: tenant?.raw || null,
        label: tenant?.raw ? buildTenantLabel(tenant.raw) : stringOrNull(conversationById.get(conversationId)?.tenantEmail),
        email: tenant?.raw ? buildTenantEmail(tenant.raw) : null,
        unitLabel: tenant?.raw ? normalizeUnitLabel(tenant.raw?.unitLabel || tenant.raw?.unitNumber || tenant.raw?.unit) : null,
        unitId: tenant?.raw ? stringOrNull(tenant.raw?.unitId) : null,
        propertyId: tenant?.raw ? stringOrNull(tenant.raw?.propertyId) : null,
        currentLeaseId: tenant?.raw ? stringOrNull(tenant.raw?.currentLeaseId || tenant.raw?.leaseId) : null,
      },
    ])
  );
  const unitIds = Array.from(
    new Set(
      conversations
        .flatMap((conversation) => [
          stringOrNull(conversation.unitId),
          stringOrNull(tenantByConversationId.get(conversation.id)?.unitId),
        ])
        .filter(Boolean)
    )
  ) as string[];
  const units = await Promise.all(
    unitIds.map(async (unitId) => {
      let raw = null;
      try {
        const snap = await db.collection("units").doc(unitId).get();
        raw = snap.exists ? (snap.data() as any) : null;
      } catch (err: any) {
        logLookupFailure("unit hydration", { unitId }, err);
      }
      return [
        unitId,
        {
          raw,
          label: raw ? normalizeUnitLabel(raw?.unitNumber || raw?.unitLabel || raw?.label || raw?.name) : null,
        },
      ] as const;
    })
  );
  const unitById = new Map<string, { raw: any; label: string | null }>(units);
  const leaseEntries = await Promise.all(
    conversations.map(async (conversation) => {
      const tenant = tenantByConversationId.get(conversation.id);
      return [
        conversation.id,
        await loadCurrentLeaseForConversation(conversation, tenant || null),
      ] as const;
    })
  );
  const leaseByConversationId = new Map<string, Awaited<ReturnType<typeof loadCurrentLeaseForTenant>>>(leaseEntries);
  const leaseUnitIds = Array.from(
    new Set(
      leaseEntries
        .map(([, lease]) => stringOrNull(lease?.raw?.unitId))
        .filter((unitId): unitId is string => typeof unitId === "string" && unitId.length > 0 && !unitById.has(unitId))
    )
  );
  await Promise.all(
    leaseUnitIds.map(async (unitId) => {
      try {
        const snap = await db.collection("units").doc(unitId).get();
        if (!snap.exists) return;
        const raw = snap.data() as any;
        unitById.set(unitId, {
          raw,
          label: normalizeUnitLabel(raw?.unitNumber || raw?.unitLabel || raw?.label || raw?.name),
        });
      } catch (err: any) {
        logLookupFailure("lease unit hydration", { unitId }, err);
      }
    })
  );
  const propertyIds = Array.from(
    new Set(
      conversations
        .map((conversation) => {
          const direct = stringOrNull((conversation as any).propertyId);
          if (direct) return direct;
          const unitId = stringOrNull(conversation.unitId);
          if (unitId) return stringOrNull(unitById.get(unitId)?.raw?.propertyId);
          const tenant = tenantByConversationId.get(conversation.id);
          const lease = leaseByConversationId.get(conversation.id);
          return stringOrNull(tenant?.propertyId) || stringOrNull(lease?.raw?.propertyId);
        })
        .filter(Boolean)
    )
  ) as string[];
  const properties = await Promise.all(
    propertyIds.map(async (propertyId) => {
      try {
        const snap = await db.collection("properties").doc(propertyId).get();
        return [propertyId, snap.exists ? (snap.data() as any) : null] as const;
      } catch (err: any) {
        logLookupFailure("property hydration", { propertyId }, err);
        return [propertyId, null] as const;
      }
    })
  );
  const propertyById = new Map<string, any>(properties);

  return conversations.map((conversation) => {
    const unitId = stringOrNull(conversation.unitId);
    const resolvedTenant = tenantByConversationId.get(conversation.id);
    const resolvedLease = leaseByConversationId.get(conversation.id);
    const resolvedUnit = unitId ? unitById.get(unitId) : null;
    const leaseUnitId = stringOrNull(resolvedLease?.raw?.unitId);
    const leaseUnitLabel = normalizeUnitLabel(
      resolvedLease?.raw?.unitLabel ||
        resolvedLease?.raw?.unitNumber ||
        resolvedLease?.raw?.unit
    );
    const propertyId =
      stringOrNull((conversation as any).propertyId) ||
      stringOrNull(resolvedUnit?.raw?.propertyId) ||
      stringOrNull(resolvedTenant?.propertyId) ||
      stringOrNull(resolvedLease?.raw?.propertyId);
    const property = propertyId ? propertyById.get(propertyId) : null;
    const fallbackUnitFromProperty = Array.isArray(property?.units)
      ? property.units.find((unit: any) => {
          const candidateId = stringOrNull(unit?.id) || stringOrNull(unit?.unitId) || stringOrNull(unit?.uid);
          if (candidateId && unitId && candidateId === unitId) return true;
          if (candidateId && leaseUnitId && candidateId === leaseUnitId) return true;
          const candidateLabel = normalizeUnitLabel(unit?.unitNumber || unit?.label || unit?.name);
          return Boolean(
            candidateLabel &&
              [resolvedTenant?.unitLabel, leaseUnitLabel].filter(Boolean).includes(candidateLabel)
          );
        })
      : null;

    return {
      ...conversation,
      tenantId:
        stringOrNull(conversation.tenantId) ||
        stringOrNull(resolvedTenant?.id) ||
        stringOrNull(resolvedLease?.raw?.tenantId),
      tenantEmail:
        stringOrNull(conversation.tenantEmail) ||
        stringOrNull(resolvedTenant?.email) ||
        buildTenantEmail(resolvedLease?.raw),
      tenantDisplayName:
        resolvedTenant?.label ||
        stringOrNull(conversation.tenantName) ||
        stringOrNull(conversation.tenantEmail) ||
        "Unknown Tenant",
      propertyDisplayLabel: buildPropertyLabel(property) || stringOrNull(conversation.propertySnapshotLabel),
      unitDisplayLabel:
        resolvedUnit?.label ||
        (resolvedTenant?.unitId ? unitById.get(resolvedTenant.unitId)?.label : null) ||
        (leaseUnitId ? unitById.get(leaseUnitId)?.label : null) ||
        resolvedTenant?.unitLabel ||
        leaseUnitLabel ||
        normalizeUnitLabel(conversation.unitSnapshotLabel) ||
        normalizeUnitLabel(
          fallbackUnitFromProperty?.unitNumber ||
            fallbackUnitFromProperty?.label ||
            fallbackUnitFromProperty?.name
        ) ||
        null,
    };
  });
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => emailRegex.test(value))
    )
  );
}

function stringOrNull(value: any) {
  const next = String(value || "").trim();
  return next || null;
}

async function lookupUserEmail(userId: string | null) {
  const id = stringOrNull(userId);
  if (!id) return null;
  try {
    const userSnap = await db.collection("users").doc(id).get();
    if (userSnap.exists) {
      return stringOrNull((userSnap.data() as any)?.email);
    }
  } catch {
    // ignore lookup failures
  }
  return null;
}

async function lookupLandlordEmail(landlordId: string | null) {
  const direct = await lookupUserEmail(landlordId);
  if (direct) return direct;
  const id = stringOrNull(landlordId);
  if (!id) return null;
  try {
    const landlordSnap = await db.collection("landlords").doc(id).get();
    if (landlordSnap.exists) {
      return stringOrNull((landlordSnap.data() as any)?.email);
    }
  } catch {
    // ignore lookup failures
  }
  return null;
}

async function lookupTenantEmail(tenantId: string | null) {
  const id = stringOrNull(tenantId);
  if (!id) return null;
  try {
    const tenantSnap = await db.collection("tenants").doc(id).get();
    if (tenantSnap.exists) {
      return stringOrNull((tenantSnap.data() as any)?.email);
    }
  } catch {
    // ignore lookup failures
  }
  return null;
}

async function lookupTenantEmailByAlternateId(tenantId: string | null) {
  const id = stringOrNull(tenantId);
  if (!id) return null;
  for (const field of ["tenantId", "userId", "uid"]) {
    try {
      const snap = await db.collection("tenants").where(field, "==", id).limit(2).get();
      const doc = snap.docs?.[0];
      const email = doc ? buildTenantEmail(doc.data() as any) : null;
      if (email) return email;
    } catch {
      // continue through alternate tenant identifiers
    }
  }
  return null;
}

async function lookupApplicationTenantEmail(applicationId: string | null) {
  const id = stringOrNull(applicationId);
  if (!id) return null;
  try {
    const snap = await db.collection("rentalApplications").doc(id).get();
    if (snap.exists) return buildTenantEmail(snap.data() as any);
  } catch {
    // ignore lookup failures
  }
  return null;
}

async function lookupTenantRecipientEmail(conversation: any) {
  const direct = buildTenantEmail(conversation);
  if (direct) return direct;
  const byTenantDoc = await lookupTenantEmail(conversation?.tenantId);
  if (byTenantDoc) return byTenantDoc;
  const byAlternateTenantId = await lookupTenantEmailByAlternateId(conversation?.tenantId);
  if (byAlternateTenantId) return byAlternateTenantId;
  const byApplication = await lookupApplicationTenantEmail(conversation?.applicationId);
  if (byApplication) return byApplication;
  return null;
}

async function sendConversationMessageEmail(params: {
  conversation: any;
  senderRole: Role;
  body: string;
}) {
  const from =
    process.env.EMAIL_FROM ||
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SENDGRID_FROM ||
    process.env.FROM_EMAIL;
  if (!from) return;

  const recipientEmail =
    params.senderRole === "landlord"
      ? await lookupTenantRecipientEmail(params.conversation)
      : await lookupLandlordEmail(params.conversation.landlordId);
  if (!recipientEmail || !emailRegex.test(recipientEmail)) {
    console.info("[messages] message email skipped", {
      conversationId: params.conversation?.id,
      recipientRole: params.senderRole === "landlord" ? "tenant" : "landlord",
      reason: "recipient_email_missing",
    });
    return;
  }

  const recipientRole = params.senderRole === "landlord" ? "tenant" : "landlord";
  const lastNotified =
    recipientRole === "tenant"
      ? toMillis(params.conversation?.lastNotifiedAtTenantMs)
      : toMillis(params.conversation?.lastNotifiedAtLandlordMs);
  const now = Date.now();
  if (lastNotified && now - lastNotified < 10 * 60 * 1000) {
    console.info("[messages] message email skipped", {
      conversationId: params.conversation?.id,
      recipientRole,
      reason: "recently_notified",
    });
    return;
  }

  const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const threadPath = params.senderRole === "landlord" ? "/tenant/messages" : "/messages";
  const subjectPrefix = params.senderRole === "landlord" ? "New message from your landlord" : "New tenant message";
  const contextBits = [
    stringOrNull(params.conversation.propertyId),
    stringOrNull(params.conversation.unitId),
  ].filter(Boolean);
  const preview = params.body.length > 280 ? `${params.body.slice(0, 280)}...` : params.body;

  await sendEmail({
    to: uniqueEmails([recipientEmail]),
    from,
    replyTo: from,
    subject: contextBits.length ? `${subjectPrefix} (${contextBits.join(" • ")})` : subjectPrefix,
    text: buildEmailText({
      intro: `${subjectPrefix}.\n\n${preview}`,
      ctaText: "Open messages",
      ctaUrl: `${baseUrl}${threadPath}`,
    }),
    html: buildEmailHtml({
      title: subjectPrefix,
      intro: preview,
      ctaText: "Open messages",
      ctaUrl: `${baseUrl}${threadPath}`,
    }),
  });

  await db.collection("conversations").doc(params.conversation.id).set(
    recipientRole === "tenant"
      ? { lastNotifiedAtTenantMs: now }
      : { lastNotifiedAtLandlordMs: now },
    { merge: true }
  );
}

async function addMessage(params: {
  conversationId: string;
  senderRole: Role;
  body: string;
}) {
  const { conversationId, senderRole, body } = params;
  const now = Date.now();
  const docRef = db.collection("messages").doc();
  await docRef.set({
    conversationId,
    senderRole,
    body,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
  });
  await db.collection("conversations").doc(conversationId).set(
    {
      lastMessageAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { id: docRef.id, conversationId, senderRole, body, createdAt: now };
}

async function enforceMessagingCapability(req: any, landlordId: string, res: any): Promise<boolean> {
  if (resolveRequestAuthority(req).isAdmin) {
    return true;
  }
  const cap = await requireCapability(landlordId, "messaging", req.user);
  if (!cap.ok) {
    res.status(403).json(buildUpgradeRequiredResponse({
      capability: "messaging",
      currentPlan: cap.plan,
      source: "messagesRoutes",
    }));
    return false;
  }
  return true;
}

/**
 * Landlord endpoints
 */
router.get("/landlord/messages/conversations", requireLandlord, async (req: any, res) => {
  const landlordId = getEffectiveLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, landlordId, res))) return;
  try {
    const snap = await db
      .collection("conversations")
      .where("landlordId", "==", landlordId)
      .orderBy("lastMessageAt", "desc")
      .limit(100)
      .get();

    const normalized = snap.docs.map(normalizeConversation);
    const items = (await enrichConversationDisplay(normalized)).map((c: any) => ({
      ...c,
      hasUnread:
        c.lastMessageAt != null &&
        (c.lastReadAtLandlord == null || c.lastMessageAt > c.lastReadAtLandlord),
    }));

    return res.json({ ok: true, conversations: items });
  } catch (err: any) {
    console.error("[messages] landlord conversations error", err);
    return res.status(500).json({ ok: false, error: "Failed to list conversations" });
  }
});

router.get("/landlord/messages/conversations/:id", requireLandlord, async (req: any, res) => {
  const landlordId = getEffectiveLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, landlordId, res))) return;
  const id = String(req.params?.id || "").trim();
  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = (await enrichConversationDisplay([normalizeConversation(convoSnap)]))[0];
    if (convo.landlordId !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });

    const msgSnap = await db
      .collection("messages")
      .where("conversationId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const messages = msgSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return res.json({ ok: true, conversation: convo, messages });
  } catch (err: any) {
    console.error("[messages] landlord convo messages error", err);
    return res.status(500).json({ ok: false, error: "Failed to load messages" });
  }
});

router.post("/landlord/messages/conversations/:id", requireLandlord, async (req: any, res) => {
  const landlordId = getEffectiveLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, landlordId, res))) return;
  const id = String(req.params?.id || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ ok: false, error: "body required" });
  if (body.length > 4000) return res.status(400).json({ ok: false, error: "body too long" });

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = (await enrichConversationDisplay([normalizeConversation(convoSnap)]))[0];
    if (convo.landlordId !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });

    const msg = await addMessage({ conversationId: id, senderRole: "landlord", body });
    try {
      await sendConversationMessageEmail({ conversation: convo, senderRole: "landlord", body });
    } catch (err: any) {
      console.error("[messages] landlord email send failed", {
        conversationId: id,
        landlordId,
        message: err?.message || "send_failed",
      });
    }
    return res.status(201).json({ ok: true, message: msg });
  } catch (err: any) {
    console.error("[messages] landlord send error", err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

router.post("/landlord/messages/conversations/:id/read", requireLandlord, async (req: any, res) => {
  const landlordId = getEffectiveLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, landlordId, res))) return;
  const id = String(req.params?.id || "").trim();
  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (convo.landlordId !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });

    await db
      .collection("conversations")
      .doc(id)
      .set({ lastReadAtLandlord: FieldValue.serverTimestamp() }, { merge: true });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[messages] landlord read error", err);
    return res.status(500).json({ ok: false, error: "Failed to mark read" });
  }
});

/**
 * Tenant endpoints
 */
function requireTenant(req: any, res: any, next: any) {
  return requireAuth(req, res, () => {
    if (!req.user || req.user.role !== "tenant") {
      return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
    }
    return next();
  });
}

function getTenantContext(req: any) {
  return {
    tenantId: getEffectiveTenantId(req),
    landlordId: resolveRequestAuthority(req).landlordId,
    unitId: req.user?.unitId || null,
  };
}

function tenantMatchesAuth(tenant: any, tenantId: string | null) {
  const target = stringOrNull(tenantId);
  if (!target) return false;
  return [
    tenant?.id,
    tenant?.tenantId,
    tenant?.userId,
    tenant?.uid,
    tenant?.raw?.tenantId,
    tenant?.raw?.userId,
    tenant?.raw?.uid,
  ]
    .map(stringOrNull)
    .some((value) => value === target);
}

function leaseMatchesTenant(lease: any, tenantId: string | null) {
  const target = stringOrNull(tenantId);
  if (!target) return false;
  const direct = stringOrNull(lease?.raw?.tenantId) || stringOrNull(lease?.tenantId);
  if (direct === target) return true;
  const tenantIds: any[] = Array.isArray(lease?.raw?.tenantIds) ? lease.raw.tenantIds : Array.isArray(lease?.tenantIds) ? lease.tenantIds : [];
  return tenantIds.map(stringOrNull).some((value) => value === target);
}

async function validateTenantConversationOwnership(
  conversation: ReturnType<typeof normalizeConversation>,
  ctx: ReturnType<typeof getTenantContext>,
  route: string
) {
  const tenantId = stringOrNull(ctx.tenantId);
  const landlordId = stringOrNull(ctx.landlordId);
  if (!tenantId || !landlordId || conversation.landlordId !== landlordId) {
    console.warn("[messages] tenant conversation ownership denied", {
      route,
      conversationId: conversation.id,
      tenantId,
      landlordId,
      reason: "scope_mismatch",
    });
    return false;
  }

  if (tenantMatchesAuth({ id: conversation.tenantId }, tenantId)) return true;

  const tenant = await loadTenantForConversation(conversation);
  if (tenantMatchesAuth(tenant, tenantId)) return true;

  const lease = await loadCurrentLeaseForConversation(conversation, tenant);
  if (leaseMatchesTenant(lease, tenantId)) return true;

  console.warn("[messages] tenant conversation ownership denied", {
    route,
    conversationId: conversation.id,
    tenantId,
    landlordId,
    reason: "tenant_not_resolved",
  });
  return false;
}

router.get("/tenant/messages/conversation", requireTenant, async (req: any, res) => {
  const ctx = getTenantContext(req);
  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, ctx.landlordId, res))) return;

  const docId = `${ctx.landlordId}__${ctx.tenantId}__${ctx.unitId || "na"}`;
  try {
    const ref = db.collection("conversations").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      const propertyId = await lookupPropertyIdForUnit(ctx.unitId);
      await ref.set({
        landlordId: ctx.landlordId,
        tenantId: ctx.tenantId,
        propertyId,
        unitId: ctx.unitId || null,
        createdAt: FieldValue.serverTimestamp(),
        lastMessageAt: null,
        lastReadAtLandlord: null,
        lastReadAtTenant: null,
      });
      const created = await ref.get();
      const enriched = (await enrichConversationDisplay([normalizeConversation(created)]))[0];
      if (!(await validateTenantConversationOwnership(enriched, ctx, "tenant.ensure.created"))) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }
      return res.json({ ok: true, conversation: enriched });
    }
    const enriched = (await enrichConversationDisplay([normalizeConversation(snap)]))[0];
    if (!(await validateTenantConversationOwnership(enriched, ctx, "tenant.ensure.existing"))) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    return res.json({ ok: true, conversation: enriched });
  } catch (err: any) {
    console.error("[messages] tenant get/create conversation error", err);
    return res.status(500).json({ ok: false, error: "Failed to load conversation" });
  }
});

router.get("/tenant/messages/conversation/:id", requireTenant, async (req: any, res) => {
  const ctx = getTenantContext(req);
  const id = String(req.params?.id || "").trim();
  const limitRaw = Number(req.query?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, ctx.landlordId, res))) return;

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = (await enrichConversationDisplay([normalizeConversation(convoSnap)]))[0];
    if (!(await validateTenantConversationOwnership(convo, ctx, "tenant.detail"))) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const msgSnap = await db
      .collection("messages")
      .where("conversationId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const messages = msgSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return res.json({ ok: true, conversation: convo, messages });
  } catch (err: any) {
    console.error("[messages] tenant conversation error", err);
    return res.status(500).json({ ok: false, error: "Failed to load messages" });
  }
});

router.post("/tenant/messages/conversation/:id", requireTenant, async (req: any, res) => {
  const ctx = getTenantContext(req);
  const id = String(req.params?.id || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, ctx.landlordId, res))) return;
  if (!body) return res.status(400).json({ ok: false, error: "body required" });
  if (body.length > 4000) return res.status(400).json({ ok: false, error: "body too long" });

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (!(await validateTenantConversationOwnership(convo, ctx, "tenant.send"))) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const msg = await addMessage({ conversationId: id, senderRole: "tenant", body });
    try {
      await sendConversationMessageEmail({ conversation: convo, senderRole: "tenant", body });
    } catch (err: any) {
      console.error("[messages] tenant email send failed", {
        conversationId: id,
        tenantId: ctx.tenantId,
        message: err?.message || "send_failed",
      });
    }
    return res.status(201).json({ ok: true, message: msg });
  } catch (err: any) {
    console.error("[messages] tenant send error", err);
    return res.status(500).json({ ok: false, error: "Failed to send message" });
  }
});

router.post("/tenant/messages/conversation/:id/read", requireTenant, async (req: any, res) => {
  const ctx = getTenantContext(req);
  const id = String(req.params?.id || "").trim();
  if (!ctx.tenantId || !ctx.landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!(await enforceMessagingCapability(req, ctx.landlordId, res))) return;

  try {
    const convoSnap = await db.collection("conversations").doc(id).get();
    if (!convoSnap.exists) return res.status(404).json({ ok: false, error: "Conversation not found" });
    const convo = normalizeConversation(convoSnap);
    if (!(await validateTenantConversationOwnership(convo, ctx, "tenant.read"))) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    await db
      .collection("conversations")
      .doc(id)
      .set({ lastReadAtTenant: FieldValue.serverTimestamp() }, { merge: true });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[messages] tenant read error", err);
    return res.status(500).json({ ok: false, error: "Failed to mark read" });
  }
});

export default router;
