import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { uploadBufferToGcs } from "../lib/gcs";
import multer from "multer";
import path from "path";
import Papa from "papaparse";
import PDFDocument from "pdfkit";
import { runAIAgent } from "../ai/agent";
import { buildDatedExportFilename, setAttachmentExportHeaders } from "../lib/exports/exportResponse";
import { getUserEntitlements } from "../services/entitlementsService";
import {
  confirmExpenseImport,
  previewDelimitedExpenseFile,
  previewDocumentTextFile,
  previewSpreadsheetXmlFile,
} from "../services/expenses/expenseIngestionService";
import type {
  ExpenseImportConfirmRow,
  ExpenseExistingLookupRow,
  ExpenseImportPreviewResult,
  ExpensePropertyOption,
  ExpenseUnitOption,
} from "../services/expenses/expenseIngestionTypes";
import { writeCanonicalEvent } from "../lib/events/buildEvent";

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
const ALLOWED_EXTENSIONS = new Set([".csv", ".xls", ".xlsx", ".doc", ".docx", ".pdf", ".jpg", ".jpeg", ".png"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "image/jpeg",
  "image/png",
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

function resolvePropertyLabel(raw: any): string {
  return (
    String(raw?.name || raw?.addressLine1 || raw?.address || raw?.displayName || raw?.propertyName || "").trim() ||
    "Property"
  );
}

function resolveUnitLabel(raw: any): string {
  return (
    String(raw?.unitNumber || raw?.name || raw?.label || raw?.displayLabel || raw?.unitLabel || "").trim() || "Unit"
  );
}

async function getExpenseEntitlements(req: any) {
  const userId = String(req.user?.id || "").trim();
  return getUserEntitlements(userId, {
    claimsRole: req.user?.actorRole || req.user?.role || null,
    claimsPlan: req.user?.plan || null,
    landlordIdHint: landlordIdFromReq(req),
    emailHint: req.user?.email || null,
  });
}

async function listExpenseImportPropertiesAndUnits(req: any, landlordId: string) {
  const role = normalizeRole(req);
  let propertyQuery: FirebaseFirestore.Query = db.collection("properties");
  let unitQuery: FirebaseFirestore.Query = db.collection("units");
  if (role !== "admin") {
    propertyQuery = propertyQuery.where("landlordId", "==", landlordId);
    unitQuery = unitQuery.where("landlordId", "==", landlordId);
  }
  const [propertySnap, unitSnap] = await Promise.all([propertyQuery.limit(500).get(), unitQuery.limit(1000).get()]);

  const properties: ExpensePropertyOption[] = propertySnap.docs.map((doc) => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      name: String(data?.name || data?.addressLine1 || data?.address || doc.id),
    };
  });
  const units: ExpenseUnitOption[] = unitSnap.docs.map((doc) => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      propertyId: String(data?.propertyId || "").trim(),
      label: String(data?.unitNumber || data?.label || data?.name || data?.unitLabel || doc.id),
    };
  });
  return { properties, units };
}

async function listExistingExpensesForImport(req: any, landlordId: string, properties: ExpensePropertyOption[]) {
  const role = normalizeRole(req);
  let query: FirebaseFirestore.Query = db.collection("expenses");
  if (role !== "admin") {
    query = query.where("landlordId", "==", landlordId);
  }
  const snap = await query.limit(1200).get();
  const propertyNames = new Map(properties.map((property) => [property.id, property.name]));
  return snap.docs.map((doc) => {
    const data = doc.data() as any;
    const incurredAtMs = Number(data?.incurredAtMs || 0);
    return {
      expenseId: doc.id,
      date: Number.isFinite(incurredAtMs) && incurredAtMs > 0 ? new Date(incurredAtMs).toISOString().slice(0, 10) : null,
      amount: Number.isFinite(Number(data?.amountCents)) ? Number(data.amountCents) / 100 : null,
      vendor: String(data?.vendorName || "").trim() || null,
      description: String(data?.notes || "").trim() || null,
      property: propertyNames.get(String(data?.propertyId || "").trim()) || null,
      propertyId: String(data?.propertyId || "").trim() || null,
    } satisfies ExpenseExistingLookupRow;
  });
}

