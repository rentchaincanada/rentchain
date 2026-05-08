import React, { useEffect, useRef, useState } from "react";
import { recordPdfExportEvent } from "../../lib/pdfExportObservability";
import { PdfPreviewBoundary } from "../documentRendering/PdfPreviewBoundary";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SamplePdfModal({ open, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [loadError, setLoadError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pdfUrl = "/sample/screening_report_sample.pdf?v=1";

  const closeModal = React.useCallback(() => {
    onClose();
    previouslyFocusedRef.current?.focus();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeModal, open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    const legacy = media as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    if (typeof legacy.addEventListener === "function") {
      legacy.addEventListener("change", update);
      return () => legacy.removeEventListener("change", update);
    }
    if (typeof legacy.addListener === "function") {
      legacy.addListener(update);
      return () => legacy.removeListener?.(update);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLoadError(false);
    const node = containerRef.current;
    if (!node) return;
    const focusable = node.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  }, [open]);

  if (!open) return null;

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const node = containerRef.current;
    if (!node) return;
    const focusable = Array.from(
      node.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={{
          width: "min(1024px, 95vw)",
          minHeight: isMobile ? "auto" : 520,
          maxHeight: isMobile ? "none" : "min(860px, 86dvh)",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 30px 80px rgba(2,6,23,0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "visible",
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={trapFocus}
        tabIndex={-1}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Sample screening report</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              aria-label="View sample screening report full page"
              onClick={() => {
                recordPdfExportEvent("pdf_download_triggered", {
                  exportType: "sample_screening_report",
                  renderingPath: "signed_url",
                  status: "download_triggered",
                });
                if (typeof window !== "undefined") {
                  window.location.assign(pdfUrl);
                }
              }}
              style={{
                fontSize: 13,
                color: "#0f172a",
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              View full page
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open sample screening report in a new tab"
              onClick={() =>
                recordPdfExportEvent("pdf_download_triggered", {
                  exportType: "sample_screening_report",
                  renderingPath: "signed_url",
                  status: "download_triggered",
                })
              }
              style={{
                fontSize: 13,
                color: "#0f172a",
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            >
              Open in new tab
            </a>
            <button
              type="button"
              aria-label="Close sample screening report preview"
              onClick={closeModal}
              style={{
                border: "1px solid #e2e8f0",
                background: "#fff",
                padding: "6px 10px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        </div>
        <div id={descriptionId} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          PDF preview controls for the sample screening report.
        </div>
        <div style={{ flex: 1, position: "relative", background: "#f8fafc", overflow: "visible" }}>
          {loadError ? (
            <div role="alert" style={{ padding: 16, fontSize: 14, color: "#b91c1c" }}>
              Unable to load the sample report.
              <div style={{ marginTop: 8 }}>
                <a href={pdfUrl} target="_blank" rel="noreferrer" aria-label="Open sample screening report in a new tab">
                  Open in new tab
                </a>
              </div>
            </div>
          ) : (
            <PdfPreviewBoundary
              pdfUrl={pdfUrl}
              exportType="sample_screening_report"
              title="Open the sample PDF"
              iframeTitle="Sample screening report PDF"
              iframeClassName="w-full h-full rounded-xl"
              active={open}
              fallbackStyle={{ display: "grid", gap: 10, padding: 16, fontSize: 14, color: "#0f172a" }}
              iframeStyle={{
                width: "100%",
                minHeight: 520,
                height: "min(760px, 72dvh)",
                border: "none",
                display: "block",
              }}
              onDesktopError={() => setLoadError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
