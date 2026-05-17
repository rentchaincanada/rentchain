import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";
import { appendLedgerEvent, verifyLedgerChain } from "../services/ledger/ledgerService";
import { db } from "../config/firebase";
import { requireCapability } from "../services/capabilityGuard";
import multer from "multer";
import path from "path";
import {
  previewPaymentCsvImport,
  type PaymentImportLease,
  type PaymentImportPreviewRow,
  type PaymentImportPreviewResult,
  type PaymentImportProperty,
  type PaymentImportTenant,
  type PaymentImportUnit,
} from "../services/ledgerPaymentImportPreviewService";

const router = Router();
const paymentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.PAYMENT_IMPORT_MAX_BYTES || 2 * 1024 * 1024), files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();
    if (ext === ".csv" || mime === "text/csv" || mime === "application/vnd.ms-excel" || mime === "application/octet-stream") {
      cb(null, true);
      return;
    }
    cb(new Error("UNSUPPORTED_FILE_TYPE"));
  },
});

const parseLimit = (raw: any, def: number, max: number) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.max(Math.floor(n), 1), max);
};

function getLandlordId(req: any): string | null {
  return req.user?.landlordId || req.user?.id || null;
}

async function listDocsForLandlord<T>(collection: string, landlordId: string): Promise<T[]> {
  const snap = await db.collection(collection).where("landlordId", "==", landlordId).get();
  return snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as T);
}

function cleanImportText(value: unknown, max = 500): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.slice(0, max);
}

function normalizeMethod(value: unknown): string {
  return String(value || "other").trim().toLowerCase().slice(0, 80) || "other";
}

function duplicateKeyFor(row: PaymentImportPreviewRow, landlordId: string): string {
  return [
    landlordId,
    row.matchedTenantId || "",
    row.leaseId || "",
    row.paymentDate || "",
    String(row.amountCents || 0),
    normalizeMethod(row.method),
    cleanImportText(row.reference, 120) || "",
  ].join("|");
}

function rowIsImportEligible(row: PaymentImportPreviewRow): boolean {
  return Boolean(
    row.matchStatus === "matched" &&
      row.confidence === "high" &&
      !row.duplicateInFile &&
      row.matchedTenantId &&
      row.leaseId &&
      row.propertyId &&
      row.unitId &&
      row.amountCents &&
      row.amountCents > 0 &&
      row.paymentDate
  );
}

function buildPreviewBatch(params: {
  landlordId: string;
  createdBy: string;
  filename: string;
  preview: PaymentImportPreviewResult;
}) {
  const nowIso = new Date().toISOString();
  return {
    landlordId: params.landlordId,
    createdBy: params.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
    source: "payment_csv",
    status: "previewed",
    filename: params.filename,
    sanitizedSummary: params.preview.summary,
    rowCount: params.preview.summary.totalRows,
    selectedCount: 0,
    importedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
    ignoredSensitiveColumnsDetected: Boolean(params.preview.notices.sensitiveColumnsOmitted),
    ignoredColumnsDetected: Boolean(params.preview.notices.ignoredColumns),
    notices: params.preview.notices,
    rows: params.preview.rows,
  };
}

async function hasDuplicatePayment(landlordId: string, row: PaymentImportPreviewRow): Promise<boolean> {
  const snap = await db.collection("payments").where("landlordId", "==", landlordId).get();
  const rowKey = duplicateKeyFor(row, landlordId);
  return snap.docs.some((doc: any) => {
    const data = doc.data?.() || {};
    const existingRow: PaymentImportPreviewRow = {
      ...row,
      matchedTenantId: cleanImportText(data.tenantId, 160),
      leaseId: cleanImportText(data.leaseId, 160),
      amountCents: Number(data.amountCents || Math.round(Number(data.amount || 0) * 100)),
      paymentDate: cleanImportText(data.effectiveDate || data.paidAt, 40),
      method: cleanImportText(data.method, 80),
      reference: cleanImportText(data.reference, 120),
    } as PaymentImportPreviewRow;
    return duplicateKeyFor(existingRow, landlordId) === rowKey;
  });
}

