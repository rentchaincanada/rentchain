export const DOCUMENT_SECURITY_PROFILE_VERSION = "document-security-v1";

export const DEFAULT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export type DocumentSensitivityClass = "operational" | "sensitive" | "restricted";

export type DocumentScanStatus = "not_scanned" | "pending" | "clean" | "rejected" | "failed";

export type DocumentKind =
  | "lease_document"
  | "schedule_a"
  | "evidence_attachment"
  | "ledger_attachment"
  | "tenant_document"
  | "screening_report_export"
  | "csv_import"
  | "institutional_export"
  | "generated_pdf"
  | "unknown";

export type DocumentValidationOptions = {
  allowCsv?: boolean;
  allowOfficeDocuments?: boolean;
  allowImages?: boolean;
  maxBytes?: number;
};

export type DocumentValidationResult = {
  ok: boolean;
  code?: string;
  message?: string;
};

export type SafeDocumentReference = {
  profileVersion: typeof DOCUMENT_SECURITY_PROFILE_VERSION;
  label: string;
  documentKind: DocumentKind;
  contentType: string;
  sizeBytes?: number;
  sensitivityClass: DocumentSensitivityClass;
  scanStatus: DocumentScanStatus;
  redactionSummary: string;
  internalReferences: {
    bucket?: string;
    storagePath?: string;
    sourceCollection?: string;
    sourceId?: string;
  };
};

const CORE_ALLOWED_MIME_TYPES = new Set(["application/pdf"]);
const IMAGE_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CSV_ALLOWED_MIME_TYPES = new Set(["text/csv", "application/vnd.ms-excel"]);
const OFFICE_ALLOWED_MIME_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const CORE_ALLOWED_EXTENSIONS = new Set([".pdf"]);
const IMAGE_ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const CSV_ALLOWED_EXTENSIONS = new Set([".csv"]);
const OFFICE_ALLOWED_EXTENSIONS = new Set([".doc", ".docx", ".xlsx"]);

const DISALLOWED_MIME_TYPES = new Set([
  "application/javascript",
  "application/octet-stream",
  "application/x-msdownload",
  "application/x-sh",
  "application/zip",
  "text/html",
]);

const DANGEROUS_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".com",
  ".exe",
  ".html",
  ".js",
  ".msi",
  ".ps1",
  ".scr",
  ".sh",
  ".vbs",
  ".zip",
]);

const ROUTINE_DOCUMENT_KINDS = new Set<DocumentKind>([
  "lease_document",
  "schedule_a",
  "evidence_attachment",
  "ledger_attachment",
  "tenant_document",
  "generated_pdf",
]);

function normalizeMimeType(mimeType: string | undefined | null): string {
  return String(mimeType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

export function normalizeDocumentExtension(fileName: string | undefined | null): string | null {
  const sanitized = String(fileName ?? "").trim().toLowerCase();
  const lastSegment = sanitized.split(/[\\/]/).pop() ?? "";
  const lastDot = lastSegment.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === lastSegment.length - 1) return null;
  return lastSegment.slice(lastDot);
}

function allowedMimeTypes(options: DocumentValidationOptions): Set<string> {
  return new Set([
    ...CORE_ALLOWED_MIME_TYPES,
    ...(options.allowImages ? IMAGE_ALLOWED_MIME_TYPES : []),
    ...(options.allowCsv ? CSV_ALLOWED_MIME_TYPES : []),
    ...(options.allowOfficeDocuments ? OFFICE_ALLOWED_MIME_TYPES : []),
  ]);
}

function allowedExtensions(options: DocumentValidationOptions): Set<string> {
  return new Set([
    ...CORE_ALLOWED_EXTENSIONS,
    ...(options.allowImages ? IMAGE_ALLOWED_EXTENSIONS : []),
    ...(options.allowCsv ? CSV_ALLOWED_EXTENSIONS : []),
    ...(options.allowOfficeDocuments ? OFFICE_ALLOWED_EXTENSIONS : []),
  ]);
}

export function validateAllowedDocumentMimeType(
  mimeType: string | undefined | null,
  options: DocumentValidationOptions = {}
): DocumentValidationResult {
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) {
    return { ok: false, code: "document_mime_missing", message: "Document MIME type is required." };
  }

  if (DISALLOWED_MIME_TYPES.has(normalized)) {
    return { ok: false, code: "document_mime_disallowed", message: "Document MIME type is disallowed." };
  }

  if (!allowedMimeTypes(options).has(normalized)) {
    return { ok: false, code: "document_mime_unsupported", message: "Document MIME type is unsupported." };
  }

  return { ok: true };
}

