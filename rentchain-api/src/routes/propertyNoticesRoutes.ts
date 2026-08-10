import { createHash } from "node:crypto";
import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireLandlord } from "../middleware/requireLandlord";
import { previewQaAuth, type PreviewQaRoute } from "../middleware/previewQaAuth";
import { db, FieldValue } from "../firebase";
import { getEffectiveLandlordId, resolveRequestAuthority } from "../auth/requestAuthority";
import { isCurrentLeaseStatus } from "../services/leaseCanonicalizationService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";

const router = Router();
export const previewQaPropertyNoticesRoutes = Router();

const MAX_NOTICE_RECIPIENTS = 100;
const MAX_NOTICE_LEASES = 101;
const MAX_NOTICE_HISTORY = 50;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(text).filter((item): item is string => Boolean(item)))).sort();
}

function tenantIdsForLease(raw: any): string[] {
  return Array.from(
    new Set([raw?.tenantId, ...(Array.isArray(raw?.tenantIds) ? raw.tenantIds : [])]
      .map(text)
      .filter((item): item is string => Boolean(item)))
  ).sort();
}

function tenantEmail(raw: any): string | null {
  const candidate = text(raw?.email || raw?.emailAddress || raw?.primaryEmail)?.toLowerCase() || null;
  return candidate && emailPattern.test(candidate) ? candidate : null;
}

function isArchived(raw: any): boolean {
  return Boolean(raw?.archivedAt) || String(raw?.status || "").toLowerCase() === "archived" ||
    String(raw?.portfolioStatus || "").toLowerCase() === "archived";
}

function propertyLabel(raw: any): string {
  return text(raw?.name) || text(raw?.addressLine1) || "Property";
}

function unitLabel(raw: any): string {
  return text(raw?.unitNumber || raw?.unitLabel || raw?.label || raw?.name) || "Unit";
}

function noticeId(landlordId: string, idempotencyKey: string): string {
  return `notice_${createHash("sha256").update(`${landlordId}:${idempotencyKey}`).digest("hex")}`;
}

function deliveryId(campaignId: string, tenantId: string): string {
  return `delivery_${createHash("sha256").update(`${campaignId}:${tenantId}`).digest("hex")}`;
}

