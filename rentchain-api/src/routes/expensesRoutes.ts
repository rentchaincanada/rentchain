import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { uploadBufferToGcs } from "../lib/gcs";
import multer from "multer";
import path from "path";
import { runAIAgent } from "../ai/agent";

const router = Router();

const EXPENSE_CATEGORIES = [
  "Repairs",
  "Maintenance",
  "Utilities",
  "Cleaning",
  "Supplies",
  "Landscaping",
  "Insurance",
  "Taxes",
  "Administration",
  "Contractor Labor",
  "Materials",
  "Other",
] as const;
const EXPENSE_STATUSES = ["recorded", "reimbursable", "paid"] as const;
const EXPENSE_SOURCES = ["manual", "work_order", "imported"] as const;

type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

const MAX_SOURCE_FILE_BYTES = Number(process.env.EXPENSE_UPLOAD_MAX_BYTES || 10 * 1024 * 1024);
const ALLOWED_EXTENSIONS = new Set([".csv", ".xls", ".xlsx", ".doc", ".docx", ".pdf"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "application/octet-stream",
]);

function nowMs() {
  return Date.now();
}

function normalizeRole(req: any): "admin" | "landlord" | "other" {
  const role = String(req.user?.actorRole || req.user?.role || "")
    .trim()
    .toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  return "other";
}

function toTextPreview(file: Express.Multer.File): string {
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();
  const buf = file?.buffer;
  if (!buf?.length) return "";

  // Spreadsheet CSV is plain text and yields best extraction quality.
  if (ext === ".csv") {
    return buf.toString("utf8").slice(0, 12000);
  }

  // For binary formats (pdf/doc/docx/xls/xlsx), extract printable runs as a lightweight fallback.
  const latin = buf.toString("latin1");
  const printable = latin
    .replace(/[^\x20-\x7E\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return printable.slice(0, 12000);
}

function isAllowedDocument(file: Express.Multer.File): boolean {
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();
  const mime = String(file?.mimetype || "").toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) && (ALLOWED_MIME_TYPES.has(mime) || mime === "");
}

function sanitizeFilename(raw: string): string {
  const base = path.basename(String(raw || "").trim()) || `expense_${Date.now()}`;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || `expense_${Date.now()}`;
}

function truncate(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function normalizeExtractedFields(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, any>;
}

function landlordIdFromReq(req: any): string {
  return String(req.user?.landlordId || req.user?.id || "").trim();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseDateInputToMs(value: unknown): number | null {
  if (value == null) return null;
  const direct = parseNumber(value);
  if (direct != null) return Math.round(direct);

  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = Date.parse(`${raw}T00:00:00.000Z`);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }

  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return Math.round(parsed);
  return null;
}

function normalizeCategory(raw: unknown): string {
  const target = String(raw || "").trim().toLowerCase();
  const match = EXPENSE_CATEGORIES.find((cat) => cat.toLowerCase() === target);
  return match || "";
}

function normalizeStatus(raw: unknown, fallback: ExpenseStatus = "recorded"): ExpenseStatus {
  const target = String(raw || "")
    .trim()
    .toLowerCase();
  if (target === "reimbursable") return "reimbursable";
  if (target === "paid") return "paid";
  return fallback;
}

function normalizeSource(raw: unknown, fallback: ExpenseSource = "manual"): ExpenseSource {
  const target = String(raw || "")
    .trim()
    .toLowerCase();
  if (target === "work_order") return "work_order";
  if (target === "imported") return "imported";
  return fallback;
}

function findAmountCents(text: string): number | null {
  const amountPattern =
    /(?:total|amount|balance|invoice total|due|paid)?\s*[:\-]?\s*(?:CAD|USD|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})?)/gi;
  let match: RegExpExecArray | null = null;
  let best = 0;
  while ((match = amountPattern.exec(text)) !== null) {
    const raw = String(match[1] || "").replace(/,/g, "");
    const value = Number(raw);
    if (Number.isFinite(value) && value > best) best = value;
  }
  if (best <= 0) return null;
  return Math.round(best * 100);
}

