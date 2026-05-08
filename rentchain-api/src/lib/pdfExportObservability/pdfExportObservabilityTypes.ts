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

export type PdfExportTelemetryRecord = {
  id: string;
  eventName: PdfExportEventName;
  createdAt: number;
  userId?: string | null;
  landlordId?: string | null;
  role?: string | null;
  eventProps: {
    exportType?: PdfExportType | string | null;
    renderingPath?: PdfRenderingPath | string | null;
    status?: string | null;
    browserClass?: string | null;
    viewportCategory?: string | null;
    fallbackMode?: string | null;
    durationMs?: number | null;
    byteSize?: number | null;
    pageCount?: number | null;
    errorCode?: string | null;
  };
};

export type PdfExportDiagnostics = {
  diagnosticsId: string;
  generatedAt: string;
  manualReviewRequired: true;
  telemetryExecutionBlockingEnabled: false;
  sensitiveContentLogged: false;
  summary: {
    totalEvents: number;
    started: number;
    completed: number;
    failed: number;
    mobileFallbacks: number;
    downloads: number;
    prints: number;
    averageDurationMs: number | null;
    totalBytes: number | null;
  };
  byExportType: Array<{
    exportType: string;
    totalEvents: number;
    completed: number;
    failed: number;
    mobileFallbacks: number;
  }>;
  byRenderingPath: Array<{
    renderingPath: string;
    totalEvents: number;
  }>;
  recentEvents: Array<{
    eventId: string;
    eventName: PdfExportEventName;
    createdAt: string;
    exportType: string | null;
    renderingPath: string | null;
    status: string | null;
    browserClass: string | null;
    viewportCategory: string | null;
    durationMs: number | null;
    byteSize: number | null;
    errorCode: string | null;
  }>;
  privacyBoundaries: string[];
};
