import crypto from "crypto";
import { db } from "../config/firebase";
import { createSignedUrl, putPdfObject } from "../storage/pdfStore";

export const NS_TEMPLATE_VERSION = "ns-schedule-a-v1";
export const NS_PROVINCE = "NS";

export type LeaseDraftStatus = "draft" | "generated";
export type LeaseTermType = "fixed" | "month-to-month" | "year-to-year";

export interface LeaseDraftCore {
  landlordId: string;
  propertyId: string;
  unitId: string;
  tenantIds: string[];
  province: "NS";
  termType: LeaseTermType;
  startDate: string;
  endDate?: string | null;
  baseRentCents: number;
  parkingCents: number;
  dueDay: number;
  paymentMethod: string;
  nsfFeeCents?: number | null;
  utilitiesIncluded: string[];
  depositCents?: number | null;
  additionalClauses: string;
  status: LeaseDraftStatus;
  templateVersion: "ns-schedule-a-v1";
  createdAt: number;
  updatedAt: number;
}

export interface GeneratedFile {
  kind: "schedule-a-pdf";
  url: string;
  sha256: string;
  sizeBytes: number;
  bucket?: string;
  objectKey?: string;
}

export interface LeaseSnapshot extends LeaseDraftCore {
  generatedAt: number;
  generatedFiles: GeneratedFile[];
}

export type LeaseDraftCreateInput = Omit<
  LeaseDraftCore,
  "landlordId" | "status" | "templateVersion" | "createdAt" | "updatedAt"
>;

export type LeaseDraftPatchInput = Partial<LeaseDraftCreateInput>;

function toTrimmedString(input: unknown, max = 500): string {
  return String(input ?? "")
    .trim()
    .slice(0, max);
}

function normalizeTenantIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => toTrimmedString(item, 200)).filter(Boolean);
}

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => toTrimmedString(item, 120))
    .filter(Boolean)
    .slice(0, 32);
}