function findDateMs(text: string): number | null {
  const patterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/g,
    /\b(\d{2}\/\d{2}\/\d{4})\b/g,
    /\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/g,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const parsed = Date.parse(match[1]);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function findVendor(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);

  const tagged = lines.find((line) =>
    /^(vendor|payee|supplier|bill from|from)\s*[:\-]/i.test(line)
  );
  if (tagged) {
    return tagged.replace(/^(vendor|payee|supplier|bill from|from)\s*[:\-]\s*/i, "").slice(0, 180);
  }

  const candidate = lines.find((line) => /^[A-Za-z0-9&.,' -]{3,}$/.test(line));
  return candidate ? candidate.slice(0, 180) : undefined;
}

function findCategoryHint(text: string): string | undefined {
  const lower = text.toLowerCase();
  const map: Array<{ category: (typeof EXPENSE_CATEGORIES)[number]; hints: string[] }> = [
    { category: "Repairs", hints: ["repair", "fix", "service call"] },
    { category: "Maintenance", hints: ["maintenance", "upkeep"] },
    { category: "Utilities", hints: ["utility", "hydro", "electric", "water", "gas"] },
    { category: "Cleaning", hints: ["cleaning", "janitorial"] },
    { category: "Supplies", hints: ["supplies", "consumable"] },
    { category: "Landscaping", hints: ["landscap", "lawn", "snow removal"] },
    { category: "Insurance", hints: ["insurance", "premium"] },
    { category: "Taxes", hints: ["tax", "municipal", "property tax"] },
    { category: "Administration", hints: ["admin", "software", "subscription", "office"] },
    { category: "Contractor Labor", hints: ["contractor", "labor", "labour", "hourly"] },
    { category: "Materials", hints: ["materials", "parts", "building supply"] },
  ];
  for (const entry of map) {
    if (entry.hints.some((hint) => lower.includes(hint))) return entry.category;
  }
  return undefined;
}

function firstMeaningfulLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length >= 8 && line.length <= 220);
}

async function getPropertyForWrite(req: any, propertyId: string) {
  const propertyRef = db.collection("properties").doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) return { ok: false as const, code: "PROPERTY_NOT_FOUND" as const };

  const property = propertySnap.data() as any;
  const propertyLandlordId = String(property?.landlordId || property?.ownerId || property?.owner || "").trim();
  if (!propertyLandlordId) return { ok: false as const, code: "PROPERTY_OWNER_MISSING" as const };

  const role = normalizeRole(req);
  if (role !== "admin" && propertyLandlordId !== landlordIdFromReq(req)) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, propertyLandlordId, property };
}

async function validateUnitForExpense(req: any, opts: { unitId: string; propertyId: string }) {
  const unitRef = db.collection("units").doc(opts.unitId);
  const unitSnap = await unitRef.get();
  if (!unitSnap.exists) return { ok: false as const, code: "UNIT_NOT_FOUND" as const };

  const unit = unitSnap.data() as any;
  const unitPropertyId = String(unit?.propertyId || "").trim();
  if (!unitPropertyId || unitPropertyId !== opts.propertyId) {
    return { ok: false as const, code: "UNIT_PROPERTY_MISMATCH" as const };
  }

  const role = normalizeRole(req);
  if (role !== "admin") {
    const landlordId = landlordIdFromReq(req);
    const unitLandlordId = String(unit?.landlordId || "").trim();
    if (unitLandlordId && unitLandlordId !== landlordId) {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }
  }

  return { ok: true as const };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SOURCE_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedDocument(file)) return cb(null, true);
    return cb(new Error("UNSUPPORTED_FILE_TYPE"));
  },
});

