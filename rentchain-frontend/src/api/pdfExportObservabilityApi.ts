import { apiFetch } from "./apiFetch";

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
    eventName: string;
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

export async function fetchPdfExportDiagnostics(): Promise<PdfExportDiagnostics> {
  return await apiFetch<PdfExportDiagnostics>("/admin/pdf-export-observability");
}
