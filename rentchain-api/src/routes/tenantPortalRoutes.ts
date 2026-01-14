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
            description: inv.tenantEmail ? `Joined as ${inv.tenantEmail}` : undefined,
            occurredAt,
          });
        }
      }
    } catch {
      // ignore invite errors
    }

    // Lease start
    try {
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      const data = tenantSnap.exists ? (tenantSnap.data() as any) : {};
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

export default router;