router.post("/expenses/source-document", requireAuth, (req: any, res) => {
  upload.single("file")(req, res, async (uploadErr: any) => {
    try {
      if (uploadErr) {
        const message = String(uploadErr?.message || "");
        if (message.includes("UNSUPPORTED_FILE_TYPE")) {
          return res.status(400).json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" });
        }
        if (String(uploadErr?.code || "") === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE", maxBytes: MAX_SOURCE_FILE_BYTES });
        }
        return res.status(400).json({ ok: false, error: "UPLOAD_FAILED", detail: message || "upload_failed" });
      }

      const role = normalizeRole(req);
      if (role !== "landlord" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const propertyId = String(req.body?.propertyId || "").trim();
      if (!propertyId) return res.status(400).json({ ok: false, error: "PROPERTY_REQUIRED" });
      const propertyCheck = await getPropertyForWrite(req, propertyId);
      if (!propertyCheck.ok) {
        if (propertyCheck.code === "PROPERTY_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "PROPERTY_NOT_FOUND" });
        }
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file?.buffer || !file.originalname) {
        return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
      }
      if (!isAllowedDocument(file)) {
        return res.status(400).json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" });
      }

      const landlordId = propertyCheck.propertyLandlordId;
      const expenseId = String(req.body?.expenseId || "").trim() || `tmp_${Date.now()}`;
      const safeName = sanitizeFilename(file.originalname);
      const textPreview = toTextPreview(file);
      const targetPath = `expenses/source-documents/${landlordId}/${expenseId}/${safeName}`;
      const uploaded = await uploadBufferToGcs({
        path: targetPath,
        contentType: String(file.mimetype || "application/octet-stream"),
        buffer: file.buffer,
        metadata: {
          landlordId,
          propertyId,
          uploadedAtMs: String(nowMs()),
        },
      });

      const sourceDocumentUrl = `gs://${uploaded.bucket}/${uploaded.path}`;
      const uploadSessionRef = await db.collection("expenseUploadSessions").add({
        landlordId,
        propertyId,
        expenseId: expenseId.startsWith("tmp_") ? null : expenseId,
        sourceDocumentUrl,
        sourceDocumentName: safeName,
        sourceDocumentMimeType: String(file.mimetype || "application/octet-stream"),
        sizeBytes: Number(file.size || file.buffer.length || 0),
        textPreview,
        createdAtMs: nowMs(),
        updatedAtMs: nowMs(),
      });

      return res.json({
        ok: true,
        uploadSessionId: uploadSessionRef.id,
        sourceDocumentUrl,
        sourceDocumentName: safeName,
        sourceDocumentMimeType: String(file.mimetype || "application/octet-stream"),
        sizeBytes: Number(file.size || file.buffer.length || 0),
      });
    } catch (err: any) {
      console.error("[expenses] source document upload failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "EXPENSE_SOURCE_UPLOAD_FAILED" });
    }
  });
});

router.post("/expenses/analyze-upload", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const uploadSessionId = String(req.body?.uploadSessionId || "").trim();
    const bodyTextPreview = truncate(req.body?.textPreview, 12000);
    let textPreview = bodyTextPreview;
    let sourceDocumentName = truncate(req.body?.sourceDocumentName, 180) || "uploaded document";
    let sourceDocumentMimeType = truncate(req.body?.sourceDocumentMimeType, 120) || "";
    let sourceDocumentUrl = truncate(req.body?.sourceDocumentUrl, 600) || "";

    if (uploadSessionId) {
      const sessionSnap = await db.collection("expenseUploadSessions").doc(uploadSessionId).get();
      if (!sessionSnap.exists) {
        return res.status(404).json({ ok: false, error: "UPLOAD_SESSION_NOT_FOUND" });
      }
      const session = sessionSnap.data() as any;
      const sessionLandlordId = String(session?.landlordId || "").trim();
      if (role !== "admin" && sessionLandlordId !== landlordIdFromReq(req)) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      textPreview = textPreview || truncate(session?.textPreview, 12000);
      sourceDocumentName = sourceDocumentName || truncate(session?.sourceDocumentName, 180);
      sourceDocumentMimeType = sourceDocumentMimeType || truncate(session?.sourceDocumentMimeType, 120);
      sourceDocumentUrl = sourceDocumentUrl || truncate(session?.sourceDocumentUrl, 600);
    }

    const extractedFields: {
      vendorName?: string;
      amountCents?: number;
      incurredAtMs?: number;
      category?: string;
      description?: string;
    } = {};

    const normalizedText = String(textPreview || "").trim();
    if (normalizedText) {
      const vendorName = findVendor(normalizedText);
      const amountCents = findAmountCents(normalizedText);
      const incurredAtMs = findDateMs(normalizedText);
      const category = findCategoryHint(normalizedText);
      const description = firstMeaningfulLine(normalizedText);

      if (vendorName) extractedFields.vendorName = vendorName;
      if (amountCents != null) extractedFields.amountCents = amountCents;
      if (incurredAtMs != null) extractedFields.incurredAtMs = incurredAtMs;
      if (category) extractedFields.category = category;
      if (description) extractedFields.description = description;
    }

    let summary =
      "Detected uploaded expense document. Review extracted values before saving.";
    try {
      const ai = await runAIAgent({
        requestId: `expense_upload_${Date.now()}`,
        inputType: "expense_document_summary",
        inputData: {
          sourceDocumentName,
          sourceDocumentMimeType,
          sourceDocumentUrl,
          extractedFields,
          textPreview: normalizedText.slice(0, 5000),
        },
      });
      const aiSummary = String(ai?.output?.summary || "").trim();
      if (aiSummary) {
        summary = aiSummary.slice(0, 1200);
      }
    } catch {
      const amountText =
        extractedFields.amountCents != null
          ? `${(extractedFields.amountCents / 100).toFixed(2)}`
          : "unknown amount";
      const dateText = extractedFields.incurredAtMs
        ? new Date(extractedFields.incurredAtMs).toISOString().slice(0, 10)
        : "unknown date";
      const vendorText = extractedFields.vendorName || "unknown vendor";
      summary = `Detected expense document with ${amountText} dated ${dateText} from ${vendorText}.`;
    }

    const confidenceSignals = Object.keys(extractedFields).length;
    return res.json({
      ok: true,
      summary,
      extractedFields,
      lowConfidence: confidenceSignals < 2,
    });
  } catch (err: any) {
    console.error("[expenses] analyze upload failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_ANALYZE_UPLOAD_FAILED" });
  }
});