async function requireProExpenseAccess(req: any, res: any) {
  const entitlements = await getExpenseEntitlements(req);
  if (entitlements.role !== "admin" && !["pro", "elite"].includes(String(entitlements.plan || ""))) {
    res.status(403).json({
      ok: false,
      error: "UPGRADE_REQUIRED",
      featureKey: "expenses.export",
      requiredPlan: "pro",
      currentPlan: entitlements.plan,
      message: "Upgrade to Pro for CSV import and accountant-ready exports.",
    });
    return null;
  }
  return entitlements;
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

type AmountCandidate = {
  amountCents: number;
  raw: string;
  context: string;
  confidenceTag: "total" | "amount_due" | "balance_due" | "subtotal" | "generic";
  score: number;
};

function scoreAmountCandidate(context: string): { tag: AmountCandidate["confidenceTag"]; score: number } {
  const lower = String(context || "").toLowerCase();
  if (/\b(grand total|invoice total|total due)\b/.test(lower)) return { tag: "total", score: 100 };
  if (/\b(amount due|amount payable|pay this amount)\b/.test(lower)) return { tag: "amount_due", score: 96 };
  if (/\b(balance due|balance)\b/.test(lower)) return { tag: "balance_due", score: 92 };
  if (/\bsubtotal\b/.test(lower)) return { tag: "subtotal", score: 70 };
  return { tag: "generic", score: 55 };
}

function extractAmountCandidates(text: string): {
  amountCents: number | null;
  candidateAmounts: number[];
  rawCandidates: Array<{
    amountCents: number;
    raw: string;
    context: string;
    confidenceTag: AmountCandidate["confidenceTag"];
  }>;
  lowConfidence: boolean;
} {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 800);

  const candidates: AmountCandidate[] = [];
  const currencyPattern = /(?:CAD|USD|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})?)/gi;

  for (const row of rows) {
    let match: RegExpExecArray | null = null;
    while ((match = currencyPattern.exec(row)) !== null) {
      const amountRaw = String(match[1] || "").replace(/,/g, "");
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const amountCents = Math.round(amount * 100);
      const scored = scoreAmountCandidate(row);
      let score = scored.score;
      if (/\b(item|line item|qty|quantity|unit price|tax|fee|shipping)\b/i.test(row)) {
        score -= 12;
      }

      candidates.push({
        amountCents,
        raw: amountRaw,
        context: row.slice(0, 240),
        confidenceTag: scored.tag,
        score,
      });
    }
  }

  if (!candidates.length) {
    return { amountCents: null, candidateAmounts: [], rawCandidates: [], lowConfidence: true };
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.amountCents - a.amountCents;
  });

  const uniqueAmounts = Array.from(new Set(candidates.map((c) => c.amountCents)));
  const top = candidates[0];
  const second = candidates[1];
  const scoreGap = second ? top.score - second.score : 999;
  const topCount = candidates.filter((c) => c.score === top.score).length;
  const lowConfidence = uniqueAmounts.length > 1 && (scoreGap < 12 || topCount > 1 || top.confidenceTag === "generic");

  return {
    amountCents: lowConfidence ? null : top.amountCents,
    candidateAmounts: uniqueAmounts.slice(0, 6),
    rawCandidates: candidates.slice(0, 6).map((c) => ({
      amountCents: c.amountCents,
      raw: c.raw,
      context: c.context,
      confidenceTag: c.confidenceTag,
    })),
    lowConfidence,
  };
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

async function getPropertyForRead(req: any, propertyId: string) {
  const propertyRef = db.collection("properties").doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) return null;
  const property = propertySnap.data() as any;
  const propertyLandlordId = String(property?.landlordId || property?.ownerId || property?.owner || "").trim();
  if (!propertyLandlordId) return null;
  const role = normalizeRole(req);
  if (role !== "admin" && propertyLandlordId !== landlordIdFromReq(req)) {
    return null;
  }
  return { id: propertySnap.id, ...property };
}

