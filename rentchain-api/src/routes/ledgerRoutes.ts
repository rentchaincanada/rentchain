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

        return res.json(preview);
      } catch (err: any) {
        console.error("[ledger] payment csv preview failed", err?.message || err);
        return res.status(500).json({ ok: false, error: "PAYMENT_IMPORT_PREVIEW_FAILED" });
      }
    });
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