router.post("/expenses", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const propertyId = String(req.body?.propertyId || "").trim();
    const unitId = String(req.body?.unitId || "").trim() || null;
    const category = normalizeCategory(req.body?.category);
    const vendorName = String(req.body?.vendorName || req.body?.vendor || "")
      .trim()
      .slice(0, 180);
    const notes = String(req.body?.notes || "")
      .trim()
      .slice(0, 5000);
    const amountCentsRaw = parseNumber(req.body?.amountCents);
    const incurredAtMs = parseDateInputToMs(req.body?.incurredAtMs);

    if (!propertyId) return res.status(400).json({ ok: false, error: "PROPERTY_REQUIRED" });
    if (!category) return res.status(400).json({ ok: false, error: "CATEGORY_REQUIRED" });
    if (!incurredAtMs) return res.status(400).json({ ok: false, error: "INCURRED_AT_REQUIRED" });
    if (amountCentsRaw == null || amountCentsRaw <= 0) {
      return res.status(400).json({ ok: false, error: "AMOUNT_INVALID" });
    }

    const propertyCheck = await getPropertyForWrite(req, propertyId);
    if (!propertyCheck.ok) {
      if (propertyCheck.code === "PROPERTY_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "PROPERTY_NOT_FOUND" });
      }
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    if (unitId) {
      const unitCheck = await validateUnitForExpense(req, { unitId, propertyId });
      if (!unitCheck.ok) {
        if (unitCheck.code === "UNIT_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "UNIT_NOT_FOUND" });
        }
        if (unitCheck.code === "UNIT_PROPERTY_MISMATCH") {
          return res.status(400).json({ ok: false, error: "UNIT_PROPERTY_MISMATCH" });
        }
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
    }

    const createdAtMs = nowMs();
    const payload = {
      landlordId: propertyCheck.propertyLandlordId,
      propertyId,
      unitId,
      category,
      vendorName: vendorName || "",
      amountCents: Math.round(amountCentsRaw),
      incurredAtMs,
      notes: notes || "",
      status: normalizeStatus(req.body?.status, "recorded"),
      source: normalizeSource(req.body?.source, "manual"),
      linkedWorkOrderId: String(req.body?.linkedWorkOrderId || "").trim() || null,
      receiptFileUrl: String(req.body?.receiptFileUrl || "").trim() || null,
      sourceDocumentUrl: truncate(req.body?.sourceDocumentUrl, 600) || null,
      sourceDocumentName: truncate(req.body?.sourceDocumentName, 180) || null,
      sourceDocumentMimeType: truncate(req.body?.sourceDocumentMimeType, 120) || null,
      aiSummary: truncate(req.body?.aiSummary, 5000) || null,
      aiExtractedFields: normalizeExtractedFields(req.body?.aiExtractedFields),
      aiProcessedAtMs: parseNumber(req.body?.aiProcessedAtMs),
      createdAtMs,
      updatedAtMs: createdAtMs,
    };

    const ref = await db.collection("expenses").add(payload);
    return res.json({ ok: true, item: { id: ref.id, ...payload } });
  } catch (err: any) {
    console.error("[expenses] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_CREATE_FAILED" });
  }
});

