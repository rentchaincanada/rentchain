import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db, FieldValue } from "../config/firebase";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";
import { getEnvFlags } from "../config/requiredEnv";
import { getAdminEmails } from "../lib/adminEmails";

const router = Router();
router.use(authenticateJwt);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireTenant(req: any, res: any, next: any) {
  const user = req.user;
  const role = String(user?.role || "").trim().toLowerCase();
  const tenantId = String(user?.tenantId || "").trim();
  if (!user || role !== "tenant" || !tenantId) {
    console.warn("[tenant-auth] denied", {
      path: req.originalUrl || req.path || "",
      reason: !user ? "missing_user" : role !== "tenant" ? "role_not_tenant" : "missing_tenant_id",
      role: role || null,
      tenantId: tenantId || null,
      hasAuthHeader: Boolean(req.headers?.authorization),
    });
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  console.info("[tenant-auth] granted", {
    path: req.originalUrl || req.path || "",
    tenantId,
    role,
  });
  return next();
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function makeCorrelationId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function timestampToSort(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? 0 : ts;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

type TenantCommunicationType = "notice" | "message" | "maintenance_update" | "system";

type TenantCommunicationItem = {
  id: string;
  type: TenantCommunicationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  priority: "low" | "normal" | "high";
  fromLabel: "Landlord" | "RentChain" | "Maintenance Team";
  relatedEntityType: "notice" | "maintenance" | "message" | null;
  relatedEntityId: string | null;
};

function isoFromMs(ms: number | null | undefined): string {
  const safe = typeof ms === "number" && Number.isFinite(ms) ? ms : Date.now();
  return new Date(safe).toISOString();
}

function truncateText(value: any, max = 220): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

async function getTenantConversationIds(tenantId: string): Promise<string[]> {
  const snap = await db
    .collection("conversations")
    .where("tenantId", "==", tenantId)
    .limit(20)
    .get();
  return snap.docs.map((doc) => doc.id);
}

async function getMessageReadMap(tenantId: string): Promise<Map<string, number>> {
  const snap = await db
    .collection("tenantMessageReads")
    .where("tenantId", "==", tenantId)
    .limit(500)
    .get();
  const map = new Map<string, number>();
  snap.docs.forEach((doc) => {
    const data = (doc.data() as any) || {};
    const messageId = String(data.messageId || "").trim();
    const readAtMs = Number(data.readAtMs || 0);
    if (messageId) map.set(messageId, readAtMs || Date.now());
  });
  return map;
}

async function getNoticeReadMap(tenantId: string): Promise<Map<string, number>> {
  const snap = await db
    .collection("tenantNoticeReads")
    .where("tenantId", "==", tenantId)
    .limit(500)
    .get();
  const map = new Map<string, number>();
  snap.docs.forEach((doc) => {
    const data = (doc.data() as any) || {};
    const noticeId = String(data.noticeId || "").trim();
    const readAtMs = Number(data.readAtMs || 0);
    if (noticeId) map.set(noticeId, readAtMs || Date.now());
  });
  return map;
}

async function buildTenantNoticeItems(tenantId: string): Promise<TenantCommunicationItem[]> {
  const [noticesSnap, readMap] = await Promise.all([
    db.collection("tenantNotices").where("tenantId", "==", tenantId).limit(100).get(),
    getNoticeReadMap(tenantId),
  ]);

  return noticesSnap.docs
    .map((doc) => {
      const data = (doc.data() as any) || {};
      const createdAtMs = toMillis(data.createdAt) ?? Date.now();
      const noticeId = doc.id;
      const typeRaw = String(data.type || "").toUpperCase();
      const priority: "low" | "normal" | "high" =
        typeRaw.includes("WARNING") || typeRaw.includes("LATE") ? "high" : "normal";
      return {
        id: noticeId,
        type: "notice" as const,
        title: String(data.title || "Notice"),
        body: String(data.body || ""),
        createdAt: isoFromMs(createdAtMs),
        read: readMap.has(noticeId),
        priority,
        fromLabel: "Landlord" as const,
        relatedEntityType: "notice" as const,
        relatedEntityId: noticeId,
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function buildTenantMessageItems(tenantId: string): Promise<TenantCommunicationItem[]> {
  const [conversationIds, readMap] = await Promise.all([
    getTenantConversationIds(tenantId),
    getMessageReadMap(tenantId),
  ]);

  if (!conversationIds.length) return [];

  const messageBatches = await Promise.all(
    conversationIds.map((conversationId) =>
      db
        .collection("messages")
        .where("conversationId", "==", conversationId)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get()
    )
  );

  const items: TenantCommunicationItem[] = [];
  messageBatches.forEach((batch) => {
    batch.docs.forEach((doc) => {
      const data = (doc.data() as any) || {};
      const messageId = doc.id;
      const createdAtMs = toMillis(data.createdAt ?? data.createdAtMs) ?? Date.now();
      const senderRole = String(data.senderRole || "").toLowerCase();
      const fromLabel =
        senderRole === "tenant" ? "RentChain" : senderRole === "landlord" ? "Landlord" : "RentChain";
      items.push({
        id: messageId,
        type: "message",
        title: senderRole === "landlord" ? "Message from landlord" : "Message update",
        body: String(data.body || ""),
        createdAt: isoFromMs(createdAtMs),
        read: readMap.has(messageId),
        priority: "normal",
        fromLabel: fromLabel as "Landlord" | "RentChain" | "Maintenance Team",
        relatedEntityType: "message",
        relatedEntityId: messageId,
      });
    });
  });

  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function buildTenantMaintenanceUpdateItems(tenantId: string): Promise<TenantCommunicationItem[]> {
  const [maintSnap, readMap] = await Promise.all([
    db.collection("maintenanceRequests").where("tenantId", "==", tenantId).limit(50).get(),
    getMessageReadMap(tenantId),
  ]);
  const highStatuses = new Set(["URGENT", "BLOCKED", "CANCELLED"]);

  const items = maintSnap.docs.map((doc) => {
    const data = (doc.data() as any) || {};
    const status = String(data.status || "NEW").toUpperCase();
    const createdAtMs = toMillis(data.updatedAt ?? data.createdAt) ?? Date.now();
    const syntheticId = `maintenance_${doc.id}_${createdAtMs}`;
    const title = `Maintenance update: ${String(data.title || "Request").trim() || "Request"}`;
    const body = `Status: ${status}${data.landlordNote ? ` — ${String(data.landlordNote)}` : ""}`;
    return {
      id: syntheticId,
      type: "maintenance_update" as const,
      title,
      body,
      createdAt: isoFromMs(createdAtMs),
      read: readMap.has(syntheticId),
      priority: highStatuses.has(status) ? ("high" as const) : ("normal" as const),
      fromLabel: "Maintenance Team" as const,
      relatedEntityType: "maintenance" as const,
      relatedEntityId: doc.id,
    };
  });

  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

router.get("/me", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    const tenantData = (tenantSnap.exists ? (tenantSnap.data() as any) : null) || {};

    let landlordId = tenantData.landlordId ?? req.user?.landlordId ?? null;
    let propertyId = tenantData.propertyId ?? req.user?.propertyId ?? null;
    let unitId = tenantData.unitId ?? tenantData.unit ?? req.user?.unitId ?? null;

    // Invite redemption timestamp takes precedence for joinedAt
    let joinedAt: number | null = null;
    try {
      const inviteSnap = await db
        .collection("tenantInvites")
        .where("tenantId", "==", tenantId)
        .limit(1)
        .get();
      const inviteDoc = inviteSnap.docs[0];
      if (inviteDoc?.exists) {
        const invite = inviteDoc.data() as any;
        joinedAt = toMillis(invite.redeemedAt ?? invite.createdAt ?? null);
      }
    } catch {
      joinedAt = null;
    }
    if (!joinedAt) {
      joinedAt = toMillis(tenantData.redeemedAt ?? tenantData.createdAt ?? null);
    }

    let propertyName: string | null = tenantData.propertyName ?? tenantData.property ?? null;
    if (propertyId) {
      try {
        const propSnap = await db.collection("properties").doc(propertyId).get();
        if (propSnap.exists) {
          const prop = propSnap.data() as any;
          propertyName = prop?.name ?? prop?.addressLine1 ?? propertyName ?? null;
          landlordId = landlordId ?? prop?.landlordId ?? prop?.ownerId ?? prop?.owner ?? null;
        }
      } catch {
        // ignore property lookup errors
      }
    }

    let unitLabel: string | null = tenantData.unit ?? null;
    if (unitId) {
      try {
        const unitSnap = await db.collection("units").doc(unitId).get();
        if (unitSnap.exists) {
          const unit = unitSnap.data() as any;
          unitLabel = unit?.unitNumber ?? unit?.label ?? unitLabel ?? null;
          propertyId = propertyId ?? unit?.propertyId ?? null;
          landlordId = landlordId ?? unit?.landlordId ?? null;
        }
      } catch {
        unitLabel = unitLabel ?? null;
      }
      if (!unitLabel && propertyName) {
        unitLabel = typeof tenantData.unit === "string" ? tenantData.unit : null;
      }
    }

    if (!propertyName && propertyId) {
      try {
        const propSnap = await db.collection("properties").doc(propertyId).get();
        if (propSnap.exists) {
          const prop = propSnap.data() as any;
          propertyName = prop?.name ?? prop?.addressLine1 ?? null;
          landlordId = landlordId ?? prop?.landlordId ?? prop?.ownerId ?? prop?.owner ?? null;
        }
      } catch {
        propertyName = propertyName ?? null;
      }
    }

    let landlordName: string | null = null;
    if (landlordId) {
      try {
        const llSnap = await db.collection("landlords").doc(landlordId).get();
        if (llSnap.exists) {
          const ll = llSnap.data() as any;
          landlordName = ll?.name ?? ll?.fullName ?? ll?.company ?? ll?.email ?? null;
        }
      } catch {
        landlordName = null;
      }
    }

    let tenancySnapshot: any | null = null;
    try {
      const tenanciesSnap = await db
        .collection("tenancies")
        .where("tenantId", "==", tenantId)
        .limit(20)
        .get();
      const records = tenanciesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      records.sort((a, b) => {
        const aActive = String(a?.status || "").toLowerCase() === "active" ? 1 : 0;
        const bActive = String(b?.status || "").toLowerCase() === "active" ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return (
          timestampToSort(b?.updatedAt ?? b?.createdAt) -
          timestampToSort(a?.updatedAt ?? a?.createdAt)
        );
      });
      tenancySnapshot = records[0] || null;
    } catch {
      tenancySnapshot = null;
    }

    if (tenancySnapshot) {
      propertyId = propertyId ?? tenancySnapshot.propertyId ?? null;
      unitId = unitId ?? tenancySnapshot.unitId ?? null;
      landlordId = landlordId ?? tenancySnapshot.landlordId ?? null;
      unitLabel = unitLabel ?? tenancySnapshot.unitLabel ?? null;
    }

    const leaseStart = toMillis(
      tenancySnapshot?.moveInAt ??
      tenantData.leaseStart ??
        tenantData.lease_begin ??
        tenantData.leaseStartDate ??
        tenantData.createdAt ??
        null
    );
    const leaseEnd = toMillis(tenancySnapshot?.moveOutAt ?? tenantData.leaseEnd ?? null);
    const hasLeaseContext =
      Boolean(propertyId || propertyName) && Boolean(unitId || unitLabel);
    const leaseStatusRaw = String(
      tenancySnapshot?.status ??
      tenantData.leaseStatus ?? tenantData.status ?? ""
    ).toLowerCase();
    const leaseStatus =
      hasLeaseContext && (leaseStatusRaw === "active" || leaseStatusRaw === "current")
        ? "Active"
        : hasLeaseContext && leaseStatusRaw === "inactive"
        ? "Inactive"
        : hasLeaseContext && leaseStatusRaw === "pending"
        ? "Pending"
        : "Unknown";
    const rentCents =
      hasLeaseContext && typeof tenantData.rentCents === "number"
        ? tenantData.rentCents
        : hasLeaseContext && typeof tenantData.monthlyRent === "number"
        ? Math.round(Number(tenantData.monthlyRent) * 100)
        : null;

    return res.json({
      ok: true,
      data: {
        tenant: {
          id: tenantId,
          shortId: tenantId.slice(0, 8),
          name: tenantData.fullName ?? tenantData.name ?? null,
          email: tenantData.email ?? req.user?.email ?? null,
          joinedAt,
          status: "Active",
        },
        landlord: { name: landlordName },
        property: { name: propertyName ?? null },
        unit: { label: unitLabel ?? null },
        lease: {
          status: leaseStatus,
          startDate: hasLeaseContext ? leaseStart : null,
          endDate: hasLeaseContext ? leaseEnd : null,
          rentCents,
          currency: hasLeaseContext ? tenantData.currency ?? null : null,
        },
      },
    });
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/me error", err);
    return res.status(500).json({ ok: false, error: "TENANT_ME_FAILED" });
  }
});

router.get("/activity", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const items: Array<{
      id: string;
      type: "invite" | "lease" | "rent" | "notice" | "system";
      title: string;
      description?: string;
      occurredAt: number;
    }> = [];

    let tenantData: any = {};
    try {
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      tenantData = tenantSnap.exists ? (tenantSnap.data() as any) : {};
    } catch {
      tenantData = {};
    }
    const tenantEmail = tenantData?.email ?? req.user?.email ?? null;

    // Invite redemption
    try {
      const inviteSnap = await db
        .collection("tenantInvites")
        .where("tenantId", "==", tenantId)
        .limit(1)
        .get();
      const doc = inviteSnap.docs[0];
      if (doc?.exists) {
        const inv = doc.data() as any;
        const occurredAt = toMillis(inv.redeemedAt ?? inv.createdAt ?? null);
        if (occurredAt) {
          items.push({
            id: `invite-${doc.id}`,
            type: "invite",
            title: "Invite accepted",
            description: tenantEmail ? `Joined as ${tenantEmail}` : "Invite accepted",
            occurredAt,
          });
        }
      }
    } catch {
      // ignore invite errors
    }

    // Lease start
    try {
      const data = tenantData || {};
      const propertyId = data?.propertyId ?? null;
      const unitId = data?.unitId ?? data?.unit ?? null;
      const leaseStart = toMillis(
        data?.leaseStart ?? data?.lease_begin ?? data?.leaseStartDate ?? null
      );
      if (propertyId && unitId && leaseStart) {
        let propertyName: string | null = data?.propertyName ?? data?.property ?? null;
        try {
          const propSnap = await db.collection("properties").doc(propertyId).get();
          if (propSnap.exists) {
            const prop = propSnap.data() as any;
            propertyName = prop?.name ?? prop?.addressLine1 ?? propertyName ?? null;
          }
        } catch {
          // ignore
        }
        items.push({
          id: `lease-${tenantId}-${leaseStart}`,
          type: "lease",
          title: "Lease started",
          description: propertyName ?? undefined,
          occurredAt: leaseStart,
        });
      }
    } catch {
      // ignore lease errors
    }

    // Ledger / rent events
    try {
      const { listEventsForTenant } = await import("../services/ledgerEventsService");
      const ledgerEvents = listEventsForTenant(tenantId).slice(0, 10);
      ledgerEvents.forEach((ev) => {
        const occurredAt = toMillis(ev.occurredAt);
        if (!occurredAt) return;
        const type: "rent" | "system" =
          ev.type.includes("charge") || ev.type.includes("payment") ? "rent" : "system";
        const title =
          ev.type === "charge_created" || ev.type === "charge_issued"
            ? "Rent charge issued"
            : ev.type === "payment_recorded" || ev.type === "payment_created"
            ? "Payment recorded"
            : "Account update";
        const description = ev.notes ?? ev.reference?.kind ?? undefined;
        items.push({
          id: `ledger-${ev.id}`,
          type,
          title,
          description,
          occurredAt,
        });
      });
    } catch {
      // ignore ledger errors
    }

    items.sort((a, b) => b.occurredAt - a.occurredAt);
    const limited = items.slice(0, 25);

    return res.json({ ok: true, data: limited });
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/activity error", err);
    return res.status(500).json({ ok: false, error: "TENANT_ACTIVITY_FAILED" });
  }
});

router.get("/messages", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const includeMaintenance = String(req.query?.includeMaintenance ?? "1") !== "0";
    const [messageItems, maintenanceItems] = await Promise.all([
      buildTenantMessageItems(tenantId),
      includeMaintenance ? buildTenantMaintenanceUpdateItems(tenantId) : Promise.resolve([]),
    ]);

    const items = [...messageItems, ...maintenanceItems]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 200);
    const unreadCount = items.filter((item) => !item.read).length;
    console.info("[tenant.messages.opened]", {
      tenantId,
      count: items.length,
      unreadCount,
    });
    return res.json({ ok: true, items, unreadCount });
  } catch (err: any) {
    console.error("[tenant/messages] failed", {
      tenantId: req.user?.tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MESSAGES_FAILED" });
  }
});

router.post("/messages/read-all", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const items = await buildTenantMessageItems(tenantId);
    const unread = items.filter((item) => !item.read).slice(0, 400);
    if (!unread.length) {
      console.info("[tenant.messages.read_all]", { tenantId, count: 0 });
      return res.json({ ok: true, updated: 0 });
    }

    const batch = db.batch();
    const now = Date.now();
    unread.forEach((item) => {
      const ref = db.collection("tenantMessageReads").doc(`${tenantId}_${item.id}`);
      batch.set(
        ref,
        {
          tenantId,
          messageId: item.id,
          readAtMs: now,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
    console.info("[tenant.messages.read_all]", { tenantId, count: unread.length });
    return res.json({ ok: true, updated: unread.length });
  } catch (err: any) {
    console.error("[tenant/messages/read-all] failed", {
      tenantId: req.user?.tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MESSAGES_READ_ALL_FAILED" });
  }
});

router.post("/messages/:id/read", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const messageId = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!messageId) return res.status(400).json({ ok: false, error: "MESSAGE_ID_REQUIRED" });

    const ref = db.collection("tenantMessageReads").doc(`${tenantId}_${messageId}`);
    await ref.set(
      {
        tenantId,
        messageId,
        readAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.info("[tenant.message.read]", { tenantId, messageId });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[tenant/messages/:id/read] failed", {
      tenantId: req.user?.tenantId,
      messageId: req.params?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MESSAGE_READ_FAILED" });
  }
});

router.get("/ledger", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    console.info("[tenant-ledger] request start", {
      tenantId,
      path: req.originalUrl || req.path || "",
      hasAuthHeader: Boolean(req.headers?.authorization),
      role: req.user?.role || null,
    });

    const { getTenantLedger } = await import("../services/tenantLedgerService");
    const entries = await getTenantLedger(tenantId);

    const toMillis = (v: any): number | null => {
      if (!v) return null;
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const ts = Date.parse(v);
        return Number.isNaN(ts) ? null : ts;
      }
      if (typeof v?.toMillis === "function") return v.toMillis();
      if (typeof v?.seconds === "number") return v.seconds * 1000;
      return null;
    };

    const normalizeAmount = (amount: any): number | null => {
      if (typeof amount !== "number" || Number.isNaN(amount)) return null;
      return Math.round(amount * 100);
    };

    const mapType = (t: string): "rent" | "fee" | "adjustment" | "payment" => {
      const type = (t || "").toLowerCase();
      if (type.includes("payment")) return "payment";
      if (type.includes("fee")) return "fee";
      if (type.includes("adjust")) return "adjustment";
      return "rent";
    };

    const toPeriod = (date: any): string | null => {
      const ts = toMillis(date);
      if (!ts) return null;
      const d = new Date(ts);
      const yyyy = d.getUTCFullYear();
      const mm = `${d.getUTCMonth() + 1}`.padStart(2, "0");
      return `${yyyy}-${mm}`;
    };

    const inferPurpose = (t: string): string | null => {
      const type = (t || "").toUpperCase();
      if (type.startsWith("RENT")) return "RENT";
      if (type.includes("LATE")) return "LATE_FEE";
      if (type.includes("FEE")) return "LATE_FEE";
      if (type.includes("DEPOSIT")) return "SECURITY_DEPOSIT";
      if (type.includes("PARK")) return "PARKING";
      if (type.includes("UTIL")) return "UTILITIES";
      return "OTHER";
    };

    const items = (entries || []).map((entry: any) => {
      const occurredAt = toMillis(entry.date ?? entry.occurredAt);
      const purpose =
        entry.purpose ??
        entry?.meta?.purpose ??
        inferPurpose(entry.type || "") ??
        "OTHER";
      const purposeLabel =
        entry.purposeLabel ?? entry?.meta?.purposeLabel ?? entry.period ?? null;
      return {
        id: entry.id,
        type: mapType(entry.type || ""),
        title:
          mapType(entry.type || "") === "payment"
            ? "Payment recorded"
            : mapType(entry.type || "") === "fee"
            ? "Fee recorded"
            : mapType(entry.type || "") === "adjustment"
            ? "Adjustment recorded"
            : "Rent recorded",
        description: entry.notes ?? entry.label ?? entry.description ?? undefined,
        amountCents: normalizeAmount(entry.amount),
        currency: entry.currency ?? null,
        period: entry.period ?? toPeriod(entry.date ?? entry.occurredAt),
        purpose: purpose ?? null,
        purposeLabel: purposeLabel ?? null,
        occurredAt: occurredAt ?? Date.now(),
      };
    });

    const fetchTenantEventsForLedger = async () => {
      try {
        return await db
          .collection("tenantEvents")
          .where("tenantId", "==", tenantId)
          .orderBy("occurredAt", "desc")
          .limit(50)
          .get();
      } catch {
        return db
          .collection("tenantEvents")
          .where("tenantId", "==", tenantId)
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();
      }
    };

    try {
      const isFinanceType = (t: string): boolean => {
        const x = (t || "").toUpperCase();
        return ["RENT", "FEE", "DEPOSIT", "PAY", "PAYMENT", "ADJUST", "CHARGE", "CREDIT", "DAMAGE", "PARK", "UTIL"].some(
          (k) => x.includes(k)
        );
      };
      const eventsSnap = await fetchTenantEventsForLedger();
      const eventItems =
        eventsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((ev) => isFinanceType(ev.type || ""))
          .map((ev) => {
            const occurredAt = toMillis(ev.occurredAt ?? ev.createdAt);
            const purpose = ev.purpose ?? inferPurpose(ev.type || "");
            const purposeLabel = ev.purposeLabel ?? ev.period ?? null;
            const mapType = (t: string): "rent" | "fee" | "adjustment" | "payment" => {
              const type = (t || "").toLowerCase();
              if (type.includes("payment") || type.includes("pay")) return "payment";
              if (type.includes("fee")) return "fee";
              if (type.includes("adjust") || type.includes("credit")) return "adjustment";
              return "rent";
            };
            const normalizeAmount = (amount: any): number | null => {
              if (typeof amount !== "number" || Number.isNaN(amount)) return null;
              return Math.round(amount * 100);
            };
            return {
              id: ev.id,
              type: mapType(ev.type || ""),
              title: ev.title || "Ledger entry",
              description: ev.description || undefined,
              amountCents: normalizeAmount(ev.amount ?? ev.amountCents),
              currency: ev.currency ?? null,
              period: ev.period ?? null,
              purpose: purpose ?? null,
              purposeLabel: purposeLabel ?? null,
              occurredAt: occurredAt ?? Date.now(),
            };
          }) || [];
      const mergedMap = new Map<string, any>();
      [...items, ...eventItems].forEach((it) => {
        if (!it?.id) return;
        mergedMap.set(it.id, it);
      });
      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => b.occurredAt - a.occurredAt);
      return res.json({ ok: true, data: merged.slice(0, 25) });
    } catch (err) {
      console.warn("[tenant/ledger] event bridge failed; returning base ledger", {
        tenantId,
        err: (err as any)?.message,
      });
      items.sort((a, b) => b.occurredAt - a.occurredAt);
      return res.json({ ok: true, data: items.slice(0, 25) });
    }
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/ledger error", {
      tenantId: req.user?.tenantId || null,
      path: req.originalUrl || req.path || "",
      message: (err as any)?.message || "failed",
      code: (err as any)?.code || null,
    });
    return res.status(500).json({ ok: false, error: "TENANT_LEDGER_FAILED" });
  }
});

router.get("/attachments", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const snap = await db
      .collection("ledgerAttachments")
      .where("tenantId", "==", tenantId)
      .limit(50)
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    data.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("[tenant/attachments] failed", {
      tenantId: req.user?.tenantId,
      err: (err as any)?.message,
      code: (err as any)?.code,
    });
    return res.status(500).json({ ok: false, error: "TENANT_ATTACHMENTS_FAILED" });
  }
});