function timestampMillis(value: any): number | null {
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

type ResolvedRecipient = {
  tenantId: string;
  tenantDisplayName: string;
  email: string | null;
  unitIds: string[];
  unitLabels: string[];
  leaseIds: string[];
  deliveryAvailability: "available" | "missing_email" | "duplicate_destination";
};

async function resolveRecipients(params: {
  landlordId: string;
  propertyId: string;
  selectedUnitIds?: string[];
  selectedTenantIds?: string[];
}) {
  const propertySnap = await db.collection("properties").doc(params.propertyId).get();
  if (!propertySnap.exists) return { kind: "not_found" as const };
  const property = propertySnap.data() as any;
  if (text(property?.landlordId) !== params.landlordId || isArchived(property)) {
    return { kind: "forbidden" as const };
  }

  const leaseSnap = await db.collection("leases")
    .where("propertyId", "==", params.propertyId)
    .limit(MAX_NOTICE_LEASES)
    .get();
  if (leaseSnap.docs.length >= MAX_NOTICE_LEASES) return { kind: "too_many" as const };

  const selectedUnits = new Set(params.selectedUnitIds || []);
  const selectedTenants = new Set(params.selectedTenantIds || []);
  const candidates: Array<{ leaseId: string; tenantId: string; unitId: string }> = [];
  for (const leaseDoc of leaseSnap.docs) {
    const lease = leaseDoc.data() as any;
    const unitId = text(lease?.unitId);
    if (text(lease?.landlordId) !== params.landlordId || !isCurrentLeaseStatus(lease?.status) || !unitId) continue;
    if (selectedUnits.size && !selectedUnits.has(unitId)) continue;
    for (const tenantId of tenantIdsForLease(lease)) {
      if (!selectedTenants.size || selectedTenants.has(tenantId)) candidates.push({ leaseId: leaseDoc.id, tenantId, unitId });
    }
  }

  const uniqueUnitIds = Array.from(new Set(candidates.map((candidate) => candidate.unitId))).sort();
  const uniqueTenantIds = Array.from(new Set(candidates.map((candidate) => candidate.tenantId))).sort();
  if (uniqueTenantIds.length > MAX_NOTICE_RECIPIENTS) return { kind: "too_many" as const };

  const [unitEntries, tenantEntries] = await Promise.all([
    Promise.all(uniqueUnitIds.map(async (id) => [id, await db.collection("units").doc(id).get()] as const)),
    Promise.all(uniqueTenantIds.map(async (id) => [id, await db.collection("tenants").doc(id).get()] as const)),
  ]);
  const units = new Map(unitEntries);
  const tenants = new Map(tenantEntries);
  const byTenant = new Map<string, ResolvedRecipient>();

  for (const candidate of candidates) {
    const unitSnap = units.get(candidate.unitId);
    const tenantSnap = tenants.get(candidate.tenantId);
    if (!unitSnap?.exists || !tenantSnap?.exists) continue;
    const unit = unitSnap.data() as any;
    const tenant = tenantSnap.data() as any;
    if (text(unit?.propertyId) !== params.propertyId) continue;
    if (text(unit?.landlordId) && text(unit?.landlordId) !== params.landlordId) continue;
    if (text(tenant?.landlordId) && text(tenant?.landlordId) !== params.landlordId) continue;
    if (isArchived(tenant)) continue;

    const existing = byTenant.get(candidate.tenantId) || {
      tenantId: candidate.tenantId,
      tenantDisplayName: text(tenant?.fullName || tenant?.name) || "Tenant",
      email: tenantEmail(tenant),
      unitIds: [],
      unitLabels: [],
      leaseIds: [],
      deliveryAvailability: tenantEmail(tenant) ? "available" as const : "missing_email" as const,
    };
    existing.unitIds = Array.from(new Set([...existing.unitIds, candidate.unitId])).sort();
    existing.unitLabels = Array.from(new Set([...existing.unitLabels, unitLabel(unit)])).sort();
    existing.leaseIds = Array.from(new Set([...existing.leaseIds, candidate.leaseId])).sort();
    byTenant.set(candidate.tenantId, existing);
  }

  const recipients = Array.from(byTenant.values()).sort((a, b) =>
    [a.tenantDisplayName, a.tenantId].join("\0").localeCompare([b.tenantDisplayName, b.tenantId].join("\0"))
  );
  const destinationOwner = new Map<string, string>();
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    const owner = destinationOwner.get(recipient.email);
    if (owner) recipient.deliveryAvailability = "duplicate_destination";
    else destinationOwner.set(recipient.email, recipient.tenantId);
  }
  if (recipients.length > MAX_NOTICE_RECIPIENTS) return { kind: "too_many" as const };
  return { kind: "ok" as const, propertyLabel: propertyLabel(property), recipients };
}

function parseFilters(value: any) {
  return {
    selectedUnitIds: ids(value?.selectedUnitIds),
    selectedTenantIds: ids(value?.selectedTenantIds),
  };
}

function publicRecipient(recipient: ResolvedRecipient) {
  return {
    tenantId: recipient.tenantId,
    tenantDisplayName: recipient.tenantDisplayName,
    unitIds: recipient.unitIds,
    unitLabels: recipient.unitLabels,
    deliveryAvailability: recipient.deliveryAvailability,
  };
}

function publicNotice(id: string, raw: any) {
  const { landlordId: _landlordId, idempotencyKeyHash: _hash, ...notice } = raw || {};
  return { id, ...notice };
}

async function requireResolved(req: any, res: any) {
  const landlordId = getEffectiveLandlordId(req);
  const propertyId = text(req.method === "GET" ? req.query?.propertyId : req.body?.propertyId);
  if (!landlordId) { res.status(401).json({ ok: false, error: "Unauthorized" }); return null; }
  if (!propertyId) { res.status(400).json({ ok: false, error: "propertyId required" }); return null; }
  const filterSource = req.method === "GET" ? {
    selectedUnitIds: String(req.query?.unitIds || "").split(",").filter(Boolean),
    selectedTenantIds: String(req.query?.tenantIds || "").split(",").filter(Boolean),
  } : req.body;
  const result = await resolveRecipients({ landlordId, propertyId, ...parseFilters(filterSource) });
  if (result.kind === "not_found") { res.status(404).json({ ok: false, error: "Property not found" }); return null; }
  if (result.kind === "forbidden") { res.status(403).json({ ok: false, error: "Property unavailable" }); return null; }
  if (result.kind === "too_many") {
    res.status(422).json({ ok: false, error: "Recipient limit exceeded", maxRecipients: MAX_NOTICE_RECIPIENTS });
    return null;
  }
  return { landlordId, propertyId, ...result };
}

