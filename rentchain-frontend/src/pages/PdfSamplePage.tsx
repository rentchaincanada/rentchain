import React from "react";
import { useNavigate } from "react-router-dom";
import { PdfPreviewBoundary } from "../components/documentRendering/PdfPreviewBoundary";
import { Card } from "../components/ui/Ui";
import { recordPdfExportEvent } from "../lib/pdfExportObservability";
import { spacing } from "../styles/tokens";

const pdfUrl = "/sample/screening_report_sample.pdf?v=1";

const PdfSamplePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Sample screening report
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Back
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                recordPdfExportEvent("pdf_download_triggered", {
                  exportType: "sample_screening_report",
                  renderingPath: "signed_url",
                  status: "download_triggered",
                })
              }
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                textDecoration: "none",
                color: "#0f172a",
                fontWeight: 600,
              }}
            >
              Open in new tab
            </a>
            <a
              href={pdfUrl}
              download
              onClick={() =>
                recordPdfExportEvent("pdf_download_triggered", {
                  exportType: "sample_screening_report",
                  renderingPath: "browser_download",
                  status: "download_triggered",
                })
              }
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                textDecoration: "none",
                color: "#0f172a",
                fontWeight: 600,
              }}
            >
              Download
            </a>
          </div>
        </div>
      </Card>
      <Card style={{ padding: 0, overflow: "visible" }}>
        <PdfPreviewBoundary
          pdfUrl={pdfUrl}
          exportType="sample_screening_report"
          title="Open the sample PDF"
          iframeTitle="Sample screening report"
          fallbackStyle={{ display: "grid", gap: spacing.sm, padding: spacing.md }}
          iframeStyle={{
            width: "100%",
            minHeight: 720,
            height: "min(900px, 82dvh)",
            border: "none",
            display: "block",
          }}
        />
      </Card>
    </div>
  );
};

export default PdfSamplePage;