router.post(
  "/imports/payment-csv/preview",
  requireAuth,
  requirePermission(["ledger.view", "payments.record"]),
  (req: any, res) => {
    res.setHeader("x-route-source", "ledgerRoutes.ts");
    res.setHeader("x-payment-import-mode", "preview-only");
    paymentImportUpload.single("file")(req, res, async (uploadErr: any) => {
      try {
        if (uploadErr) {
          const message = String(uploadErr?.message || "");
          if (message.includes("UNSUPPORTED_FILE_TYPE")) {
            return res.status(400).json({ ok: false, error: "CSV_FILE_REQUIRED" });
          }
          if (String(uploadErr?.code || "") === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE" });
          }
          return res.status(400).json({ ok: false, error: "UPLOAD_FAILED" });
        }

        const landlordId = getLandlordId(req);
        if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

        const file = req.file as Express.Multer.File | undefined;
        if (!file?.buffer?.length) {
          return res.status(400).json({ ok: false, error: "CSV_FILE_REQUIRED" });
        }

        const [tenants, leases, properties, units] = await Promise.all([
          listDocsForLandlord<PaymentImportTenant>("tenants", landlordId),
          listDocsForLandlord<PaymentImportLease>("leases", landlordId),
          listDocsForLandlord<PaymentImportProperty>("properties", landlordId),
          listDocsForLandlord<PaymentImportUnit>("units", landlordId),
        ]);

        const preview = previewPaymentCsvImport({
          filename: file.originalname || "payment-import.csv",
          csvText: file.buffer.toString("utf8"),
          tenants,
          leases,
          properties,
          units,
        });
        const createdBy = req.user?.id || req.user?.email || landlordId;
        await db.collection("ledgerImportBatches").doc(preview.importBatchId).set(
          buildPreviewBatch({
            landlordId,
            createdBy,
            filename: file.originalname || "payment-import.csv",
            preview,
          }),
          { merge: false }
        );

        return res.json(preview);
      } catch (err: any) {
        console.error("[ledger] payment csv preview failed", err?.message || err);
        return res.status(500).json({ ok: false, error: "PAYMENT_IMPORT_PREVIEW_FAILED" });
      }
    });
  }
);