function normalizeCents(input: unknown): number | null {
  if (input == null || input === "") return null;
  const n = Number(input);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function normalizeDate(input: unknown): string | null {
  const raw = toTrimmedString(input, 30);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return raw;
}

function ensure(
  condition: unknown,
  code: string,
  message: string
): asserts condition {
  if (!condition) {
    const err = new Error(message) as Error & { code: string; status: number };
    err.code = code;
    err.status = 400;
    throw err;
  }
}

export function validateCreateInput(
  landlordId: string,
  input: LeaseDraftCreateInput
): LeaseDraftCore {
  const now = Date.now();
  const province = toTrimmedString(input.province, 10).toUpperCase();
  const termType = toTrimmedString(input.termType, 30).toLowerCase() as LeaseTermType;
  const startDate = normalizeDate(input.startDate);
  const endDate = normalizeDate(input.endDate);
  const baseRentCents = normalizeCents(input.baseRentCents);
  const parkingCents = normalizeCents(input.parkingCents);
  const dueDay = Number(input.dueDay);
  const paymentMethod = toTrimmedString(input.paymentMethod, 40).toLowerCase();
  const nsfFeeCents = normalizeCents(input.nsfFeeCents);
  const depositCents = normalizeCents(input.depositCents);
  const tenantIds = normalizeTenantIds(input.tenantIds);
  const utilitiesIncluded = normalizeStringList(input.utilitiesIncluded);
  const additionalClauses = toTrimmedString(input.additionalClauses, 12000);

  ensure(Boolean(landlordId), "landlord_required", "landlordId is required");
  ensure(province === NS_PROVINCE, "province_invalid", "Only NS is supported");
  ensure(Boolean(input.propertyId), "property_required", "propertyId is required");
  ensure(Boolean(input.unitId), "unit_required", "unitId is required");
  ensure(tenantIds.length > 0, "tenant_required", "tenantIds must include at least one tenant");
  ensure(
    termType === "fixed" || termType === "month-to-month" || termType === "year-to-year",
    "term_type_invalid",
    "termType must be fixed|month-to-month|year-to-year"
  );
  ensure(Boolean(startDate), "start_date_invalid", "startDate must be YYYY-MM-DD");
  if (termType === "fixed") {
    ensure(Boolean(endDate), "end_date_required", "endDate is required for fixed term");
  }
  if (startDate && endDate) {
    ensure(endDate >= startDate, "end_date_invalid", "endDate must be on or after startDate");
  }
  ensure(baseRentCents != null && baseRentCents > 0, "rent_invalid", "baseRentCents must be > 0");
  ensure(parkingCents != null, "parking_invalid", "parkingCents must be >= 0");
  ensure(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31, "due_day_invalid", "dueDay must be 1-31");
  ensure(Boolean(paymentMethod), "payment_method_invalid", "paymentMethod is required");
  if (nsfFeeCents != null) ensure(nsfFeeCents >= 0, "nsf_invalid", "nsfFeeCents must be >= 0");
  if (depositCents != null) ensure(depositCents >= 0, "deposit_invalid", "depositCents must be >= 0");

  return {
    landlordId,
    propertyId: toTrimmedString(input.propertyId, 200),
    unitId: toTrimmedString(input.unitId, 200),
    tenantIds,
    province: "NS",
    termType,
    startDate: startDate as string,
    endDate: endDate || null,
    baseRentCents: baseRentCents as number,
    parkingCents: parkingCents as number,
    dueDay,
    paymentMethod,
    nsfFeeCents,
    utilitiesIncluded,
    depositCents,
    additionalClauses,
    status: "draft",
    templateVersion: NS_TEMPLATE_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

export function applyPatch(
  existing: LeaseDraftCore,
  patch: LeaseDraftPatchInput
): LeaseDraftCore {
  const merged: LeaseDraftCreateInput = {
    propertyId: patch.propertyId ?? existing.propertyId,
    unitId: patch.unitId ?? existing.unitId,
    tenantIds: patch.tenantIds ?? existing.tenantIds,
    province: (patch.province as "NS") ?? existing.province,
    termType: patch.termType ?? existing.termType,
    startDate: patch.startDate ?? existing.startDate,
    endDate: patch.endDate ?? existing.endDate ?? null,
    baseRentCents: patch.baseRentCents ?? existing.baseRentCents,
    parkingCents: patch.parkingCents ?? existing.parkingCents,
    dueDay: patch.dueDay ?? existing.dueDay,
    paymentMethod: patch.paymentMethod ?? existing.paymentMethod,
    nsfFeeCents: patch.nsfFeeCents ?? existing.nsfFeeCents ?? null,
    utilitiesIncluded: patch.utilitiesIncluded ?? existing.utilitiesIncluded,
    depositCents: patch.depositCents ?? existing.depositCents ?? null,
    additionalClauses: patch.additionalClauses ?? existing.additionalClauses,
  };
  const validated = validateCreateInput(existing.landlordId, merged);
  return {
    ...validated,
    createdAt: existing.createdAt,
    status: existing.status,
    templateVersion: existing.templateVersion,
    updatedAt: Date.now(),
  };
}

function formatMoney(cents: number | null | undefined): string {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderNsScheduleAHtml(input: {
  draftId: string;
  draft: LeaseDraftCore;
  landlordDisplayName: string;
  tenantDisplayNames: string[];
  propertyAddressLine: string;
  unitLabel: string;
}): string {
  const { draft } = input;
  const termLabel =
    draft.termType === "fixed"
      ? "Fixed term"
      : draft.termType === "year-to-year"
      ? "Year-to-year"
      : "Month-to-month";
  const utilities = draft.utilitiesIncluded.length
    ? draft.utilitiesIncluded.map(escapeHtml).join(", ")
    : "None listed";
  const clauses = draft.additionalClauses
    ? escapeHtml(draft.additionalClauses).replace(/\n/g, "<br />")
    : "No additional clauses provided.";

  return `<!doctype html>
<html lang="en-CA">
  <head>
    <meta charset="utf-8" />
    <title>Schedule A addendum</title>
    <style>
      @page { size: Letter; margin: 0.6in; }
      body { font-family: Arial, sans-serif; color: #111827; font-size: 12px; line-height: 1.45; }
      h1 { margin: 0 0 6px; font-size: 20px; }
      h2 { margin: 18px 0 8px; font-size: 14px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
      .muted { color: #4b5563; }
      .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-top: 10px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
      .key { color: #4b5563; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em; }
      .value { font-size: 12px; }
      .footer { margin-top: 18px; font-size: 11px; color: #6b7280; }
    </style>
  </head>
  <body>
    <h1>Schedule A addendum</h1>
    <div class="muted">Province: Nova Scotia (NS) • Template version: ${NS_TEMPLATE_VERSION}</div>
    <div class="muted">Reference: Nova Scotia Standard Form of Lease (Form P). Review base lease terms.</div>
    <div class="card">
      <div class="grid">
        <div><div class="key">Landlord</div><div class="value">${escapeHtml(input.landlordDisplayName || "Landlord")}</div></div>
        <div><div class="key">Tenant(s)</div><div class="value">${escapeHtml(input.tenantDisplayNames.join(", ") || "Tenant")}</div></div>
        <div><div class="key">Property</div><div class="value">${escapeHtml(input.propertyAddressLine || input.draft.propertyId)}</div></div>
        <div><div class="key">Unit</div><div class="value">${escapeHtml(input.unitLabel || input.draft.unitId)}</div></div>
        <div><div class="key">Draft ID</div><div class="value">${escapeHtml(input.draftId)}</div></div>
        <div><div class="key">Generated</div><div class="value">${new Date().toISOString().slice(0, 10)}</div></div>
      </div>
    </div>

    <h2>Term</h2>
    <div class="grid">
      <div><div class="key">Term type</div><div class="value">${escapeHtml(termLabel)}</div></div>
      <div><div class="key">Start date</div><div class="value">${escapeHtml(draft.startDate)}</div></div>
      <div><div class="key">End date</div><div class="value">${escapeHtml(draft.endDate || "Not specified")}</div></div>
      <div><div class="key">Rent due day</div><div class="value">${draft.dueDay}</div></div>
    </div>

    <h2>Payments</h2>
    <div class="grid">
      <div><div class="key">Base rent</div><div class="value">${formatMoney(draft.baseRentCents)}</div></div>
      <div><div class="key">Parking</div><div class="value">${formatMoney(draft.parkingCents)}</div></div>
      <div><div class="key">Deposit</div><div class="value">${draft.depositCents != null ? formatMoney(draft.depositCents) : "Not specified"}</div></div>
      <div><div class="key">NSF fee</div><div class="value">${draft.nsfFeeCents != null ? formatMoney(draft.nsfFeeCents) : "Not specified"}</div></div>
      <div><div class="key">Payment method</div><div class="value">${escapeHtml(draft.paymentMethod)}</div></div>
      <div><div class="key">Utilities included</div><div class="value">${utilities}</div></div>
    </div>

    <h2>Additional clauses</h2>
    <div class="card">${clauses}</div>

    <p class="footer">This Schedule A addendum supplements Form P and does not replace the base lease form.</p>
  </body>
</html>`;
}

type DynamicModuleImporter = (moduleName: string) => Promise<any>;

const dynamicModuleImport: DynamicModuleImporter = new Function(
  "moduleName",
  "return import(moduleName);"
) as DynamicModuleImporter;

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];

  const playwright = await dynamicModuleImport("playwright").catch(() => null);
  if (playwright?.chromium) {
    const browser = await playwright.chromium.launch({ headless: true, args: launchArgs });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const output = await page.pdf({
        format: "Letter",
        printBackground: true,
        margin: { top: "0.6in", right: "0.6in", bottom: "0.6in", left: "0.6in" },
      });
      return Buffer.from(output);
    } finally {
      await browser.close();
    }
  }

  const puppeteer = await dynamicModuleImport("puppeteer").catch(() => null);
  if (puppeteer?.launch) {
    const browser = await puppeteer.launch({
      headless: true,
      args: launchArgs,
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const output = await page.pdf({
        format: "letter",
        printBackground: true,
        margin: { top: "0.6in", right: "0.6in", bottom: "0.6in", left: "0.6in" },
      });
      return Buffer.from(output);
    } finally {
      await browser.close();
    }
  }

  throw new Error("Headless browser runtime is unavailable for Schedule A PDF generation");
}

export async function generateScheduleA(params: {
  landlordId: string;
  draftId: string;
  draft: LeaseDraftCore;
  landlordDisplayName: string;
  tenantDisplayNames: string[];
  propertyAddressLine: string;
  unitLabel: string;
}): Promise<GeneratedFile> {
  const objectKey = `leases/${params.landlordId}/${params.draftId}/schedule-a-v1.pdf`;
  const html = renderNsScheduleAHtml({
    draftId: params.draftId,
    draft: params.draft,
    landlordDisplayName: params.landlordDisplayName,
    tenantDisplayNames: params.tenantDisplayNames,
    propertyAddressLine: params.propertyAddressLine,
    unitLabel: params.unitLabel,
  });
  const pdfBuffer = await renderHtmlToPdfBuffer(html);
  const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
  const sizeBytes = pdfBuffer.byteLength;
  const uploaded = await putPdfObject({ objectKey, pdfBuffer });
  const url = await createSignedUrl({
    bucket: uploaded.bucket,
    objectKey: uploaded.path,
    expiresSeconds: 60 * 60 * 24 * 7,
  });
  return {
    kind: "schedule-a-pdf",
    url,
    sha256,
    sizeBytes,
    bucket: uploaded.bucket,
    objectKey: uploaded.path,
  };
}

export async function getDraftById(draftId: string) {
  return db.collection("leaseDrafts").doc(draftId).get();
}

export async function getSnapshotById(snapshotId: string) {
  return db.collection("leaseSnapshots").doc(snapshotId).get();
}