function toIsoDateFromMs(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeCsvHeader(value: unknown): string {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeLookupKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCsvValue(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
  }
  return "";
}

function parseAmountToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  const raw = String(value || "").trim().replace(/[$,\s]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

async function findPropertyForImport(req: any, landlordId: string, rawPropertyId: string, rawPropertyName: string) {
  const directId = String(rawPropertyId || "").trim();
  if (directId) {
    const direct = await getPropertyForRead(req, directId);
    if (direct) return direct;
  }

  const nameKey = normalizeLookupKey(rawPropertyName);
  if (!nameKey) return null;

  const role = normalizeRole(req);
  let query: FirebaseFirestore.Query = db.collection("properties");
  if (role !== "admin") {
    query = query.where("landlordId", "==", landlordId);
  }

  const snap = await query.limit(300).get();
  const match = snap.docs.find((doc) => {
    const property = doc.data() as any;
    const candidates = [
      property?.name,
      property?.addressLine1,
      property?.address,
      property?.label,
    ]
      .map((value) => normalizeLookupKey(value))
      .filter(Boolean);
    return candidates.includes(nameKey);
  });

  if (!match) return null;
  const property = match.data() as any;
  return { id: match.id, ...property };
}

async function findUnitForImport(
  req: any,
  landlordId: string,
  propertyId: string,
  rawUnitId: string,
  rawUnitLabel: string
) {
  const directId = String(rawUnitId || "").trim();
  if (directId) {
    const direct = await validateUnitForExpense(req, { unitId: directId, propertyId });
    if (direct.ok) return { id: directId };
  }

  const unitKey = normalizeLookupKey(rawUnitLabel);
  if (!unitKey) return null;

  const role = normalizeRole(req);
  let query: FirebaseFirestore.Query = db.collection("units").where("propertyId", "==", propertyId);
  if (role !== "admin") {
    query = query.where("landlordId", "==", landlordId);
  }

  const snap = await query.limit(300).get();
  const match = snap.docs.find((doc) => {
    const unit = doc.data() as any;
    const candidates = [
      doc.id,
      unit?.unitNumber,
      unit?.label,
      unit?.name,
      unit?.unitLabel,
      unit?.unitName,
      unit?.displayName,
    ]
      .map((value) => normalizeLookupKey(value))
      .filter(Boolean);
    return candidates.includes(unitKey);
  });

  return match ? { id: match.id, ...(match.data() as any) } : null;
}

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

type ExpenseQueryOptions = {
  propertyId?: string | null;
  unitId?: string | null;
  category?: string | null;
  dateFrom?: number | null;
  dateTo?: number | null;
  includeArchivedProperties?: boolean;
  limit?: number;
};

async function listExpensesForRequest(req: any, options: ExpenseQueryOptions = {}) {
  const role = normalizeRole(req);
  if (role !== "landlord" && role !== "admin") {
    return { ok: false as const, status: 403, error: "FORBIDDEN", items: [] as any[] };
  }

  const landlordScope = role === "admin" ? String(req.query?.landlordId || "").trim() : landlordIdFromReq(req);
  if (role !== "admin" && !landlordScope) {
    return { ok: false as const, status: 401, error: "UNAUTHORIZED", items: [] as any[] };
  }

  const propertyId = options.propertyId ?? (String(req.query?.propertyId || "").trim() || null);
  const unitId = options.unitId ?? (String(req.query?.unitId || "").trim() || null);
  const category = options.category ?? normalizeCategory(req.query?.category);
  const dateFrom = options.dateFrom ?? parseDateInputToMs(req.query?.dateFrom);
  const dateTo = options.dateTo ?? parseDateInputToMs(req.query?.dateTo);
  const includeArchivedProperties =
    options.includeArchivedProperties ??
    (String(req.query?.includeArchivedProperties || "").trim() === "1" ||
      String(req.query?.includeArchivedProperties || "").trim().toLowerCase() === "true");
  const limitRaw = options.limit ?? parseNumber(req.query?.limit);
  const limit = Math.min(1000, Math.max(1, Math.round(limitRaw || 200)));

  let query = db.collection("expenses") as FirebaseFirestore.Query;
  if (landlordScope) {
    query = query.where("landlordId", "==", landlordScope);
  }

  const snap = await query.limit(limit).get();
  let items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));

  if (propertyId) items = items.filter((row) => String((row as any).propertyId || "") === propertyId);
  if (unitId) items = items.filter((row) => String((row as any).unitId || "") === unitId);
  if (category) items = items.filter((row) => normalizeCategory((row as any).category) === category);
  if (dateFrom != null) items = items.filter((row) => Number((row as any).incurredAtMs || 0) >= dateFrom);
  if (dateTo != null) items = items.filter((row) => Number((row as any).incurredAtMs || 0) <= dateTo);

  if (!includeArchivedProperties) {
    const propertyIds = Array.from(new Set(items.map((item: any) => String(item.propertyId || "").trim()).filter(Boolean)));
    const propertySnaps = await Promise.all(propertyIds.map((id) => db.collection("properties").doc(id).get()));
    const archivedIds = new Set(
      propertySnaps
        .filter((snap) => snap.exists && String((snap.data() as any)?.portfolioStatus || "").trim().toLowerCase() === "archived")
        .map((snap) => snap.id)
    );
    if (archivedIds.size > 0) {
      items = items.filter((row: any) => !archivedIds.has(String(row.propertyId || "")));
    }
  }

  items.sort((a: any, b: any) => Number(b.incurredAtMs || 0) - Number(a.incurredAtMs || 0));
  return { ok: true as const, items };
}

