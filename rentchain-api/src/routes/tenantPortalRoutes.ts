import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db } from "../config/firebase";

const router = Router();
router.use(authenticateJwt);

function requireTenant(req: any, res: any, next: any) {
  const user = req.user;
  if (!user || user.role !== "tenant" || !user.tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
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

    const leaseStart = toMillis(
      tenantData.leaseStart ??
        tenantData.lease_begin ??
        tenantData.leaseStartDate ??
        tenantData.createdAt ??
        null
    );
    const hasLeaseContext =
      Boolean(propertyId || propertyName) && Boolean(unitId || unitLabel);
    const leaseStatusRaw = String(
      tenantData.leaseStatus ?? tenantData.status ?? ""
    ).toLowerCase();
    const leaseStatus =
      hasLeaseContext && (leaseStatusRaw === "active" || leaseStatusRaw === "current")
        ? "Active"
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

router.get("/ledger", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

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
    console.error("[tenantPortalRoutes] /tenant/ledger error", err);
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

router.get("/lease", requireTenant, (_req: any, res) => {
  return res.json({
    ok: true,
    lease: {
      property: null,
      unit: null,
      leaseId: null,
      status: "active",
    },
  });
});

router.get("/payments", requireTenant, (_req: any, res) => {
  return res.json({ ok: true, items: [] });
});

router.get("/ledger", requireTenant, (_req: any, res) => {
  return res.json({ ok: true, items: [] });
});

router.get("/notices", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const snap = await db.collection("tenantNotices").where("tenantId", "==", tenantId).limit(50).get();
    const items = snap.docs.map((doc) => {
      const data = (doc.data() as any) || {};
      return {
        id: doc.id,
        type: data.type ?? "GENERAL",
        title: data.title ?? "Notice",
        effectiveAt: toMillis(data.effectiveAt),
        createdAt: toMillis(data.createdAt),
        status: data.status ?? "ACTIVE",
      };
    });
    items.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
    return res.json({ ok: true, data: items });
  } catch (err) {
    console.error("[tenant/notices] failed", {
      tenantId: req.user?.tenantId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTICES_FAILED" });
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
    try {
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      if (tenantSnap.exists) {
        const t = tenantSnap.data() as any;
        propertyId = t?.propertyId || t?.property || null;
        unitId = t?.unitId || t?.unit || null;
        landlordId = t?.landlordId || t?.ownerId || t?.owner || null;
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
    return res.json({ ok: true, data: { id: ref.id, ...doc } });
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
