import { Router } from "express";
import { requireRole } from "../middleware/requireRole";
import { db } from "../config/firebase";
import { createLedgerEvent } from "../services/ledgerEventsService";

const router = Router();

router.use(requireRole("landlord"));

router.post("/", async (req: any, res) => {
  const { tenantId, leaseId, amount, dueDate, period, propertyId, unitId } = req.body || {};
  const landlordId = req.user?.landlordId || req.user?.id;

  if (!tenantId || typeof amount !== "number" || !dueDate) {
    return res.status(400).json({ error: "tenantId, amount, and dueDate are required" });
  }

  try {
    // Optional validation: ensure tenant belongs to landlord if tenant doc has landlordId
    try {
      const tenantDoc = await db.collection("tenants").doc(String(tenantId)).get();
      const data = tenantDoc.data();
      if (data?.landlordId && data.landlordId !== landlordId) {
        return res.status(403).json({ error: "Forbidden: tenant not in your portfolio" });
      }
    } catch {
      // ignore lookup errors, keep operation best-effort
    }

    const now = new Date().toISOString();
    const payload = {
      tenantId: String(tenantId),
      landlordId: String(landlordId),
      leaseId: leaseId ?? null,
      propertyId: propertyId ?? null,
      unitId: unitId ?? null,
      amount,
      dueDate,
      period: period ?? dueDate.slice(0, 7),
      status: "issued",
      issuedAt: now,
      confirmedAt: null,
      paidAt: null,
      createdAt: now,
    };

    const docRef = await db.collection("rentCharges").add(payload);
    const created = { id: docRef.id, ...payload };

    createLedgerEvent({
      tenantId,
      landlordId,
      type: "charge_issued",
      amountDelta: -Math.abs(amount),
      occurredAt: now,
      reference: { kind: "rentCharge", id: docRef.id },
      notes: `Charge for period ${payload.period}`,
      meta: { rentChargeId: docRef.id, amount, dueDate, period: payload.period },
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("[landlordRentChargeRoutes] issue charge error", err);
    return res.status(500).json({ error: "Failed to issue rent charge" });
  }
});

router.post("/:id/record-payment", async (req: any, res) => {
  const { id } = req.params;
  const { amount, paidAt, method } = req.body || {};
  const landlordId = req.user?.landlordId || req.user?.id;

  if (typeof amount !== "number" || !paidAt) {
    return res.status(400).json({ error: "amount and paidAt are required" });
  }

  try {
    const chargeRef = db.collection("rentCharges").doc(id);
    const chargeSnap = await chargeRef.get();
    if (!chargeSnap.exists) {
      return res.status(404).json({ error: "Rent charge not found" });
    }
    const charge = chargeSnap.data() as any;
    if (charge.landlordId && charge.landlordId !== landlordId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const paymentPayload = {
      tenantId: charge.tenantId,
      landlordId,
      leaseId: charge.leaseId ?? null,
      propertyId: charge.propertyId ?? null,
      unitId: charge.unitId ?? null,
      amount,
      dueDate: charge.dueDate ?? null,
      paidAt,
      method: method || "manual",
      rentChargeId: id,
      createdAt: new Date().toISOString(),
    };

    const paymentDoc = await db.collection("payments").add(paymentPayload);

    const shouldMarkPaid = typeof charge.amount === "number" && amount >= charge.amount;
    const update: any = {};
    if (shouldMarkPaid) {
      update.status = "paid";
      update.paidAt = paidAt;
    }
    if (Object.keys(update).length > 0) {
      await chargeRef.update(update);
    }

    createLedgerEvent({
      tenantId: charge.tenantId,
      landlordId,
      type: "payment_recorded",
      amountDelta: Math.abs(amount),
      occurredAt: paidAt,
      reference: { kind: "rentCharge", id },
      method: paymentPayload.method,
      meta: { rentChargeId: id, amount, paidAt, method: paymentPayload.method },
    });

    const payment = { id: paymentDoc.id, ...paymentPayload };
    return res.status(201).json({ payment, rentChargeUpdated: shouldMarkPaid ? { status: "paid", paidAt } : null });
  } catch (err) {
    console.error("[landlordRentChargeRoutes] record-payment error", err);
    return res.status(500).json({ error: "Failed to record payment" });
  }
});

export default router;
