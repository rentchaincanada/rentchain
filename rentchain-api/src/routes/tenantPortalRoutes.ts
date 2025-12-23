import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { validateTenantScope } from "../middleware/validateTenantScope";
import { getTenantDetailBundle } from "../services/tenantDetailsService";
import { createLedgerEvent } from "../services/ledgerEventsService";
import { db } from "../config/firebase";

const router = Router();

// Enforce tenant-only, read-only scope for all routes under /api/tenant
router.use(requireRole("tenant"));
router.use(validateTenantScope);

router.get("/me", async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const bundle = await getTenantDetailBundle(tenantId);
    const tenant = bundle.tenant;
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    return res.json({
      id: tenant.id,
      fullName: tenant.fullName,
      email: tenant.email ?? null,
      phone: tenant.phone ?? null,
      status: tenant.status ?? null,
      createdAt: (tenant as any).createdAt ?? null,
    });
  } catch (err) {
    console.error("[tenantPortalRoutes] /me error", err);
    return res.status(500).json({ error: "Failed to load tenant profile" });
  }
});

router.get("/lease", async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const bundle = await getTenantDetailBundle(tenantId);
    const lease = bundle.lease;
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }

    return res.json({
      leaseId: (lease as any).leaseId ?? lease.tenantId,
      propertyId: (lease as any).propertyId ?? null,
      propertyName: lease.propertyName ?? "Unknown property",
      unitId: (lease as any).unitId ?? null,
      unitNumber: lease.unit ?? null,
      rentAmount: lease.monthlyRent ?? null,
      leaseStart: lease.leaseStart ?? null,
      leaseEnd: lease.leaseEnd ?? null,
      status: (lease as any).status ?? "active",
    });
  } catch (err) {
    console.error("[tenantPortalRoutes] /lease error", err);
    return res.status(500).json({ error: "Failed to load lease" });
  }
});

router.get("/payments", async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const bundle = await getTenantDetailBundle(tenantId);
    const payments = (bundle.payments || []).slice().sort((a, b) => {
      const paidA = a.paidAt ? Date.parse(a.paidAt) : 0;
      const paidB = b.paidAt ? Date.parse(b.paidAt) : 0;
      const dueA = (a as any).dueDate ? Date.parse((a as any).dueDate) : 0;
      const dueB = (b as any).dueDate ? Date.parse((b as any).dueDate) : 0;
      return (paidB || dueB) - (paidA || dueA);
    });

    return res.json(
      payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        dueDate: (p as any).dueDate ?? null,
        paidAt: p.paidAt ?? null,
        method: p.method ?? null,
        status: p.status ?? "recorded",
        notes: p.notes ?? null,
      }))
    );
  } catch (err) {
    console.error("[tenantPortalRoutes] /payments error", err);
    return res.status(500).json({ error: "Failed to load payments" });
  }
});

router.get("/payments/summary", async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const bundle = await getTenantDetailBundle(tenantId);
    const lease = bundle.lease as any;
    const payments = (bundle.payments || []) as any[];

    // Lease selection: prefer status active, else just use provided lease
    const activeLease = lease?.status?.toLowerCase?.() === "active" ? lease : lease;

    const rentAmount: number | undefined =
      typeof activeLease?.monthlyRent === "number" ? activeLease.monthlyRent : undefined;
    const rentDayOfMonth =
      typeof activeLease?.paymentDayOfMonth === "number"
        ? activeLease.paymentDayOfMonth
        : typeof activeLease?.dueDay === "number"
        ? activeLease.dueDay
        : 1;

    const today = new Date();
    const nextDueDateObj = new Date(
      today.getFullYear(),
      today.getMonth(),
      rentDayOfMonth
    );
    if (nextDueDateObj <= today) {
      nextDueDateObj.setMonth(nextDueDateObj.getMonth() + 1);
    }
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);
    const nextDueDate = isoDate(nextDueDateObj);

    const paymentSortKey = (p: any) =>
      p.paidAt ? Date.parse(p.paidAt) || 0 : p.dueDate ? Date.parse(p.dueDate) || 0 : 0;
    const sortedPayments = [...payments].sort((a, b) => paymentSortKey(b) - paymentSortKey(a));
    const lastPayment = sortedPayments[0];

    let lastPaymentStatus: "on_time" | "late" | "partial" | "unknown" = "unknown";
    if (lastPayment) {
      if (lastPayment.paidAt && lastPayment.dueDate) {
        const paid = Date.parse(lastPayment.paidAt) || 0;
        const due = Date.parse(lastPayment.dueDate) || 0;
        lastPaymentStatus = paid && due ? (paid <= due ? "on_time" : "late") : "unknown";
      }
    }

    // Determine current period: previous due date inclusive to next due date exclusive
    const currentDueDateObj = new Date(nextDueDateObj);
    currentDueDateObj.setMonth(currentDueDateObj.getMonth() - 1);
    const periodStartIso = isoDate(currentDueDateObj);
    const periodEndIso = nextDueDate;

    const amountDue = rentAmount;
    let amountPaid = 0;
    const periodPayments = sortedPayments.filter((p) => {
      if (p.dueDate) {
        const dueIso = (p.dueDate as string).slice(0, 10);
        return dueIso === periodStartIso;
      }
      if (p.paidAt) {
        const paidIso = (p.paidAt as string).slice(0, 10);
        return paidIso >= periodStartIso && paidIso < periodEndIso;
      }
      return false;
    });
    periodPayments.forEach((p) => {
      if (typeof p.amount === "number") {
        amountPaid += p.amount;
      }
    });

    let periodStatus: "on_time" | "late" | "partial" | "unpaid" | "unknown" = "unknown";
    if (amountDue === undefined) {
      periodStatus = "unknown";
    } else if (amountPaid >= amountDue) {
      // If there is a payment with paidAt > dueDate, mark late; else on_time
      const late = periodPayments.some((p) => {
        if (p.paidAt && p.dueDate) {
          return Date.parse(p.paidAt) > Date.parse(p.dueDate);
        }
        return false;
      });
      periodStatus = late ? "late" : "on_time";
    } else if (amountPaid > 0) {
      periodStatus = "partial";
    } else {
      periodStatus = "unpaid";
    }

    return res.json({
      tenantId,
      leaseId: activeLease?.leaseId ?? activeLease?.tenantId ?? null,
      rentAmount,
      rentDayOfMonth,
      nextDueDate,
      lastPayment: lastPayment
        ? {
            amount: typeof lastPayment.amount === "number" ? lastPayment.amount : 0,
            paidAt: lastPayment.paidAt ?? null,
            dueDate: lastPayment.dueDate ?? null,
            status: lastPaymentStatus,
          }
        : null,
      currentPeriod: {
        periodStart: periodStartIso,
        periodEnd: periodEndIso,
        amountDue: amountDue ?? null,
        amountPaid,
        status: periodStatus,
      },
    });
  } catch (err) {
    console.error("[tenantPortalRoutes] /payments/summary error", err);
    return res.json({
      tenantId,
      leaseId: null,
      rentAmount: undefined,
      rentDayOfMonth: 1,
      nextDueDate: undefined,
      lastPayment: null,
      currentPeriod: null,
    });
  }
});

