// @ts-nocheck
// rentchain-api/src/routes/paymentsRoutes.ts
import { Router, Request, Response } from "express";
import {
  CreatePaymentPayload,
  paymentsService,
  Payment,
} from "../services/paymentsService";
import { leaseService } from "../services/leaseService";
import { recordPaymentEvent } from "../services/ledgerEventsService";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";

const router = Router();

const parseYearMonth = (req: Request): { year: number; month: number } | null => {
  const year = Number((req.query.year as string) ?? "");
  const month = Number((req.query.month as string) ?? "");
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
};

// GET /api/payments?tenantId=...
router.get("/payments", (req: Request, res: Response) => {
  res.setHeader("x-route-source", "paymentsRoutes.ts");
  const tenantId = (req.query.tenantId as string | undefined) ?? undefined;

  let results: Payment[] = [];
  if (tenantId) {
    results = paymentsService.getByTenantId(tenantId);
  } else {
    results = paymentsService.getAll();
  }

  res.json(results);
});

// POST /api/payments
router.post(
  "/payments",
  requireAuth,
  requirePermission(["payments.record", "ledger.record"]),
  (req: any, res: Response) => {
  const body = req.body as Partial<CreatePaymentPayload>;
  if (!body.tenantId || typeof body.amount !== "number" || !body.paidAt || !body.method) {
    return res.status(400).json({ error: "tenantId, amount, paidAt, and method are required" });
  }

  const payment = paymentsService.create({
    tenantId: body.tenantId,
    amount: body.amount,
    paidAt: body.paidAt,
    method: body.method,
    notes: body.notes ?? null,
    propertyId: body.propertyId ?? null,
  });

  recordPaymentEvent({
    landlordId: (req as any).user?.id,
    type: "payment_created",
    tenantId: payment.tenantId,
    amountDelta: payment.amount,
    referenceId: payment.id,
    method: payment.method,
    notes: payment.notes ?? undefined,
  });

  return res.status(201).json(payment);
}
);

// POST /api/payments/record (alias for quick entry)
router.post(
  "/payments/record",
  requireAuth,
  requirePermission(["payments.record", "ledger.record"]),
  (req: any, res: Response) => {
  const body = req.body as Partial<CreatePaymentPayload>;
  if (!body.tenantId || typeof body.amount !== "number" || !body.paidAt || !body.method) {
    return res.status(400).json({ error: "tenantId, amount, paidAt, and method are required" });
  }

  const payment = paymentsService.create({
    tenantId: body.tenantId,
    amount: body.amount,
    paidAt: body.paidAt,
    method: body.method,
    notes: body.notes ?? null,
    propertyId: body.propertyId ?? null,
  });

  recordPaymentEvent({
    landlordId: (req as any).user?.id,
    type: "payment_created",
    tenantId: payment.tenantId,
    amountDelta: payment.amount,
    referenceId: payment.id,
    method: payment.method,
    notes: payment.notes ?? undefined,
  });

  return res.status(201).json(payment);
}
);

// GET /api/payments/tenant/:tenantId/monthly
router.get("/payments/tenant/:tenantId/monthly", (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const parsed = parseYearMonth(req);
  if (!parsed) {
    return res.json({ payments: [], total: 0 });
  }

  const payments = paymentsService.getForTenantInMonth(tenantId, parsed.year, parsed.month);
  const total = payments.reduce((sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0), 0);
  return res.json({ payments, total });
});

// GET /api/payments/property/:propertyId/monthly (stubbed to avoid 404/400)
router.get("/payments/property/:propertyId/monthly", requireAuth, (req: any, res: Response) => {
  res.setHeader("x-route-source", "paymentsRoutes.ts");
  const landlordId = req.user?.landlordId || req.user?.id;
  const propertyId = String(req.params.propertyId || "");
  const year = Number(req.query?.year);
  const month = Number(req.query?.month);

  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!propertyId || !Number.isFinite(year) || !Number.isFinite(month)) {
    return res.status(400).json({ ok: false, error: "Missing/invalid params" });
  }

  // Stubbed payload to keep UI stable while payments module is incomplete
  return res.json({
    ok: true,
    propertyId,
    year,
    month,
    totalCents: 0,
    items: [],
    // compatibility fields
    payments: [],
    total: 0,
  });
});

// PUT /api/payments/:paymentId
router.put("/payments/:paymentId", requireAuth, requirePermission("payments.edit"), (req: any, res: Response) => {
  const { paymentId } = req.params;
  const { amount, notes } = req.body as Partial<Payment>;

  const existing = paymentsService.getById(paymentId);
  if (!existing) {
    return res.status(404).json({ error: "Payment not found" });
  }

  const updatedAmount =
    typeof amount === "number" && !Number.isNaN(amount) ? amount : existing.amount;

  const updated =
    paymentsService.update(paymentId, {
      amount: updatedAmount,
      notes: notes ?? existing.notes,
    }) || existing;

  const delta = updatedAmount - existing.amount;
  if (delta !== 0) {
    recordPaymentEvent({
      landlordId: (req as any).user?.id,
      type: "payment_updated",
      tenantId: existing.tenantId,
      amountDelta: delta,
      referenceId: existing.id,
      method: existing.method,
      notes: updated.notes ?? undefined,
    });
  }

  return res.status(200).json(updated);
});

// DELETE /api/payments/:paymentId
router.delete("/payments/:paymentId", requireAuth, requirePermission("payments.edit"), (req: any, res: Response) => {
  const { paymentId } = req.params;
  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }

  const existing = paymentsService.getById(paymentId);
  if (!existing) {
    return res.status(404).json({ error: "Payment not found" });
  }

  recordPaymentEvent({
    landlordId: (req as any).user?.id,
    type: "payment_deleted",
    tenantId: existing.tenantId,
    amountDelta: -Math.abs(existing.amount),
    referenceId: existing.id,
    method: existing.method,
    notes: existing.notes ?? undefined,
  });

  paymentsService.delete(paymentId);
  return res.status(204).send();
});

export default router;