export function validateAllowedDocumentExtension(
  fileName: string | undefined | null,
  options: DocumentValidationOptions = {}
): DocumentValidationResult {
  const extension = normalizeDocumentExtension(fileName);
  if (!extension) {
    return { ok: false, code: "document_extension_missing", message: "Document extension is required." };
  }

  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      code: "document_extension_dangerous",
      message: "Document extension is dangerous.",
    };
  }

  if (!allowedExtensions(options).has(extension)) {
    return {
      ok: false,
      code: "document_extension_unsupported",
      message: "Document extension is unsupported.",
    };
  }

  return { ok: true };
}

export function validateDocumentSizeLimit(
  sizeBytes: number | undefined | null,
  maxBytes = DEFAULT_DOCUMENT_MAX_BYTES
): DocumentValidationResult {
  if (!Number.isFinite(sizeBytes) || Number(sizeBytes) < 0) {
    return { ok: false, code: "document_size_invalid", message: "Document size is invalid." };
  }

  if (Number(sizeBytes) > maxBytes) {
    return { ok: false, code: "document_size_too_large", message: "Document exceeds the configured size limit." };
  }

  return { ok: true };
}

export function validateSafeDocumentFile(params: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  options?: DocumentValidationOptions;
}): DocumentValidationResult {
  const options = params.options ?? {};
  const mimeValidation = validateAllowedDocumentMimeType(params.mimeType, options);
  if (!mimeValidation.ok) return mimeValidation;

  const extensionValidation = validateAllowedDocumentExtension(params.fileName, options);
  if (!extensionValidation.ok) return extensionValidation;

  return validateDocumentSizeLimit(params.sizeBytes, options.maxBytes ?? DEFAULT_DOCUMENT_MAX_BYTES);
}

export function classifyDocumentSensitivity(documentKind: DocumentKind): DocumentSensitivityClass {
  if (documentKind === "screening_report_export" || documentKind === "institutional_export") {
    return "restricted";
  }

  if (documentKind === "tenant_document" || documentKind === "evidence_attachment" || documentKind === "csv_import") {
    return "sensitive";
  }

  return "operational";
}

export function isRoutineExportDocumentKind(documentKind: DocumentKind): boolean {
  return ROUTINE_DOCUMENT_KINDS.has(documentKind);
}

export function deriveSignedUrlGovernance(params: {
  expiresAt?: Date | string | number | null;
  now?: Date | string | number;
}): { status: "fresh" | "expired" | "unknown"; refreshRequired: boolean } {
  if (!params.expiresAt) return { status: "unknown", refreshRequired: false };

  const expiresAtMs = new Date(params.expiresAt).getTime();
  const nowMs = new Date(params.now ?? Date.now()).getTime();

  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs)) {
    return { status: "unknown", refreshRequired: false };
  }

  if (expiresAtMs <= nowMs) {
    return { status: "expired", refreshRequired: true };
  }

  return { status: "fresh", refreshRequired: false };
}

export function buildSafeDocumentReference(params: {
  label?: string;
  fileName?: string;
  documentKind: DocumentKind;
  contentType: string;
  sizeBytes?: number;
  bucket?: string;
  storagePath?: string;
  sourceCollection?: string;
  sourceId?: string;
  scanStatus?: DocumentScanStatus;
}): SafeDocumentReference {
  const label = String(params.label || params.fileName || "Document reference").trim();

  return {
    profileVersion: DOCUMENT_SECURITY_PROFILE_VERSION,
    label,
    documentKind: params.documentKind,
    contentType: normalizeMimeType(params.contentType),
    sizeBytes: params.sizeBytes,
    sensitivityClass: classifyDocumentSensitivity(params.documentKind),
    scanStatus: params.scanStatus ?? "not_scanned",
    redactionSummary: "Storage path and source identifiers are retained as internal references, not primary labels.",
    internalReferences: {
      bucket: params.bucket,
      storagePath: params.storagePath,
      sourceCollection: params.sourceCollection,
      sourceId: params.sourceId,
    },
  };
}
