import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "../../components/ui/Ui";
import { spacing, text, colors, radius } from "../../styles/tokens";

const ScreeningReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const exportId = searchParams.get("exportId") || "";
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadReport = async () => {
    if (!exportId || !token) {
      setError("Missing export link parameters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/screening/report?exportId=${encodeURIComponent(exportId)}&token=${encodeURIComponent(token)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = data?.error || "download_failed";
        if (code === "expired") {
          throw new Error("This link has expired.");
        }
        throw new Error("This link is invalid or has been revoked.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `screening_${exportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Unable to download report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void downloadReport();
  }, [exportId, token]);

  return (
    <Section style={{ maxWidth: 640, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>Screening report</div>
          <div style={{ color: text.muted }}>Download your screening PDF.</div>
          {error ? (
            <div
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.4)",
                color: colors.danger,
                padding: spacing.sm,
                borderRadius: radius.md,
              }}
            >
              {error}
            </div>
          ) : null}
          <Button type="button" onClick={() => void downloadReport()} disabled={loading}>
            {loading ? "Downloading..." : "Download PDF"}
          </Button>
        </div>
      </Card>
    </Section>
  );
};

export default ScreeningReportPage;