async function buildExpenseExportRows(items: any[], propertyNames: Map<string, string>) {
  const unitIds = Array.from(new Set(items.map((item: any) => String(item.unitId || "").trim()).filter(Boolean)));
  const unitSnaps = await Promise.all(unitIds.map((id) => db.collection("units").doc(id).get()));
  const unitLabels = new Map<string, string>();
  unitSnaps.forEach((snap) => {
    if (!snap.exists) return;
    unitLabels.set(snap.id, resolveUnitLabel(snap.data() as any));
  });

  return items.map((item: any) => ({
    date: toIsoDateFromMs(Number(item.incurredAtMs || 0)),
    property: propertyNames.get(String(item.propertyId || "").trim()) || "Property",
    unit: item.unitId ? unitLabels.get(String(item.unitId || "").trim()) || "Unit" : "",
    category: String(item.category || ""),
    vendor: String(item.vendorName || ""),
    description: String(item.notes || ""),
    amount: (Number(item.amountCents || 0) / 100).toFixed(2),
    status: String(item.status || ""),
    source: String(item.source || ""),
  }));
}

function renderExpenseSpreadsheetXml(rows: Array<Record<string, string>>, totalAmountCents: number) {
  const headers = ["Date", "Property", "Unit", "Category", "Vendor", "Description", "Amount", "Status", "Source"];
  const xmlEscape = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const rowXml = rows
    .map((row) => {
      const cells = [
        row.date,
        row.property,
        row.unit,
        row.category,
        row.vendor,
        row.description,
        row.amount,
        row.status,
        row.source,
      ]
        .map(
          (value) =>
            `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`
        )
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
  <Worksheet ss:Name="Expenses">
    <Table>
      <Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join("")}</Row>
      ${rowXml}
      <Row>
        <Cell><Data ss:Type="String">Total</Data></Cell>
        <Cell/><Cell/><Cell/><Cell/><Cell/>
        <Cell><Data ss:Type="String">${(totalAmountCents / 100).toFixed(2)}</Data></Cell>
        <Cell/><Cell/>
      </Row>
    </Table>
  </Worksheet>
</Workbook>`;
}

async function renderExpensePdf(params: {
  rows: Array<Record<string, string>>;
  title: string;
  subtitle: string;
  totalAmountCents: number;
}) {
  const doc = new PDFDocument({ size: "LETTER", margin: 42 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(18).font("Helvetica-Bold").text(params.title);
  doc.moveDown(0.25);
  doc.fontSize(10).font("Helvetica").fillColor("#475569").text(params.subtitle);
  doc.moveDown(0.75);

  const headers = ["Date", "Property", "Category", "Vendor", "Amount"];
  const colX = [42, 110, 250, 360, 500];
  doc.fontSize(9).fillColor("#0f172a").font("Helvetica-Bold");
  headers.forEach((header, idx) => {
    doc.text(header, colX[idx], doc.y, { width: idx === headers.length - 1 ? 60 : colX[idx + 1] - colX[idx] - 8 });
  });
  doc.moveDown(0.4);
  doc.strokeColor("#cbd5e1").moveTo(42, doc.y).lineTo(570, doc.y).stroke();
  doc.moveDown(0.35);

  doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
  params.rows.forEach((row) => {
    const rowY = doc.y;
    const values = [row.date, row.property, row.category, row.vendor, `$${row.amount}`];
    values.forEach((value, idx) => {
      doc.text(value || "-", colX[idx], rowY, {
        width: idx === values.length - 1 ? 60 : colX[idx + 1] - colX[idx] - 8,
        ellipsis: true,
      });
    });
    doc.moveDown(0.5);
    if (doc.y > 720) doc.addPage();
  });

  doc.moveDown(0.75);
  doc.font("Helvetica-Bold").fontSize(10).text(`Total: $${(params.totalAmountCents / 100).toFixed(2)}`);
  doc.end();
  return done;
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
    let candidateAmounts: number[] = [];
    let rawCandidates: Array<{
      amountCents: number;
      raw: string;
      context: string;
      confidenceTag: "total" | "amount_due" | "balance_due" | "subtotal" | "generic";
    }> = [];
    let amountLowConfidence = false;

    const normalizedText = String(textPreview || "").trim();
    if (normalizedText) {
      const vendorName = findVendor(normalizedText);
      const amountExtraction = extractAmountCandidates(normalizedText);
      const amountCents = amountExtraction.amountCents;
      const incurredAtMs = findDateMs(normalizedText);
      const category = findCategoryHint(normalizedText);
      const description = firstMeaningfulLine(normalizedText);
      candidateAmounts = amountExtraction.candidateAmounts;
      rawCandidates = amountExtraction.rawCandidates;
      amountLowConfidence = amountExtraction.lowConfidence;

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
          candidateAmounts,
          rawCandidates,
          summaryRules: [
            "Never invent values.",
            "Use only explicit values visible in the document.",
            "If amount/date/vendor is ambiguous, explicitly say unclear.",
          ],
          textPreview: normalizedText.slice(0, 5000),
        },
      });
      const aiSummary = String(ai?.output?.summary || "").trim();
      if (aiSummary) {
        summary = aiSummary.slice(0, 1200);
      }
    } catch {
      const amountText =
        amountLowConfidence && candidateAmounts.length > 1
          ? "unclear"
          : extractedFields.amountCents != null
          ? `${(extractedFields.amountCents / 100).toFixed(2)}`
          : "unclear";
      const dateText = extractedFields.incurredAtMs
        ? new Date(extractedFields.incurredAtMs).toISOString().slice(0, 10)
        : "unclear";
      const vendorText = extractedFields.vendorName || "unclear";
      summary = `Detected expense document with ${amountText} dated ${dateText} from ${vendorText}.`;
    }

    const confidenceSignals = Object.keys(extractedFields).length;
    const lowConfidence = amountLowConfidence || confidenceSignals < 2;
    return res.json({
      ok: true,
      summary,
      extractedFields,
      lowConfidence,
      candidateAmounts,
      rawCandidates,
    });
  } catch (err: any) {
    console.error("[expenses] analyze upload failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_ANALYZE_UPLOAD_FAILED" });
  }
});

router.post("/expenses/import/preview", requireAuth, (req: any, res) => {
  upload.array("files", 12)(req, res, async (uploadErr: any) => {
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

      const entitlements = await requireProExpenseAccess(req, res);
      if (!entitlements) return;

      const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
      if (!files.length) {
        return res.status(400).json({ ok: false, error: "FILES_REQUIRED" });
      }

      const landlordId = entitlements.landlordId || landlordIdFromReq(req);
      const { properties, units } = await listExpenseImportPropertiesAndUnits(req, landlordId);
      const existingExpenses = await listExistingExpensesForImport(req, landlordId, properties);
      const defaultPropertyId = String(req.body?.defaultPropertyId || "").trim() || null;

      const previews: ExpenseImportPreviewResult[] = [];
      for (const file of files) {
        const fileName = sanitizeFilename(file.originalname || `expense-import-${Date.now()}`);
        const ext = path.extname(fileName).toLowerCase();
        const textPreview = toTextPreview(file);

        if (ext === ".csv") {
          previews.push(
            previewDelimitedExpenseFile({
              fileName,
              csvText: file.buffer.toString("utf8"),
              properties,
              units,
              defaultPropertyId,
              existingExpenses,
            })
          );
          continue;
        }

        if (ext === ".xls" || ext === ".xlsx") {
          const spreadsheetText = file.buffer.toString("utf8");
          const isSpreadsheetXml = spreadsheetText.includes("<Workbook") && spreadsheetText.includes("<Row>");
          previews.push(
            isSpreadsheetXml
              ? previewSpreadsheetXmlFile({
                  fileName,
                  xmlText: spreadsheetText,
                  properties,
                  units,
                  defaultPropertyId,
                  existingExpenses,
                })
              : previewDelimitedExpenseFile({
                  fileName,
                  csvText: textPreview,
                  properties,
                  units,
                  defaultPropertyId,
                  existingExpenses,
                })
          );
          continue;
        }

        let aiSummary: string | null = null;
        try {
          const ai = await runAIAgent({
            requestId: `expense_import_preview_${Date.now()}_${fileName}`,
            inputType: "expense_import_preview",
            inputData: {
              sourceDocumentName: fileName,
              sourceDocumentMimeType: String(file.mimetype || ""),
              textPreview: textPreview.slice(0, 4000),
              instruction:
                "Summarize likely expense details and call out anything that needs manual review. Do not assume missing values.",
            },
          });
          aiSummary = String(ai?.output?.summary || "").trim() || null;
        } catch {
          aiSummary = null;
        }

        previews.push(
          previewDocumentTextFile({
            fileName,
            textPreview,
            properties,
            units,
            aiSummary,
            existingExpenses,
          })
        );
      }

      const mergedRows = previews.flatMap((preview) => preview.rows);
      const mergedFiles = previews.flatMap((preview) => preview.files);
      const summary = {
        parsed: mergedRows.length,
        lowConfidence: mergedRows.filter((row) => (row.confidence ?? 0) < 0.75).length,
        unresolvedProperty: mergedRows.filter((row) => !row.propertyId).length,
        unresolvedUnit: mergedRows.filter((row) => Boolean(row.unit) && !row.unitId).length,
      };

      return res.json({
        ok: true,
        files: mergedFiles,
        rows: mergedRows,
        summary,
      });
    } catch (err: any) {
      console.error("[expenses] import preview failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "EXPENSE_IMPORT_PREVIEW_FAILED" });
    }
  });
});

router.post("/expenses/import/confirm", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const entitlements = await requireProExpenseAccess(req, res);
    if (!entitlements) return;

    const rows = Array.isArray(req.body?.rows) ? (req.body.rows as ExpenseImportConfirmRow[]) : [];
    if (!rows.length) {
      return res.status(400).json({ ok: false, error: "ROWS_REQUIRED" });
    }

    const landlordId = entitlements.landlordId || landlordIdFromReq(req);
    const { properties, units } = await listExpenseImportPropertiesAndUnits(req, landlordId);
    const result = await confirmExpenseImport({
      rows,
      properties,
      units,
      createExpense: async (payload) => {
        const createdAtMs = nowMs();
        await db.collection("expenses").add({
          landlordId,
          propertyId: payload.propertyId,
          unitId: payload.unitId,
          category: payload.category,
          vendorName: payload.vendorName,
          amountCents: payload.amountCents,
          incurredAtMs: payload.incurredAtMs,
          notes: payload.notes,
          status: "recorded",
          source: "imported",
          linkedWorkOrderId: null,
          receiptFileUrl: null,
          sourceDocumentUrl: null,
          sourceDocumentName: payload.sourceDocumentName,
          sourceDocumentMimeType: payload.sourceDocumentMimeType || null,
          aiSummary: payload.aiSummary || null,
          aiExtractedFields: null,
          aiProcessedAtMs: createdAtMs,
          createdAtMs,
          updatedAtMs: createdAtMs,
        });
      },
    });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[expenses] import confirm failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_IMPORT_CONFIRM_FAILED" });
  }
});

router.post("/expenses", requireAuth, async (req: any, res) => {
  try {
    console.log("[route-hit] expenses", {
      method: req.method,
      path: req.path,
      userId: String(req.user?.id || ""),
    });
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
    await writeCanonicalEvent({
      domain: "expense",
      action: "created",
      status: payload.status,
      actor: {
        type: role === "admin" ? "admin" : "landlord",
        role: role === "admin" ? "admin" : "landlord",
        id: propertyCheck.propertyLandlordId,
      },
      resource: {
        type: "expense",
        id: ref.id,
      },
      occurredAt: createdAtMs,
      visibility: "internal",
      summary: "Expense created",
      metadata: {
        landlordId: propertyCheck.propertyLandlordId,
        propertyId,
        unitId,
        amountCents: payload.amountCents,
        category,
        source: payload.source,
      },
    });
    return res.json({ ok: true, item: { id: ref.id, ...payload } });
  } catch (err: any) {
    console.error("[expenses] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_CREATE_FAILED" });
  }
});

router.get("/expenses", requireAuth, async (req: any, res) => {
  try {
    const result = await listExpensesForRequest(req);
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }
    return res.json({ ok: true, items: result.items });
  } catch (err: any) {
    console.error("[expenses] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_LIST_FAILED" });
  }
});

router.delete("/expenses/:expenseId", requireAuth, async (req: any, res) => {
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

    await ref.delete();
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[expenses] delete failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_DELETE_FAILED" });
  }
});

router.post("/expenses/import/csv", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const entitlements = await requireProExpenseAccess(req, res);
    if (!entitlements) return;

    const csvText = String(req.body?.csvText || "").trim();
    const defaultPropertyId = String(req.body?.defaultPropertyId || "").trim() || null;
    if (!csvText) {
      return res.status(400).json({ ok: false, error: "CSV_REQUIRED" });
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => normalizeCsvHeader(header),
    });

    const landlordId = entitlements.landlordId || landlordIdFromReq(req);
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    for (let index = 0; index < (parsed.data || []).length; index += 1) {
      const row = parsed.data[index] || {};
      const propertyRef = getCsvValue(row, "propertyid") || String(defaultPropertyId || "").trim();
      const propertyName = getCsvValue(row, "property");
      const unitRef = getCsvValue(row, "unitid");
      const unitLabel = getCsvValue(row, "unit");
      const category = normalizeCategory(getCsvValue(row, "category"));
      const amountCents = parseAmountToCents(getCsvValue(row, "amount"));
      const incurredAtMs = parseDateInputToMs(
        getCsvValue(row, "date", "incurredat", "incurredatms")
      );
      const vendorName = getCsvValue(row, "vendor", "vendorname").slice(0, 180);
      const notes = getCsvValue(row, "notes", "description").slice(0, 5000);

      if ((!propertyRef && !propertyName) || !category || amountCents == null || amountCents < 0 || !incurredAtMs) {
        skipped += 1;
        errors.push(`Row ${index + 2}: missing property, category, amount, or date.`);
        continue;
      }

      const property = await findPropertyForImport(req, landlordId, propertyRef, propertyName);
      if (!property) {
        skipped += 1;
        errors.push(
          `Row ${index + 2}: property "${propertyName || propertyRef}" was not found in your portfolio.`
        );
        continue;
      }

      let unitId: string | null = null;
      if (unitRef || unitLabel) {
        const unit = await findUnitForImport(req, landlordId, property.id, unitRef, unitLabel);
        if (!unit) {
          skipped += 1;
          errors.push(
            `Row ${index + 2}: unit "${unitLabel || unitRef}" was not found for property "${propertyName || property.id}".`
          );
          continue;
        }
        unitId = unit.id;
      }

      const createdAtMs = nowMs();
      const payload = {
        landlordId,
        propertyId: property.id,
        unitId,
        category,
        vendorName,
        amountCents,
        incurredAtMs,
        notes,
        status: "recorded",
        source: "imported" as const,
        linkedWorkOrderId: null,
        receiptFileUrl: null,
        sourceDocumentUrl: null,
        sourceDocumentName: null,
        sourceDocumentMimeType: "text/csv",
        aiSummary: null,
        aiExtractedFields: null,
        aiProcessedAtMs: null,
        createdAtMs,
        updatedAtMs: createdAtMs,
      };

      await db.collection("expenses").add(payload);
      imported += 1;
    }

    return res.json({
      ok: true,
      rowsImported: imported,
      rowsSkipped: skipped,
      errors: errors.slice(0, 50),
    });
  } catch (err: any) {
    console.error("[expenses] csv import failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_IMPORT_FAILED" });
  }
});

router.get("/expenses/export.csv", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const entitlements = await requireProExpenseAccess(req, res);
    if (!entitlements) return;

    const result = await listExpensesForRequest(req, { includeArchivedProperties: true, limit: 1000 });
    if (!result.ok) return res.status(result.status).json({ ok: false, error: result.error });

    const propertyIds = Array.from(new Set(result.items.map((item: any) => String(item.propertyId || "").trim()).filter(Boolean)));
    const propertySnaps = await Promise.all(propertyIds.map((id) => db.collection("properties").doc(id).get()));
    const propertyNames = new Map<string, string>();
    propertySnaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() as any;
      propertyNames.set(snap.id, resolvePropertyLabel(data));
    });
    const rows = await buildExpenseExportRows(result.items, propertyNames);
    const csv = [
      ["date", "property", "unit", "category", "vendor", "description", "amount", "status", "source"].join(","),
      ...rows.map((row) =>
        [row.date, row.property, row.unit, row.category, row.vendor, row.description, row.amount, row.status, row.source]
          .map(csvEscape)
          .join(",")
      ),
    ].join("\n");

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-expenses", format: "csv" }),
      format: "csv",
    });
    return res.status(200).send(csv);
  } catch (err: any) {
    console.error("[expenses] csv export failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_EXPORT_FAILED" });
  }
});

async function handleExpenseSpreadsheetExport(req: any, res: any) {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const entitlements = await requireProExpenseAccess(req, res);
    if (!entitlements) return;

    const result = await listExpensesForRequest(req, { includeArchivedProperties: true, limit: 1000 });
    if (!result.ok) return res.status(result.status).json({ ok: false, error: result.error });

    const propertyIds = Array.from(new Set(result.items.map((item: any) => String(item.propertyId || "").trim()).filter(Boolean)));
    const propertySnaps = await Promise.all(propertyIds.map((id) => db.collection("properties").doc(id).get()));
    const propertyNames = new Map<string, string>();
    propertySnaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() as any;
      propertyNames.set(snap.id, resolvePropertyLabel(data));
    });
    const rows = await buildExpenseExportRows(result.items, propertyNames);
    const totalAmountCents = result.items.reduce((sum: number, item: any) => sum + Number(item.amountCents || 0), 0);
    const xml = renderExpenseSpreadsheetXml(rows, totalAmountCents);

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-expenses", format: "xls" }),
      format: "xls",
    });
    return res.status(200).send(xml);
  } catch (err: any) {
    console.error("[expenses] xls export failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_EXPORT_FAILED" });
  }
}

router.get("/expenses/export.xls", requireAuth, handleExpenseSpreadsheetExport);
router.get("/expenses/export.xlsx", requireAuth, handleExpenseSpreadsheetExport);

router.get("/expenses/export.pdf", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const entitlements = await requireProExpenseAccess(req, res);
    if (!entitlements) return;

    const result = await listExpensesForRequest(req, { includeArchivedProperties: true, limit: 1000 });
    if (!result.ok) return res.status(result.status).json({ ok: false, error: result.error });

    const propertyIds = Array.from(new Set(result.items.map((item: any) => String(item.propertyId || "").trim()).filter(Boolean)));
    const propertySnaps = await Promise.all(propertyIds.map((id) => db.collection("properties").doc(id).get()));
    const propertyNames = new Map<string, string>();
    propertySnaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() as any;
      propertyNames.set(snap.id, resolvePropertyLabel(data));
    });
    const rows = await buildExpenseExportRows(result.items, propertyNames);
    const totalAmountCents = result.items.reduce((sum: number, item: any) => sum + Number(item.amountCents || 0), 0);
    const propertyLabel = String(req.query?.propertyId || "").trim();
    const subtitle = [
      propertyLabel ? `Property filter: ${propertyNames.get(propertyLabel) || propertyLabel}` : "All properties",
      req.query?.dateFrom ? `From ${String(req.query.dateFrom)}` : null,
      req.query?.dateTo ? `To ${String(req.query.dateTo)}` : null,
      `Rows: ${rows.length}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const pdf = await renderExpensePdf({
      rows,
      title: "RentChain Expense Export",
      subtitle,
      totalAmountCents,
    });

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-expenses", format: "pdf" }),
      format: "pdf",
    });
    return res.status(200).send(pdf);
  } catch (err: any) {
    console.error("[expenses] pdf export failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "EXPENSE_EXPORT_FAILED" });
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
