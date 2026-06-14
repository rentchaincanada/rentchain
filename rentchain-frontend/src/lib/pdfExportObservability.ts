import { logTelemetryEvent } from "@/api/telemetryApi";
import { isMobilePdfPreviewUnsafe } from "@/utils/pdfPreviewGuard";

export type PdfExportEventName =
  | "pdf_export_started"
  | "pdf_export_completed"
  | "pdf_export_failed"
  | "pdf_mobile_fallback_used"
  | "pdf_download_triggered"
  | "pdf_print_opened";

export type PdfExportType =
  | "sample_screening_report"
  | "screening_report"
  | "application_review_summary"
  | "tenant_report"
  | "lease_ledger"
  | "lease_summary"
  | "lease_evidence_package"
  | "schedule_a"
  | "transunion_usage"
  | "print_summary"
  | "unknown";

export type PdfRenderingPath =
  | "desktop_iframe"
  | "mobile_fallback"
  | "browser_download"
  | "window_print"
  | "backend_pdfkit"
  | "frontend_pdf_builder"
  | "signed_url"
  | "unknown";

export type PdfExportTelemetryProps = {
  exportType: PdfExportType;
  renderingPath: PdfRenderingPath;
  status?: "started" | "completed" | "failed" | "fallback_used" | "download_triggered" | "print_opened";
  fallbackMode?: "mobile_open_download" | "none";
  durationMs?: number | null;
  byteSize?: number | null;
  pageCount?: number | null;
  errorCode?: string | null;
};

function browserClass(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome") || ua.includes("crios")) return "chrome";
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";
  if (ua.includes("safari")) return "safari";
  return "other";
}

function viewportCategory(width: number) {
  if (width <= 768) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

function runtimeContext() {
  if (typeof window === "undefined") {
    return {
      browserClass: "unknown",
      viewportCategory: "unknown",
      mobilePreviewUnsafe: false,
    };
  }
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  return {
    browserClass: browserClass(window.navigator.userAgent || ""),
    viewportCategory: viewportCategory(window.innerWidth || 0),
    mobilePreviewUnsafe: isMobilePdfPreviewUnsafe({
      userAgent: window.navigator.userAgent,
      width: window.innerWidth,
      coarsePointer,
    }),
  };
}

function sanitizeErrorCode(value: unknown) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .slice(0, 120);
}

export function recordPdfExportEvent(eventName: PdfExportEventName, props: PdfExportTelemetryProps): void {
  const context = runtimeContext();
  void logTelemetryEvent(eventName, {
    exportType: props.exportType,
    renderingPath: props.renderingPath,
    status: props.status || null,
    fallbackMode: props.fallbackMode || null,
    durationMs: props.durationMs == null ? null : Math.max(0, Math.round(props.durationMs)),
    byteSize: props.byteSize == null ? null : Math.max(0, Math.round(props.byteSize)),
    pageCount: props.pageCount == null ? null : Math.max(0, Math.round(props.pageCount)),
    errorCode: props.errorCode ? sanitizeErrorCode(props.errorCode) : null,
    ...context,
  });
}

export function createPdfExportTimer() {
  const startedAt = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  return {
    durationMs() {
      const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
      return Math.max(0, Math.round(now - startedAt));
    },
  };
}

export function errorCodeFromUnknown(error: unknown) {
  if (error instanceof Error && error.message) return sanitizeErrorCode(error.message);
  return sanitizeErrorCode(error);
}