const handleNoticeRecipients = async (req: any, res: any) => {
  try {
    const resolved = await requireResolved(req, res);
    if (!resolved) return;
    const availableCount = resolved.recipients.filter((recipient) => recipient.deliveryAvailability === "available").length;
    return res.json({
      ok: true,
      property: { id: resolved.propertyId, label: resolved.propertyLabel },
      recipients: resolved.recipients.map(publicRecipient),
      counts: { total: resolved.recipients.length, available: availableCount, skipped: resolved.recipients.length - availableCount },
      maxRecipients: MAX_NOTICE_RECIPIENTS,
    });
  } catch (error: any) {
    console.error("[property-notices] preview failed", { code: text(error?.code) || "preview_failed" });
    return res.status(500).json({ ok: false, error: "Failed to preview notice recipients" });
  }
};

const handleNoticeCreate = async (req: any, res: any) => {
  if ("landlordId" in (req.body || {}) || "recipientEmails" in (req.body || {}) || "recipients" in (req.body || {})) {
    return res.status(400).json({ ok: false, error: "Unsupported recipient authority fields" });
  }
  const subject = text(req.body?.subject);
  const body = text(req.body?.body);
  const idempotencyKey = text(req.body?.idempotencyKey);
  if (!subject || subject.length > 160) return res.status(400).json({ ok: false, error: "Valid subject required" });
  if (!body || body.length > 10000) return res.status(400).json({ ok: false, error: "Valid body required" });
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) {
    return res.status(400).json({ ok: false, error: "Valid idempotencyKey required" });
  }

  try {
    const resolved = await requireResolved(req, res);
    if (!resolved) return;
    if (!resolved.recipients.length || !resolved.recipients.some((item) => item.deliveryAvailability === "available")) {
      return res.status(422).json({ ok: false, error: "No deliverable recipients" });
    }
    const campaignId = noticeId(resolved.landlordId, idempotencyKey);
    const campaignRef = db.collection("propertyNotices").doc(campaignId);
    const now = Date.now();
    const actorId = resolveRequestAuthority(req).actorId;
    const created = await db.runTransaction(async (transaction: any) => {
      const existing = await transaction.get(campaignRef);
      if (existing.exists) return false;
      transaction.set(campaignRef, {
        landlordId: resolved.landlordId,
        propertyId: resolved.propertyId,
        propertyLabel: resolved.propertyLabel,
        subject,
        body,
        createdBy: actorId,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
        status: "sending",
        idempotencyKeyHash: createHash("sha256").update(idempotencyKey).digest("hex"),
        filters: parseFilters(req.body),
        recipientCount: resolved.recipients.length,
        sentCount: 0,
        failedCount: 0,
        skippedCount: resolved.recipients.filter((item) => item.deliveryAvailability !== "available").length,
      });
      for (const recipient of resolved.recipients) {
        transaction.set(db.collection("propertyNoticeDeliveries").doc(deliveryId(campaignId, recipient.tenantId)), {
          noticeId: campaignId,
          landlordId: resolved.landlordId,
          propertyId: resolved.propertyId,
          tenantId: recipient.tenantId,
          tenantDisplayName: recipient.tenantDisplayName,
          unitIds: recipient.unitIds,
          unitLabels: recipient.unitLabels,
          leaseIds: recipient.leaseIds,
          channel: "email",
          destination: recipient.email,
          status: recipient.deliveryAvailability === "available" ? "pending" : "skipped",
          errorCategory: recipient.deliveryAvailability === "available" ? null : recipient.deliveryAvailability,
          attemptCount: 0,
          createdAt: FieldValue.serverTimestamp(),
          createdAtMs: now,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return true;
    });
    if (!created) {
      const existing = await campaignRef.get();
      return res.status(200).json({ ok: true, created: false, notice: publicNotice(campaignId, existing.data()) });
    }

    let sentCount = 0;
    let failedCount = 0;
    const from = text(process.env.EMAIL_FROM || process.env.FROM_EMAIL);
    for (const recipient of resolved.recipients.filter((item) => item.deliveryAvailability === "available")) {
      const ref = db.collection("propertyNoticeDeliveries").doc(deliveryId(campaignId, recipient.tenantId));
      try {
        if (!from || !recipient.email) throw Object.assign(new Error("configuration_error"), { category: "configuration_error" });
        const result = await sendEmail({
          to: recipient.email,
          from,
          replyTo: from,
          subject: `Operational Notice: ${subject}`,
          text: buildEmailText({ intro: body, ctaText: "Open RentChain", ctaUrl: process.env.PUBLIC_APP_URL || "https://www.rentchain.ai", footerNote: "For general property communications. Formal tenancy notices follow a separate process." }),
          html: buildEmailHtml({ title: `Operational Notice: ${subject}`, intro: body, ctaText: "Open RentChain", ctaUrl: process.env.PUBLIC_APP_URL || "https://www.rentchain.ai", footerNote: "For general property communications. Formal tenancy notices follow a separate process." }),
          metadata: { noticeId: campaignId, deliveryId: ref.id },
        });
        sentCount += 1;
        await ref.set({ status: "sent", providerReference: result.providerMessageId, attemptCount: 1, sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } catch (error: any) {
        failedCount += 1;
        const raw = String(error?.category || error?.message || "").toLowerCase();
        const errorCategory = raw.includes("configuration") || raw.includes("missing") ? "configuration_error" :
          raw.includes("invalid") ? "invalid_destination" : raw.includes("429") || raw.includes("timeout") ? "transient_provider_error" :
          raw.includes("reject") || raw.includes("mailgun") ? "provider_rejected" : "unknown";
        await ref.set({ status: "failed", errorCategory, attemptCount: 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    }
    const skippedCount = resolved.recipients.length - sentCount - failedCount;
    const status = failedCount === 0 && skippedCount === 0 ? "completed" : sentCount > 0 ? "partially_failed" : "failed";
    await campaignRef.set({ status, sentCount, failedCount, skippedCount, updatedAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp() }, { merge: true });
    const final = await campaignRef.get();
    return res.status(201).json({ ok: true, created: true, notice: publicNotice(campaignId, final.data()) });
  } catch (error: any) {
    console.error("[property-notices] send failed", { code: text(error?.code) || "send_failed" });
    return res.status(500).json({ ok: false, error: "Failed to send notice" });
  }
};

const handleNoticeList = async (req: any, res: any) => {
  const landlordId = getEffectiveLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const requestedLimit = Number(req.query?.limit || 25);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(MAX_NOTICE_HISTORY, Math.floor(requestedLimit))) : 25;
  const snap = await db.collection("propertyNotices").where("landlordId", "==", landlordId).limit(MAX_NOTICE_HISTORY).get();
  const notices = snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a: any, b: any) => (timestampMillis(b.createdAt) || b.createdAtMs || 0) - (timestampMillis(a.createdAt) || a.createdAtMs || 0))
    .slice(0, limit)
    .map((notice: any) => publicNotice(notice.id, notice));
  return res.json({ ok: true, notices, nextCursor: null });
};

const handleNoticeDetail = async (req: any, res: any) => {
  const landlordId = getEffectiveLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const noticeSnap = await db.collection("propertyNotices").doc(String(req.params.noticeId)).get();
  if (!noticeSnap.exists) return res.status(404).json({ ok: false, error: "Notice not found" });
  const notice = noticeSnap.data() as any;
  if (text(notice?.landlordId) !== landlordId) return res.status(403).json({ ok: false, error: "Forbidden" });
  const deliveriesSnap = await db.collection("propertyNoticeDeliveries").where("noticeId", "==", noticeSnap.id).limit(MAX_NOTICE_RECIPIENTS + 1).get();
  const deliveries = deliveriesSnap.docs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .filter((delivery: any) => text(delivery.landlordId) === landlordId)
    .sort((a: any, b: any) => String(a.tenantDisplayName || "").localeCompare(String(b.tenantDisplayName || "")))
    .map(({ landlordId: _landlordId, destination: _destination, leaseIds: _leaseIds, ...delivery }: any) => delivery);
  const { landlordId: _landlordId, idempotencyKeyHash: _hash, ...safeNotice } = notice;
  return res.json({ ok: true, notice: { id: noticeSnap.id, ...safeNotice }, deliveries });
};

function authFor(route: PreviewQaRoute) {
  return [previewQaAuth(route), authenticateJwt, requireLandlord] as const;
}

function registerPropertyNoticeRoutes(target: Router) {
  target.get(
    "/landlord/notices/recipients",
    ...authFor("landlord-notice-recipients"),
    handleNoticeRecipients
  );
  target.post(
    "/landlord/notices",
    ...authFor("landlord-notice-create"),
    handleNoticeCreate
  );
  target.get(
    "/landlord/notices",
    ...authFor("landlord-notice-list"),
    handleNoticeList
  );
  target.get(
    "/landlord/notices/:noticeId",
    ...authFor("landlord-notice-detail"),
    handleNoticeDetail
  );
}

registerPropertyNoticeRoutes(previewQaPropertyNoticesRoutes);
registerPropertyNoticeRoutes(router);

export default router;
