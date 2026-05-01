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
import { buildDatedExportFilename, setAttachmentExportHeaders } from "../lib/exports/exportResponse";
import { db } from "../config/firebase";

const router = Router();

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const xmlEscape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const roleForReq = (req: any) => String(req.user?.actorRole || req.user?.role || "").trim().toLowerCase();

function resolveTenantLabel(raw: any): string {
  return (
    String(raw?.fullName || raw?.name || raw?.displayName || "").trim() ||
    [String(raw?.firstName || "").trim(), String(raw?.lastName || "").trim()].filter(Boolean).join(" ") ||
    String(raw?.email || "").trim() ||
    "Tenant"
  );
}

function resolvePropertyLabel(raw: any): string {
  return (
    String(raw?.name || raw?.addressLine1 || raw?.address || raw?.displayName || raw?.propertyName || "").trim() ||
    "Property"
  );
}

function toMillis(value: any): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function toIsoString(value: any): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") return value;
  const millis = toMillis(value);
  return millis == null ? null : new Date(millis).toISOString();
}

function isSameYearMonth(value: any, year: number, month: number) {
  const iso = String(toIsoString(value) || "").trim();
  if (!iso) return false;
  const expectedMonth = String(month).padStart(2, "0");
  const dateOnlyMatch = iso.match(/^(\d{4})-(\d{2})/);
  if (dateOnlyMatch) {
    return Number(dateOnlyMatch[1]) === year && dateOnlyMatch[2] === expectedMonth;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month;
}

function normalizePersistedPayment(docId: string, raw: any): Payment & {
  status?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
} {
  return {
    id: docId,
    tenantId: String(raw?.tenantId || "").trim(),
    propertyId: String(raw?.propertyId || "").trim() || null,
    amount: Number(raw?.amount ?? 0),
    paidAt: String(toIsoString(raw?.paidAt) || "").trim(),
    method: String(raw?.method || "").trim(),
    notes: raw?.notes ?? null,
    status: String(raw?.status || "").trim() || "Recorded",
    createdAt: toIsoString(raw?.createdAt),
    updatedAt: toIsoString(raw?.updatedAt),
  };
}

async function listPersistedPayments(tenantId?: string): Promise<Array<ReturnType<typeof normalizePersistedPayment>>> {
  const base = db.collection("payments");
  const query = tenantId
    ? base.where("tenantId", "==", tenantId).orderBy("paidAt", "desc").limit(200)
    : base.orderBy("paidAt", "desc").limit(500);
  const snap = await query.get();
  return snap.docs.map((doc: any) => normalizePersistedPayment(doc.id, doc.data() as any));
}

async function getPersistedPaymentById(paymentId: string) {
  const snap = await db.collection("payments").doc(paymentId).get();
  if (!snap.exists) return null;
  return normalizePersistedPayment(snap.id, snap.data() as any);
}

async function buildPaymentLabelMaps(payments: Payment[]) {
  const tenantIds = Array.from(new Set(payments.map((payment) => String(payment.tenantId || "").trim()).filter(Boolean)));
  const propertyIds = Array.from(new Set(payments.map((payment) => String(payment.propertyId || "").trim()).filter(Boolean)));

  const [tenantSnaps, propertySnaps] = await Promise.all([
    Promise.all(tenantIds.map((id) => db.collection("tenants").doc(id).get())),
    Promise.all(propertyIds.map((id) => db.collection("properties").doc(id).get())),
  ]);

  const tenantLabels = new Map<string, string>();
  tenantSnaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() as any;
    tenantLabels.set(snap.id, resolveTenantLabel(data));
  });

  const propertyLabels = new Map<string, string>();
  propertySnaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() as any;
    propertyLabels.set(snap.id, resolvePropertyLabel(data));
  });

  return { tenantLabels, propertyLabels };
}

async function buildPaymentExportRows(payments: Payment[]) {
  const { tenantLabels, propertyLabels } = await buildPaymentLabelMaps(payments);
  return payments.map((payment) => ({
    paidDate: String(payment.paidAt || "").trim(),
    tenant: tenantLabels.get(String(payment.tenantId || "").trim()) || "Tenant",
    property: propertyLabels.get(String(payment.propertyId || "").trim()) || "Property",
    amount: Number(payment.amount || 0).toFixed(2),
    method: String(payment.method || "").trim(),
    notes: String(payment.notes || "").trim(),
  }));
}