router.post(
  "/imports/payment-csv/confirm",
  requireAuth,
  requirePermission(["ledger.record", "payments.record"]),
  async (req: any, res) => {
    res.setHeader("x-route-source", "ledgerRoutes.ts");
    res.setHeader("x-payment-import-mode", "confirm");
    try {
      const landlordId = getLandlordId(req);
      const createdBy = req.user?.id || req.user?.email || landlordId;
      if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const importBatchId = String(req.body?.importBatchId || "").trim();
      const selectedIds = new Set(
        (Array.isArray(req.body?.selectedRowIds) ? req.body.selectedRowIds : [])
          .map((value: any) => String(value || "").trim())
          .filter(Boolean)
      );
      const selectedFingerprints = new Set(
        (Array.isArray(req.body?.selectedRowFingerprints) ? req.body.selectedRowFingerprints : [])
          .map((value: any) => String(value || "").trim())
          .filter(Boolean)
      );
      if (!importBatchId) return res.status(400).json({ ok: false, error: "importBatchId is required" });
      if (!selectedIds.size && !selectedFingerprints.size) {
        return res.status(400).json({ ok: false, error: "At least one row must be selected" });
      }

      const batchRef = db.collection("ledgerImportBatches").doc(importBatchId);
      const batchSnap = await batchRef.get();
      if (!batchSnap.exists) return res.status(404).json({ ok: false, error: "IMPORT_BATCH_NOT_FOUND" });
      const batch = batchSnap.data() || {};
      if (batch.landlordId !== landlordId) return res.status(404).json({ ok: false, error: "IMPORT_BATCH_NOT_FOUND" });

      const rows = Array.isArray(batch.rows) ? (batch.rows as PaymentImportPreviewRow[]) : [];
      const selectedRows = rows.filter(
        (row) => selectedIds.has(row.rowId) || selectedFingerprints.has(row.rowFingerprint)
      );
      if (!selectedRows.length) return res.status(400).json({ ok: false, error: "No selected rows were found in the import batch" });

      const results: Array<{
        rowId: string;
        rowFingerprint: string;
        status: "imported" | "duplicate" | "failed";
        reason: string;
        paymentDocumentId: string | null;
        ledgerEntryId: string | null;
      }> = [];
      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      for (const row of selectedRows) {
        if (!rowIsImportEligible(row)) {
          results.push({
            rowId: row.rowId,
            rowFingerprint: row.rowFingerprint,
            status: "failed",
            reason: "Row is not eligible for import. Only high-confidence matched rows can be imported.",
            paymentDocumentId: null,
            ledgerEntryId: null,
          });
          continue;
        }

        const leaseSnap = await db.collection("leases").doc(String(row.leaseId)).get();
        const lease = leaseSnap.exists ? leaseSnap.data() || {} : null;
        const leaseTenantIds = new Set(
          [
            lease?.tenantId,
            lease?.primaryTenantId,
            ...(Array.isArray(lease?.tenantIds) ? lease.tenantIds : []),
          ].map((value: any) => String(value || "").trim()).filter(Boolean)
        );
        if (
          !lease ||
          lease.landlordId !== landlordId ||
          !leaseTenantIds.has(String(row.matchedTenantId || "")) ||
          String(lease.propertyId || "") !== row.propertyId ||
          String(lease.unitId || "") !== row.unitId
        ) {
          results.push({
            rowId: row.rowId,
            rowFingerprint: row.rowFingerprint,
            status: "failed",
            reason: "Server-side lease context no longer matches the preview row.",
            paymentDocumentId: null,
            ledgerEntryId: null,
          });
          continue;
        }

        if (await hasDuplicatePayment(landlordId, row)) {
          results.push({
            rowId: row.rowId,
            rowFingerprint: row.rowFingerprint,
            status: "duplicate",
            reason: "Exact payment duplicate already exists. Row was skipped.",
            paymentDocumentId: null,
            ledgerEntryId: null,
          });
          continue;
        }

        const paymentRef = db.collection("payments").doc();
        const entryRef = db.collection("ledgerEntries").doc();
        const method = normalizeMethod(row.method);
        const reference = cleanImportText(row.reference, 120);
        const notes = cleanImportText(row.notes, 5000);
        const amountCents = Number(row.amountCents || 0);
        const payment = {
          id: paymentRef.id,
          landlordId,
          tenantId: row.matchedTenantId,
          leaseId: row.leaseId,
          propertyId: row.propertyId,
          unitId: row.unitId,
          amount: amountCents / 100,
          amountCents,
          paidAt: row.paymentDate,
          effectiveDate: row.paymentDate,
          method,
          status: "recorded",
          reference,
          notes,
          ledgerEntryId: entryRef.id,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy,
          source: "payment_csv_import",
          importBatchId,
          importRowFingerprint: row.rowFingerprint,
          duplicateKey: duplicateKeyFor(row, landlordId),
        };
        const entry = {
          id: entryRef.id,
          landlordId,
          tenantId: row.matchedTenantId,
          propertyId: row.propertyId,
          unitId: row.unitId,
          leaseId: row.leaseId,
          entryType: "payment",
          category: "payment",
          amountCents,
          effectiveDate: row.paymentDate,
          method,
          reference,
          notes,
          paymentDocumentId: paymentRef.id,
          createdAt: now,
          createdBy,
          source: "payment_csv_import",
          importBatchId,
          importRowFingerprint: row.rowFingerprint,
        };

        await db.runTransaction(async (transaction: any) => {
          transaction.set(paymentRef, payment, { merge: false });
          transaction.set(entryRef, entry, { merge: false });
        });
        results.push({
          rowId: row.rowId,
          rowFingerprint: row.rowFingerprint,
          status: "imported",
          reason: "Payment and ledger entry created.",
          paymentDocumentId: paymentRef.id,
          ledgerEntryId: entryRef.id,
        });
      }

      const importedCount = results.filter((row) => row.status === "imported").length;
      const duplicateCount = results.filter((row) => row.status === "duplicate").length;
      const failedCount = results.filter((row) => row.status === "failed").length;
      const status = failedCount && importedCount ? "partially_imported" : failedCount && !importedCount ? "failed" : "imported";
      await batchRef.set(
        {
          status,
          selectedCount: selectedRows.length,
          importedCount,
          duplicateCount,
          failedCount,
          updatedAt: new Date().toISOString(),
          importedAt: importedCount ? new Date().toISOString() : null,
          resultSummary: { importedCount, duplicateCount, failedCount },
        },
        { merge: true }
      );

      return res.json({
        ok: true,
        importBatchId,
        importedCount,
        duplicateCount,
        failedCount,
        results,
        warnings: duplicateCount ? ["Exact duplicate payments were skipped."] : [],
      });
    } catch (err: any) {
      console.error("[ledger] payment csv confirm failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "PAYMENT_IMPORT_CONFIRM_FAILED" });
    }
  }
);

router.get("/", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const cap = await requireCapability(landlordId, "ledger", req.user);
  if (!cap.ok) {
    return res.status(403).json({ ok: false, error: "Upgrade required", capability: "ledger", plan: cap.plan });
  }

  const limit = parseLimit(req.query?.limit, 50, 200);
  let tenantId = req.query?.tenantId ? String(req.query.tenantId) : null;
  const propertyId = req.query?.propertyId ? String(req.query.propertyId) : null;

  if (req.user?.role === "tenant") {
    const tenantIdFromUser = req.user?.tenantId ?? null;
    if (!tenantIdFromUser) {
      console.warn("[ledger] tenant request missing tenantId", {
        userId: req.user?.id,
        email: req.user?.email,
      });
      return res.status(403).json({ ok: false, error: "Tenant ledger not enabled (missing tenantId)" });
    }
    tenantId = tenantIdFromUser;
  }

  try {
    const ref = db.collection("ledgerEvents").where("landlordId", "==", landlordId).limit(limit);
    const snap = await ref.get();
    let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Optional in-memory filters
    if (tenantId) items = items.filter((i) => i.tenantId === tenantId);
    if (propertyId) items = items.filter((i) => i.propertyId === propertyId);

    // Sort by ts desc
    items.sort((a, b) => (Number(b?.ts || 0) as any) - (Number(a?.ts || 0) as any));

    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[ledger] GET / failed", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    return res
      .status(500)
      .json({ ok: false, error: "Failed to load ledger", detail: String(err?.message || err) });
  }
});