router.get("/ledger/:ledgerItemId/attachments", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const ledgerItemId = String(req.params?.ledgerItemId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!ledgerItemId) return res.status(400).json({ ok: false, error: "ledgerItemId required" });

    const snap = await db
      .collection("ledgerAttachments")
      .where("tenantId", "==", tenantId)
      .where("ledgerItemId", "==", ledgerItemId)
      .limit(25)
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    data.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("[tenant/ledger/:id/attachments] failed", {
      tenantId: req.user?.tenantId,
      ledgerItemId: req.params?.ledgerItemId,
      err: (err as any)?.message,
      code: (err as any)?.code,
    });
    return res.status(500).json({ ok: false, error: "TENANT_ATTACHMENTS_FAILED" });
  }
});

router.get("/lease", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenantData = (tenantSnap.exists ? (tenantSnap.data() as any) : {}) || {};

    let propertyId = String(tenantData?.propertyId || "").trim() || null;
    let unitId = String(tenantData?.unitId || tenantData?.unit || "").trim() || null;
    let leaseId = String(tenantData?.leaseId || "").trim() || null;

    let leaseRecord: any = null;
    if (leaseId) {
      const leaseSnap = await db.collection("leases").doc(leaseId).get();
      if (leaseSnap.exists) {
        leaseRecord = leaseSnap.data() as any;
      }
    }
    if (!leaseRecord) {
      const leaseSnap = await db.collection("leases").where("tenantId", "==", tenantId).limit(20).get();
      const ranked = leaseSnap.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
        .sort((a, b) => {
          const aActive = ["signed", "active", "current"].includes(String(a?.status || "").toLowerCase()) ? 1 : 0;
          const bActive = ["signed", "active", "current"].includes(String(b?.status || "").toLowerCase()) ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          return Number(b?.updatedAt || b?.createdAt || 0) - Number(a?.updatedAt || a?.createdAt || 0);
        });
      if (ranked.length > 0) {
        leaseRecord = ranked[0];
        leaseId = leaseId || String(leaseRecord.id || "").trim() || null;
      }
    }

    propertyId = propertyId || String(leaseRecord?.propertyId || "").trim() || null;
    unitId =
      unitId ||
      String(leaseRecord?.unitId || leaseRecord?.unit || leaseRecord?.unitNumber || "").trim() ||
      null;

    let propertyName: string | null = null;
    if (propertyId) {
      const propertySnap = await db.collection("properties").doc(propertyId).get();
      if (propertySnap.exists) {
        const property = propertySnap.data() as any;
        propertyName = property?.name || property?.addressLine1 || null;
      }
    }

    let unitNumber: string | null = null;
    if (unitId) {
      const unitSnap = await db.collection("units").doc(unitId).get();
      if (unitSnap.exists) {
        const unit = unitSnap.data() as any;
        unitNumber = unit?.unitNumber || unit?.label || null;
        propertyId = propertyId || (unit?.propertyId ? String(unit.propertyId) : null);
      } else if (leaseRecord?.unitNumber) {
        unitNumber = String(leaseRecord.unitNumber);
      }
    }

    const rentAmount =
      typeof leaseRecord?.monthlyRent === "number"
        ? leaseRecord.monthlyRent
        : typeof tenantData?.monthlyRent === "number"
        ? tenantData.monthlyRent
        : typeof tenantData?.rentCents === "number"
        ? tenantData.rentCents / 100
        : null;

    const lease = {
      leaseId,
      propertyId,
      propertyName,
      unitId,
      unitNumber,
      rentAmount,
      leaseStart:
        leaseRecord?.startDate || leaseRecord?.leaseStart || tenantData?.leaseStart || tenantData?.leaseStartDate || null,
      leaseEnd: leaseRecord?.endDate || tenantData?.leaseEnd || null,
      status: leaseRecord?.status || tenantData?.leaseStatus || tenantData?.status || null,
    };

    return res.json({ ok: true, lease, ...lease });
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/lease error", err);
    return res.status(500).json({ ok: false, error: "TENANT_LEASE_FAILED" });
  }
});