router.get("/ledger", async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const bundle = await getTenantDetailBundle(tenantId);
    const ledger = (bundle.ledger || []).slice().sort((a: any, b: any) => {
      const aDate = a.date || a.occurredAt || a.timestamp || "";
      const bDate = b.date || b.occurredAt || b.timestamp || "";
      return (Date.parse(bDate) || 0) - (Date.parse(aDate) || 0);
    });

    return res.json(
      ledger.map((entry: any) => ({
        id: entry.id,
        type: entry.type || entry.label || "ledger_event",
        occurredAt: entry.date || entry.occurredAt || entry.timestamp || null,
        title: entry.label || entry.type || "Ledger event",
        description: entry.notes || entry.description || null,
        amount: typeof entry.amount === "number" ? entry.amount : null,
        meta: entry.meta ?? null,
      }))
    );
  } catch (err) {
    console.error("[tenantPortalRoutes] /ledger error", err);
    return res.status(500).json({ error: "Failed to load ledger" });
  }
});

router.get("/documents", async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const snap = await db
      .collection("tenantDocuments")
      .where("tenantId", "==", tenantId)
      .orderBy("issuedAt", "desc")
      .get();

    const docs =
      snap.docs?.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          type: data.type ?? "document",
          title: data.title ?? "Document",
          description: data.description ?? null,
          fileUrl: data.fileUrl ?? data.url ?? null,
          issuedAt: data.issuedAt ?? data.createdAt ?? null,
        };
      }) ?? [];

    return res.json(docs);
  } catch (err) {
    console.error("[tenantPortalRoutes] /documents error", err);
    // Fail safe: do not leak, return empty list
    return res.json([]);
  }
});

router.get("/rent-charges", async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const snap = await db
      .collection("rentCharges")
      .where("tenantId", "==", tenantId)
      .orderBy("dueDate", "desc")
      .get();

    const charges =
      snap.docs?.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          amount: data.amount ?? 0,
          dueDate: data.dueDate ?? null,
          period: data.period ?? null,
          status: data.status ?? "issued",
          issuedAt: data.issuedAt ?? data.createdAt ?? null,
          confirmedAt: data.confirmedAt ?? null,
          paidAt: data.paidAt ?? null,
        };
      }) ?? [];

    return res.json(charges);
  } catch (err) {
    console.error("[tenantPortalRoutes] /rent-charges error", err);
    return res.json([]);
  }
});

router.post("/rent-charges/:id/confirm", async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  const { id } = req.params;
  try {
    const ref = db.collection("rentCharges").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Rent charge not found" });
    }
    const data = snap.data() as any;
    if (data.tenantId !== tenantId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (data.status !== "issued") {
      return res.status(409).json({ error: "Charge already confirmed or paid" });
    }
    const now = new Date().toISOString();
    await ref.update({ status: "confirmed", confirmedAt: now });
    createLedgerEvent({
      tenantId,
      landlordId: data.landlordId,
      type: "charge_confirmed",
      amountDelta: 0,
      occurredAt: now,
      reference: { kind: "rentCharge", id },
      notes: `Tenant confirmed receipt for period ${data.period ?? ""}`,
      meta: { rentChargeId: id },
    });
    return res.json({ ok: true, confirmedAt: now });
  } catch (err) {
    console.error("[tenantPortalRoutes] /rent-charges confirm error", err);
    return res.status(500).json({ error: "Failed to confirm charge" });
  }
});

// Explicitly block non-GET verbs for tenant portal resources
router.all(
  [
    "/payments",
    "/payments/summary",
    "/lease",
    "/me",
    "/ledger",
    "/documents",
    "/rent-charges",
  ],
  (req, res, next) => {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    return next();
  }
);

/**
 * Manual smoke checks:
 * - Tenant JWT: 200 on /api/tenant/me, /lease, /payments, /ledger, /documents
 * - Landlord/admin JWT: 403 on /api/tenant/*
 * - Tenant JWT: 403 on non-/api/tenant routes (guarded in app.routes)
 */

export default router;