router.get("/ping", requireAuth, (req: any, res) => {
  return res.json({
    ok: true,
    route: "ledgerRoutes",
    role: req.user?.role || null,
    landlordId: req.user?.landlordId || req.user?.id || null,
  });
});

router.post("/events", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const cap = await requireCapability(landlordId, "ledger", req.user);
  if (!cap.ok) {
    return res.status(403).json({ ok: false, error: "Upgrade required", capability: "ledger", plan: cap.plan });
  }
  if (req.user?.role === "tenant") {
    return res.status(403).json({ ok: false, error: "Tenants cannot write ledger events" });
  }

  const { type, tenantId, propertyId, unitId, payload } = req.body || {};
  if (!type || payload === undefined) {
    return res.status(400).json({ ok: false, error: "type and payload are required" });
  }

  try {
    const actor = {
      userId: req.user?.id,
      role: req.user?.role,
      email: req.user?.email,
    };
    const event = await appendLedgerEvent({
      landlordId,
      tenantId,
      propertyId,
      unitId,
      actor,
      type,
      ts: Date.now(),
      payload,
      source: {
        route: req.originalUrl || "ledgerRoutes",
        requestId: req.headers["x-request-id"] || req.requestId,
        ip: req.ip,
      },
    });
    return res.json({ ok: true, item: event });
  } catch (err: any) {
    console.error("[ledger] POST /events failed", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    return res
      .status(500)
      .json({ ok: false, error: "Failed to append ledger event", detail: String(err?.message || err) });
  }
});

router.get("/verify", requireAuth, async (req: any, res) => {
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const cap = await requireCapability(landlordId, "ledger", req.user);
  if (!cap.ok) {
    return res.status(403).json({ ok: false, error: "Upgrade required", capability: "ledger", plan: cap.plan });
  }
  if (req.user?.role === "tenant") {
    return res.status(403).json({ ok: false, error: "Tenants cannot verify ledger" });
  }

  const limit = parseLimit(req.query?.limit, 500, 1000);

  try {
    const result = await verifyLedgerChain(landlordId, limit);
    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("[ledger] GET /verify failed", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    return res
      .status(500)
      .json({ ok: false, error: "Failed to verify ledger", detail: String(err?.message || err) });
  }
});

export default router;
