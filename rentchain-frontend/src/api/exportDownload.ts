import { apiUrl } from "./config";
import { getAuthToken } from "../lib/authToken";
import {
  createPdfExportTimer,
  errorCodeFromUnknown,
  recordPdfExportEvent,
  type PdfExportType,
  type PdfRenderingPath,
} from "../lib/pdfExportObservability";

type DownloadAuthenticatedExportOptions = {
  path: string;
  fallbackFilename: string;
  errorMessage: string;
  observability?: {
    exportType: PdfExportType;
    renderingPath?: PdfRenderingPath;
  };
};

export function parseContentDispositionFilename(
  disposition: string | null,
  fallbackFilename: string
): string {
  const raw = disposition || "";
  const match = raw.match(/filename\*?=(?:UTF-8''|\"?)([^\";]+)/i);
  return match?.[1] ? decodeURIComponent(match[1].replace(/\"/g, "").trim()) : fallbackFilename;
}

export async function downloadAuthenticatedExport({
  path,
  fallbackFilename,
  errorMessage,
  observability,
}: DownloadAuthenticatedExportOptions): Promise<{ blob: Blob; filename: string }> {
  const timer = createPdfExportTimer();
  if (observability) {
    recordPdfExportEvent("pdf_export_started", {
      exportType: observability.exportType,
      renderingPath: observability.renderingPath || "backend_pdfkit",
      status: "started",
    });
  }
  const token = getAuthToken();
  try {
    const response = await fetch(apiUrl(path), {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let message = text || errorMessage;
      try {
        const json = text ? JSON.parse(text) : null;
        message = json?.message || json?.error || message;
      } catch {
        // Ignore non-JSON responses and fall back to the provided message.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const filename = parseContentDispositionFilename(response.headers.get("Content-Disposition"), fallbackFilename);
    if (observability) {
      recordPdfExportEvent("pdf_export_completed", {
        exportType: observability.exportType,
        renderingPath: observability.renderingPath || "backend_pdfkit",
        status: "completed",
        durationMs: timer.durationMs(),
        byteSize: blob.size,
      });
    }

    return { blob, filename };
  } catch (error) {
    if (observability) {
      recordPdfExportEvent("pdf_export_failed", {
        exportType: observability.exportType,
        renderingPath: observability.renderingPath || "backend_pdfkit",
        status: "failed",
        durationMs: timer.durationMs(),
        errorCode: errorCodeFromUnknown(error),
      });
    }
    throw error;
  }
}