router.get("/expenses", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const landlordScope = role === "admin" ? String(req.query?.landlordId || "").trim() : landlordIdFromReq(req);
    if (role !== "admin" && !landlordScope) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const propertyId = String(req.query?.propertyId || "").trim() || null;
    const unitId = String(req.query?.unitId || "").trim() || null;
    const category = normalizeCategory(req.query?.category);
    const dateFrom = parseDateInputToMs(req.query?.dateFrom);
    const dateTo = parseDateInputToMs(req.query?.dateTo);
    const limitRaw = parseNumber(req.query?.limit);
    const limit = Math.min(500, Math.max(1, Math.round(limitRaw || 200)));

    let query = db.collection("expenses") as FirebaseFirestore.Query;
    if (landlordScope) {
      query = query.where("landlordId", "==", landlordScope);
    }

    const snap = await query.limit(limit).get();
    let items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

    if (propertyId) items = items.filter((row) => String((row as any).propertyId || "") === propertyId);
    if (unitId) items = items.filter((row) => String((row as any).unitId || "") === unitId);
    if (category) {
      items = items.filter((row) => normalizeCategory((row as any).category) === category);
    }
    if (dateFrom != null) items = items.filter((row) => Number((row as any).incurredAtMs || 0) >= dateFrom);
    if (dateTo != null) items = items.filter((row) => Number((row as any).incurredAtMs || 0) <= dateTo);

    items.sort((a: any, b: any) => Number(b.incurredAtMs || 0) - Number(a.incurredAtMs || 0));
    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[expenses] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_LIST_FAILED" });
  }
});

