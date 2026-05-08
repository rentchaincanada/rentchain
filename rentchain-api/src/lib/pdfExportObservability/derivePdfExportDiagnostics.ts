import type { PdfExportDiagnostics, PdfExportTelemetryRecord } from "./pdfExportObservabilityTypes";

function asString(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function asNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function timestamp(value: unknown) {
  const next = asNumber(value);
  return next == null ? 0 : next;
}

function isoFromMillis(value: unknown) {
  const millis = timestamp(value);
  return new Date(millis || 0).toISOString();
}

function isPdfEvent(record: PdfExportTelemetryRecord) {
  return asString(record.eventName).startsWith("pdf_");
}

export function derivePdfExportDiagnostics(records: PdfExportTelemetryRecord[]): PdfExportDiagnostics {
  const pdfRecords = records.filter(isPdfEvent).sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  const byExportType = new Map<string, { totalEvents: number; completed: number; failed: number; mobileFallbacks: number }>();
  const byRenderingPath = new Map<string, { totalEvents: number }>();
  let completed = 0;
  let failed = 0;
  let started = 0;
  let mobileFallbacks = 0;
  let downloads = 0;
  let prints = 0;
  let durationTotal = 0;
  let durationCount = 0;
  let totalBytes = 0;
  let byteCount = 0;

  for (const record of pdfRecords) {
    const exportType = asString(record.eventProps?.exportType, 120) || "unknown";
    const renderingPath = asString(record.eventProps?.renderingPath, 120) || "unknown";
    const exportBucket = byExportType.get(exportType) || {
      totalEvents: 0,
      completed: 0,
      failed: 0,
      mobileFallbacks: 0,
    };
    exportBucket.totalEvents += 1;
    if (record.eventName === "pdf_export_completed") {
      completed += 1;
      exportBucket.completed += 1;
    }
    if (record.eventName === "pdf_export_failed") {
      failed += 1;
      exportBucket.failed += 1;
    }
    if (record.eventName === "pdf_export_started") started += 1;
    if (record.eventName === "pdf_mobile_fallback_used") {
      mobileFallbacks += 1;
      exportBucket.mobileFallbacks += 1;
    }
    if (record.eventName === "pdf_download_triggered") downloads += 1;
    if (record.eventName === "pdf_print_opened") prints += 1;
    byExportType.set(exportType, exportBucket);

    const pathBucket = byRenderingPath.get(renderingPath) || { totalEvents: 0 };
    pathBucket.totalEvents += 1;
    byRenderingPath.set(renderingPath, pathBucket);

    const durationMs = asNumber(record.eventProps?.durationMs);
    if (durationMs != null && durationMs >= 0) {
      durationTotal += durationMs;
      durationCount += 1;
    }
    const byteSize = asNumber(record.eventProps?.byteSize);
    if (byteSize != null && byteSize >= 0) {
      totalBytes += byteSize;
      byteCount += 1;
    }
  }

  return {
    diagnosticsId: "pdf_export_observability:latest",
    generatedAt: new Date().toISOString(),
    manualReviewRequired: true,
    telemetryExecutionBlockingEnabled: false,
    sensitiveContentLogged: false,
    summary: {
      totalEvents: pdfRecords.length,
      started,
      completed,
      failed,
      mobileFallbacks,
      downloads,
      prints,
      averageDurationMs: durationCount ? Math.round(durationTotal / durationCount) : null,
      totalBytes: byteCount ? totalBytes : null,
    },
    byExportType: Array.from(byExportType.entries())
      .map(([exportType, counts]) => ({ exportType, ...counts }))
      .sort((a, b) => b.totalEvents - a.totalEvents || a.exportType.localeCompare(b.exportType)),
    byRenderingPath: Array.from(byRenderingPath.entries())
      .map(([renderingPath, counts]) => ({ renderingPath, ...counts }))
      .sort((a, b) => b.totalEvents - a.totalEvents || a.renderingPath.localeCompare(b.renderingPath)),
    recentEvents: pdfRecords.slice(0, 25).map((record) => ({
      eventId: record.id,
      eventName: record.eventName,
      createdAt: isoFromMillis(record.createdAt),
      exportType: asString(record.eventProps?.exportType, 120) || null,
      renderingPath: asString(record.eventProps?.renderingPath, 120) || null,
      status: asString(record.eventProps?.status, 80) || null,
      browserClass: asString(record.eventProps?.browserClass, 80) || null,
      viewportCategory: asString(record.eventProps?.viewportCategory, 80) || null,
      durationMs: asNumber(record.eventProps?.durationMs),
      byteSize: asNumber(record.eventProps?.byteSize),
      errorCode: asString(record.eventProps?.errorCode, 120) || null,
    })),
    privacyBoundaries: [
      "PDF telemetry stores export metadata only.",
      "Raw PDF contents, screening payloads, document body text, and payment account details are not collected.",
      "Diagnostics are admin-scoped and non-blocking for export flows.",
    ],
  };
}
