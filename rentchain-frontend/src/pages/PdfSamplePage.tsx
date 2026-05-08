import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Ui";
import { spacing } from "../styles/tokens";
import { useMobilePdfPreviewGuard } from "../utils/pdfPreviewGuard";

const pdfUrl = "/sample/screening_report_sample.pdf?v=1";

const PdfSamplePage: React.FC = () => {
  const navigate = useNavigate();
  const [loaded, setLoaded] = React.useState(false);
  const useMobileFallback = useMobilePdfPreviewGuard();

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
        {useMobileFallback ? (
          <div style={{ display: "grid", gap: spacing.sm, padding: spacing.md }}>
            <div style={{ fontWeight: 700 }}>Open the sample PDF</div>
            <div style={{ color: "#475569" }}>
              Mobile browsers handle PDF files more reliably in the browser viewer or download manager.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: "#0f172a", fontWeight: 700 }}>
                Open PDF
              </a>
              <a href={pdfUrl} download style={{ color: "#0f172a", fontWeight: 700 }}>
                Download PDF
              </a>
            </div>
          </div>
        ) : (
          <>
            {!loaded ? <div style={{ padding: spacing.md }}>Loading…</div> : null}
            <iframe
              title="Sample screening report"
              src={`${pdfUrl}#view=FitH`}
              style={{
                width: "100%",
                minHeight: 720,
                height: "min(900px, 82dvh)",
                border: "none",
                display: "block",
              }}
              onLoad={() => setLoaded(true)}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default PdfSamplePage;
