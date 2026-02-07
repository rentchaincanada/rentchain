import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SamplePdfModal({ open, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const pdfUrl = "/sample/screening_report_sample.pdf?v=1";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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
        if (event.target === event.currentTarget) onClose();
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
        aria-label="Sample screening report"
        style={{
          width: "min(1024px, 95vw)",
          height: isMobile ? "75vh" : "70vh",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 30px 80px rgba(2,6,23,0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
          <div style={{ fontWeight: 700 }}>Sample screening report</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => navigate("/pdf/sample")}
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
              onClick={onClose}
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
        <div style={{ flex: 1, position: "relative", background: "#f8fafc" }}>
          {loadError ? (
            <div style={{ padding: 16, fontSize: 14, color: "#b91c1c" }}>
              Unable to load the sample report.
              <div style={{ marginTop: 8 }}>
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
              </div>
            </div>
          ) : (
            <iframe
              title="Sample screening report PDF"
              src={`${pdfUrl}#view=FitH`}
              className="w-full h-full rounded-xl"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
              onError={() => setLoadError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