function renderPaymentSpreadsheetXml(rows: Array<Record<string, string>>) {
  const headers = ["Paid Date", "Tenant", "Property", "Amount", "Method", "Notes"];
  const rowXml = rows
    .map((row) => {
      const cells = [row.paidDate, row.tenant, row.property, row.amount, row.method, row.notes]
        .map((value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Payments">
    <Table>
      <Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join("")}</Row>
      ${rowXml}
    </Table>
  </Worksheet>
</Workbook>`;
}

const parseYearMonth = (req: Request): { year: number; month: number } | null => {
  const year = Number((req.query.year as string) ?? "");
  const month = Number((req.query.month as string) ?? "");
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
};

// GET /api/payments?tenantId=...
router.get("/payments", async (req: Request, res: Response) => {
  res.setHeader("x-route-source", "paymentsRoutes.ts");
  const tenantId = (req.query.tenantId as string | undefined) ?? undefined;
  try {
    const results = await listPersistedPayments(tenantId);
    return res.json(results);
  } catch (err) {
    console.error("[paymentsRoutes] list failed", err);
    return res.status(500).json({ ok: false, error: "PAYMENTS_LIST_FAILED" });
  }
});

router.get("/payments/export.csv", requireAuth, async (req: any, res: Response) => {
  try {
    const role = roleForReq(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const rows = await buildPaymentExportRows(await listPersistedPayments());
    const csv = [
      ["paid_date", "tenant", "property", "amount", "method", "notes"].join(","),
      ...rows.map((row) => [row.paidDate, row.tenant, row.property, row.amount, row.method, row.notes].map(csvEscape).join(",")),
    ].join("\n");

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-payments", format: "csv" }),
      format: "csv",
    });
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[paymentsRoutes] csv export failed", err);
    return res.status(500).json({ ok: false, error: "PAYMENTS_EXPORT_FAILED" });
  }
});

router.get("/payments/export.xlsx", requireAuth, async (req: any, res: Response) => {
  try {
    const role = roleForReq(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const rows = await buildPaymentExportRows(await listPersistedPayments());
    const xml = renderPaymentSpreadsheetXml(rows);

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-payments", format: "xls" }),
      format: "xls",
    });
    return res.status(200).send(xml);
  } catch (err) {
    console.error("[paymentsRoutes] xlsx export failed", err);
    return res.status(500).json({ ok: false, error: "PAYMENTS_EXPORT_FAILED" });
  }
});

// POST /api/payments
router.post(
  "/payments",
  requireAuth,
  requirePermission(["payments.record", "ledger.record"]),
  async (req: any, res: Response) => {
  const body = req.body as Partial<CreatePaymentPayload>;
  if (!body.tenantId || typeof body.amount !== "number" || !body.paidAt || !body.method) {
    return res.status(400).json({ error: "tenantId, amount, paidAt, and method are required" });
  }
  const now = new Date().toISOString();
  const paymentPayload = {
    tenantId: body.tenantId,
    amount: body.amount,
    paidAt: body.paidAt,
    method: body.method,
    notes: body.notes ?? null,
    propertyId: body.propertyId ?? null,
    createdAt: now,
    updatedAt: now,
    status: "Recorded",
  };
  const paymentRef = await db.collection("payments").add(paymentPayload);
  const payment = normalizePersistedPayment(paymentRef.id, paymentPayload);

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
  async (req: any, res: Response) => {
  const body = req.body as Partial<CreatePaymentPayload>;
  if (!body.tenantId || typeof body.amount !== "number" || !body.paidAt || !body.method) {
    return res.status(400).json({ error: "tenantId, amount, paidAt, and method are required" });
  }
  const now = new Date().toISOString();
  const paymentPayload = {
    tenantId: body.tenantId,
    amount: body.amount,
    paidAt: body.paidAt,
    method: body.method,
    notes: body.notes ?? null,
    propertyId: body.propertyId ?? null,
    createdAt: now,
    updatedAt: now,
    status: "Recorded",
  };
  const paymentRef = await db.collection("payments").add(paymentPayload);
  const payment = normalizePersistedPayment(paymentRef.id, paymentPayload);

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
router.get("/payments/tenant/:tenantId/monthly", async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const parsed = parseYearMonth(req);
  if (!parsed) {
    return res.json({ payments: [], total: 0 });
  }
  try {
    const payments = (await listPersistedPayments(tenantId)).filter((payment) =>
      isSameYearMonth(payment.paidAt, parsed.year, parsed.month)
    );
    const total = payments.reduce((sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0), 0);
    return res.json({ payments, total });
  } catch (err) {
    console.error("[paymentsRoutes] tenant monthly failed", err);
    return res.status(500).json({ ok: false, error: "PAYMENTS_MONTHLY_FAILED" });
  }
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
router.put("/payments/:paymentId", requireAuth, requirePermission("payments.edit"), async (req: any, res: Response) => {
  const { paymentId } = req.params;
  const { amount, notes } = req.body as Partial<Payment>;
  const existing = await getPersistedPaymentById(paymentId);
  if (!existing) {
    return res.status(404).json({ error: "Payment not found" });
  }

  const updatedAmount =
    typeof amount === "number" && !Number.isNaN(amount) ? amount : existing.amount;
  const updatedPayload = {
    amount: updatedAmount,
    notes: notes ?? existing.notes ?? null,
    updatedAt: new Date().toISOString(),
  };
  await db.collection("payments").doc(paymentId).set(updatedPayload, { merge: true });
  const updated = {
    ...existing,
    ...updatedPayload,
  };

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
router.delete("/payments/:paymentId", requireAuth, requirePermission("payments.edit"), async (req: any, res: Response) => {
  const { paymentId } = req.params;
  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }
  const existing = await getPersistedPaymentById(paymentId);
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

  await db.collection("payments").doc(paymentId).delete();
  return res.status(204).send();
});

export default router;