router.get("/payments", requireTenant, (_req: any, res) => {
  return res.json({ ok: true, items: [] });
});

router.get("/ledger", requireTenant, (_req: any, res) => {
  return res.json({ ok: true, items: [] });
});

router.get("/notices", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const items = await buildTenantNoticeItems(tenantId);
    const unreadCount = items.filter((item) => !item.read).length;
    console.info("[tenant.notices.opened]", {
      tenantId,
      count: items.length,
      unreadCount,
    });
    return res.json({ ok: true, items, unreadCount, data: items });
  } catch (err) {
    console.error("[tenant/notices] failed", {
      tenantId: req.user?.tenantId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTICES_FAILED" });
  }
});

router.post("/notices/:noticeId/read", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const noticeId = String(req.params?.noticeId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!noticeId) return res.status(400).json({ ok: false, error: "NOTICE_ID_REQUIRED" });

    const noticeDoc = await db.collection("tenantNotices").doc(noticeId).get();
    if (!noticeDoc.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const noticeData = (noticeDoc.data() as any) || {};
    if (noticeData.tenantId && noticeData.tenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    await db
      .collection("tenantNoticeReads")
      .doc(`${tenantId}_${noticeId}`)
      .set(
        {
          tenantId,
          noticeId,
          readAtMs: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    console.info("[tenant.notice.read]", { tenantId, noticeId });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[tenant/notices/:noticeId/read] failed", {
      tenantId: req.user?.tenantId,
      noticeId: req.params?.noticeId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTICE_READ_FAILED" });
  }
});

router.get("/notices/:noticeId", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const noticeId = String(req.params?.noticeId || "").trim();
    if (!noticeId) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const doc = await db.collection("tenantNotices").doc(noticeId).get();
    if (!doc.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = (doc.data() as any) || {};
    const docTenantId = data.tenantId ?? data.tenant ?? null;
    if (docTenantId && docTenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const payload = {
      id: doc.id,
      landlordId: data.landlordId ?? null,
      tenantId: docTenantId ?? null,
      type: data.type ?? "GENERAL",
      title: data.title ?? "Notice",
      body: data.body ?? "",
      effectiveAt: toMillis(data.effectiveAt),
      createdAt: toMillis(data.createdAt) ?? Date.now(),
      createdBy: data.createdBy ?? null,
      status: data.status ?? "ACTIVE",
    };
    return res.json({ ok: true, data: payload });
  } catch (err) {
    console.error("[tenant/notices/:noticeId] failed", {
      tenantId: req.user?.tenantId,
      noticeId: req.params?.noticeId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTICE_READ_FAILED" });
  }
});

router.get("/communication/summary", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const [messages, notices, maintenance] = await Promise.all([
      buildTenantMessageItems(tenantId),
      buildTenantNoticeItems(tenantId),
      buildTenantMaintenanceUpdateItems(tenantId),
    ]);
    const unreadMessages = messages.filter((item) => !item.read).length;
    const unreadNotices = notices.filter((item) => !item.read).length;
    const unreadMaintenanceUpdates = maintenance.filter((item) => !item.read).length;
    return res.json({
      ok: true,
      unreadMessages,
      unreadNotices,
      unreadMaintenanceUpdates,
      unreadTotal: unreadMessages + unreadNotices + unreadMaintenanceUpdates,
    });
  } catch (err: any) {
    console.error("[tenant/communication/summary] failed", {
      tenantId: req.user?.tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_COMM_SUMMARY_FAILED" });
  }
});

router.post("/maintenance-requests", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const { category, priority, title, description, tenantContact } = req.body || {};
    const trimmedTitle = typeof title === "string" ? title.trim().slice(0, 120) : "";
    const trimmedDescription = typeof description === "string" ? description.trim().slice(0, 5000) : "";
    const normalizedCategory = typeof category === "string" ? category.trim().toUpperCase() : "GENERAL";
    const normalizedPriority = typeof priority === "string" ? priority.trim().toUpperCase() : "NORMAL";
    const allowedCategories = [
      "PLUMBING",
      "ELECTRICAL",
      "HVAC",
      "APPLIANCE",
      "PEST",
      "CLEANING",
      "GENERAL",
      "OTHER",
    ];
    const allowedPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
    if (!trimmedTitle || !trimmedDescription) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }
    const categorySafe = allowedCategories.includes(normalizedCategory) ? normalizedCategory : "GENERAL";
    const prioritySafe = allowedPriorities.includes(normalizedPriority) ? normalizedPriority : "NORMAL";

    // Derive property/unit/landlord from tenant doc when possible
    let propertyId: string | null = null;
    let unitId: string | null = null;
    let landlordId: string | null = null;
    let tenantName: string | null = null;
    let tenantEmail: string | null = null;
    try {
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      if (tenantSnap.exists) {
        const t = tenantSnap.data() as any;
        propertyId = t?.propertyId || t?.property || null;
        unitId = t?.unitId || t?.unit || null;
        landlordId = t?.landlordId || t?.ownerId || t?.owner || null;
        tenantName = t?.fullName || t?.name || null;
        tenantEmail = t?.email || null;
      }
    } catch {
      // ignore lookup errors
    }

    const now = Date.now();
    const contact = typeof tenantContact === "object" && tenantContact !== null ? tenantContact : null;
    const doc = {
      landlordId,
      tenantId,
      propertyId,
      unitId,
      category: categorySafe,
      priority: prioritySafe,
      title: trimmedTitle,
      description: trimmedDescription,
      status: "NEW",
      tenantContact: {
        phone: contact?.phone ?? null,
        preferredTimes: contact?.preferredTimes ?? null,
      },
      createdAt: now,
      updatedAt: now,
      lastUpdatedBy: "TENANT",
      landlordNote: null,
    };

    const ref = await db.collection("maintenanceRequests").add(doc);

    let emailed = false;
    let emailError: string | undefined;
    const envFlags = getEnvFlags();
    const maintenanceNotifyEmail = String(process.env.MAINTENANCE_NOTIFY_EMAIL || "").trim();
    const adminEmails = getAdminEmails().filter((e) => emailRegex.test(e));
    let landlordEmail: string | null = null;

    if (landlordId) {
      try {
        const userSnap = await db.collection("users").doc(landlordId).get();
        if (userSnap.exists) {
          const u = userSnap.data() as any;
          landlordEmail = u?.email || landlordEmail;
        }
      } catch {
        // ignore lookup errors
      }
      if (!landlordEmail) {
        try {
          const llSnap = await db.collection("landlords").doc(landlordId).get();
          if (llSnap.exists) {
            const ll = llSnap.data() as any;
            landlordEmail = ll?.email || landlordEmail;
          }
        } catch {
          // ignore lookup errors
        }
      }
    }

    const recipients: string[] = [];
    if (maintenanceNotifyEmail && emailRegex.test(maintenanceNotifyEmail)) {
      recipients.push(maintenanceNotifyEmail);
    } else if (landlordEmail && emailRegex.test(landlordEmail)) {
      recipients.push(landlordEmail);
    } else if (adminEmails.length > 0) {
      recipients.push(...adminEmails);
    }

    if (recipients.length === 0) {
      emailError = "MISSING_RECIPIENT_EMAIL";
    } else if (!envFlags.emailConfigured) {
      emailError = "EMAIL_NOT_CONFIGURED";
    } else {
      const from =
        process.env.EMAIL_FROM ||
        process.env.SENDGRID_FROM_EMAIL ||
        process.env.SENDGRID_FROM ||
        process.env.FROM_EMAIL;
      const replyTo =
        process.env.EMAIL_REPLY_TO ||
        process.env.SENDGRID_REPLY_TO ||
        process.env.SENDGRID_REPLYTO_EMAIL;
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
      const requestLink = `${baseUrl}/maintenance`;
      const excerpt =
        trimmedDescription.length > 400 ? `${trimmedDescription.slice(0, 400)}...` : trimmedDescription;

      if (!from) {
        emailError = "EMAIL_NOT_CONFIGURED";
      } else {
        try {
          await sendEmail({
            to: recipients,
            from,
            replyTo: replyTo || from,
            subject: `New maintenance request: ${trimmedTitle}`,
            text: buildEmailText({
              intro: `A tenant submitted a new maintenance request.\nTenant: ${tenantName || "Unknown"}${tenantEmail ? ` (${tenantEmail})` : ""}\nCategory: ${categorySafe}\nPriority: ${prioritySafe}\nRequest ID: ${ref.id}\n\n${excerpt}`,
              ctaText: "Open maintenance",
              ctaUrl: requestLink,
            }),
            html: buildEmailHtml({
              title: "New maintenance request",
              intro: `Tenant: ${tenantName || "Unknown"}${tenantEmail ? ` (${tenantEmail})` : ""}. Category: ${categorySafe}. Priority: ${prioritySafe}. Request ID: ${ref.id}.`,
              ctaText: "Open maintenance",
              ctaUrl: requestLink,
            }),
          });
          emailed = true;
        } catch (err: any) {
          const correlationId = makeCorrelationId("maint_mail");
          emailed = false;
          emailError = err?.message || "SEND_FAILED";
          console.error("[tenant/maintenance-requests] email send failed", {
            provider: envFlags.emailProvider,
            correlationId,
            requestId: ref.id,
            landlordId,
            message: err?.message || "send_failed",
          });
        }
      }
    }

    return res.json({ ok: true, data: { id: ref.id, ...doc }, emailed, emailError });
  } catch (err) {
    console.error("[tenant/maintenance-requests] create failed", {
      tenantId: req.user?.tenantId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUEST_CREATE_FAILED" });
  }
});

router.get("/maintenance-requests", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const snap = await db.collection("maintenanceRequests").where("tenantId", "==", tenantId).limit(50).get();
    const items = snap.docs.map((d) => {
      const data = (d.data() as any) || {};
      return {
        id: d.id,
        status: data.status ?? "NEW",
        priority: data.priority ?? "NORMAL",
        category: data.category ?? "GENERAL",
        title: data.title ?? "",
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt),
      };
    });
    items.sort((a, b) => (Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0));
    return res.json({ ok: true, data: items });
  } catch (err) {
    console.error("[tenant/maintenance-requests] list failed", {
      tenantId: req.user?.tenantId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUESTS_FAILED" });
  }
});

router.get("/maintenance-requests/:id", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const doc = await db.collection("maintenanceRequests").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = (doc.data() as any) || {};
    if (data.tenantId && data.tenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const payload = {
      id: doc.id,
      landlordId: data.landlordId ?? null,
      tenantId: data.tenantId ?? null,
      propertyId: data.propertyId ?? null,
      unitId: data.unitId ?? null,
      category: data.category ?? "GENERAL",
      priority: data.priority ?? "NORMAL",
      title: data.title ?? "",
      description: data.description ?? "",
      status: data.status ?? "NEW",
      tenantContact: data.tenantContact ?? null,
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
      lastUpdatedBy: data.lastUpdatedBy ?? "TENANT",
    };
    return res.json({ ok: true, data: payload });
  } catch (err) {
    console.error("[tenant/maintenance-requests/:id] read failed", {
      tenantId: req.user?.tenantId,
      id: req.params?.id,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUEST_READ_FAILED" });
  }
});

export default router;
