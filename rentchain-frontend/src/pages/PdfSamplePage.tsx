import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Ui";
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
          </div>
        </div>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <iframe
          title="Sample screening report"
          src={`${pdfUrl}#view=FitH`}
          style={{
            width: "100%",
            height: "90vh",
            border: "none",
          }}
        />
      </Card>
    </div>
  );
};

export default PdfSamplePage;
