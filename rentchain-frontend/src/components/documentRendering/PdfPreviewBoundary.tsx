import React from "react";
import { recordPdfExportEvent, type PdfExportType } from "@/lib/pdfExportObservability";
import { useMobilePdfPreviewGuard } from "@/utils/pdfPreviewGuard";

type PdfPreviewBoundaryProps = {
  pdfUrl: string;
  exportType: PdfExportType;
  title: string;
  iframeTitle?: string;
  iframeClassName?: string;
  iframeStyle?: React.CSSProperties;
  fallbackStyle?: React.CSSProperties;
  fallbackDescription?: string;
  active?: boolean;
  onDesktopLoad?: () => void;
  onDesktopError?: () => void;
};

const DEFAULT_FALLBACK_DESCRIPTION =
  "Mobile browsers handle PDF files more reliably in the browser viewer or download manager.";

export function PdfPreviewBoundary({
  pdfUrl,
  exportType,
  title,
  iframeTitle,
  iframeClassName,
  iframeStyle,
  fallbackStyle,
  fallbackDescription = DEFAULT_FALLBACK_DESCRIPTION,
  active = true,
  onDesktopLoad,
  onDesktopError,
}: PdfPreviewBoundaryProps) {
  const useMobileFallback = useMobilePdfPreviewGuard();
  const fallbackTitleId = React.useId();
  const fallbackDescriptionId = React.useId();
  const previewLabel = iframeTitle || title;

  React.useEffect(() => {
    if (!active || !useMobileFallback) return;
    recordPdfExportEvent("pdf_mobile_fallback_used", {
      exportType,
      renderingPath: "mobile_fallback",
      status: "fallback_used",
      fallbackMode: "mobile_open_download",
    });
  }, [active, exportType, useMobileFallback]);

  if (useMobileFallback) {
    return (
      <div
        role="region"
        aria-labelledby={fallbackTitleId}
        aria-describedby={fallbackDescriptionId}
        style={fallbackStyle}
      >
        <div id={fallbackTitleId} style={{ fontWeight: 700 }}>{title}</div>
        <div id={fallbackDescriptionId} style={{ color: "#475569" }}>{fallbackDescription}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${previewLabel}: open PDF in a new tab`}
            onClick={() =>
              recordPdfExportEvent("pdf_download_triggered", {
                exportType,
                renderingPath: "mobile_fallback",
                status: "download_triggered",
                fallbackMode: "mobile_open_download",
              })
            }
          >
            Open PDF
          </a>
          <a
            href={pdfUrl}
            download
            aria-label={`${previewLabel}: download PDF`}
            onClick={() =>
              recordPdfExportEvent("pdf_download_triggered", {
                exportType,
                renderingPath: "mobile_fallback",
                status: "download_triggered",
                fallbackMode: "mobile_open_download",
              })
            }
          >
            Download PDF
          </a>
        </div>
      </div>
    );
  }

  return (
    <iframe
      title={previewLabel}
      aria-label={previewLabel}
      src={`${pdfUrl}#view=FitH`}
      className={iframeClassName}
      style={iframeStyle}
      onLoad={() => {
        recordPdfExportEvent("pdf_export_completed", {
          exportType,
          renderingPath: "desktop_iframe",
          status: "completed",
        });
        onDesktopLoad?.();
      }}
      onError={() => {
        recordPdfExportEvent("pdf_export_failed", {
          exportType,
          renderingPath: "desktop_iframe",
          status: "failed",
          errorCode: "iframe_load_error",
        });
        onDesktopError?.();
      }}
    />
  );
}