router.patch("/expenses/:expenseId", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const expenseId = String(req.params?.expenseId || "").trim();
    if (!expenseId) return res.status(400).json({ ok: false, error: "MISSING_EXPENSE_ID" });

    const ref = db.collection("expenses").doc(expenseId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "EXPENSE_NOT_FOUND" });

    const current = snap.data() as any;
    const currentLandlordId = String(current?.landlordId || "").trim();
    if (role !== "admin" && currentLandlordId !== landlordIdFromReq(req)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const nextPropertyId = String(req.body?.propertyId || current?.propertyId || "").trim();
    if (!nextPropertyId) return res.status(400).json({ ok: false, error: "PROPERTY_REQUIRED" });
    const propertyCheck = await getPropertyForWrite(req, nextPropertyId);
    if (!propertyCheck.ok) {
      if (propertyCheck.code === "PROPERTY_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "PROPERTY_NOT_FOUND" });
      }
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const nextUnitId = Object.prototype.hasOwnProperty.call(req.body || {}, "unitId")
      ? String(req.body?.unitId || "").trim() || null
      : String(current?.unitId || "").trim() || null;
    if (nextUnitId) {
      const unitCheck = await validateUnitForExpense(req, { unitId: nextUnitId, propertyId: nextPropertyId });
      if (!unitCheck.ok) {
        if (unitCheck.code === "UNIT_NOT_FOUND") {
          return res.status(404).json({ ok: false, error: "UNIT_NOT_FOUND" });
        }
        if (unitCheck.code === "UNIT_PROPERTY_MISMATCH") {
          return res.status(400).json({ ok: false, error: "UNIT_PROPERTY_MISMATCH" });
        }
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
    }

    const patch: any = {
      propertyId: nextPropertyId,
      unitId: nextUnitId,
      landlordId: propertyCheck.propertyLandlordId,
      updatedAtMs: nowMs(),
    };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "category")) {
      const nextCategory = normalizeCategory(req.body?.category);
      if (!nextCategory) return res.status(400).json({ ok: false, error: "CATEGORY_REQUIRED" });
      patch.category = nextCategory;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "amountCents")) {
      const nextAmount = parseNumber(req.body?.amountCents);
      if (nextAmount == null || nextAmount <= 0) {
        return res.status(400).json({ ok: false, error: "AMOUNT_INVALID" });
      }
      patch.amountCents = Math.round(nextAmount);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "incurredAtMs")) {
      const nextIncurredAtMs = parseDateInputToMs(req.body?.incurredAtMs);
      if (!nextIncurredAtMs) return res.status(400).json({ ok: false, error: "INCURRED_AT_REQUIRED" });
      patch.incurredAtMs = nextIncurredAtMs;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "vendorName")) {
      patch.vendorName = String(req.body?.vendorName || "").trim().slice(0, 180);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "notes")) {
      patch.notes = String(req.body?.notes || "").trim().slice(0, 5000);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "status")) {
      patch.status = normalizeStatus(req.body?.status, normalizeStatus(current?.status, "recorded"));
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "source")) {
      patch.source = normalizeSource(req.body?.source, normalizeSource(current?.source, "manual"));
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "linkedWorkOrderId")) {
      patch.linkedWorkOrderId = String(req.body?.linkedWorkOrderId || "").trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "receiptFileUrl")) {
      patch.receiptFileUrl = String(req.body?.receiptFileUrl || "").trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "sourceDocumentUrl")) {
      patch.sourceDocumentUrl = truncate(req.body?.sourceDocumentUrl, 600) || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "sourceDocumentName")) {
      patch.sourceDocumentName = truncate(req.body?.sourceDocumentName, 180) || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "sourceDocumentMimeType")) {
      patch.sourceDocumentMimeType = truncate(req.body?.sourceDocumentMimeType, 120) || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "aiSummary")) {
      patch.aiSummary = truncate(req.body?.aiSummary, 5000) || null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "aiExtractedFields")) {
      patch.aiExtractedFields = normalizeExtractedFields(req.body?.aiExtractedFields);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "aiProcessedAtMs")) {
      patch.aiProcessedAtMs = parseNumber(req.body?.aiProcessedAtMs);
    }

    await ref.set(patch, { merge: true });
    const updatedSnap = await ref.get();
    return res.json({ ok: true, item: { id: updatedSnap.id, ...(updatedSnap.data() as any) } });
  } catch (err: any) {
    console.error("[expenses] update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_UPDATE_FAILED" });
  }
});

export default router;
