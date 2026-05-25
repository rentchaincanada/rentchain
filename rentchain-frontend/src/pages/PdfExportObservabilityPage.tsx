import React from "react";
import { fetchPdfExportDiagnostics, type PdfExportDiagnostics } from "@/api/pdfExportObservabilityApi";
import { MacShell } from "@/components/layout/MacShell";
import { PdfExportObservabilityPanel } from "@/components/pdfExport/PdfExportObservabilityPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

export default function PdfExportObservabilityPage() {
  const { showToast } = useToast();
  const [diagnostics, setDiagnostics] = React.useState<PdfExportDiagnostics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await fetchPdfExportDiagnostics();
        if (mounted) setDiagnostics(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load PDF export observability";
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load PDF export observability", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  return (
    <MacShell title="PDF export observability">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>PDF export observability</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Export diagnostics are operationally scoped and review controlled. Telemetry is additive, non-blocking,
              and limited to export metadata.
            </div>
          </div>
        </Section>
        {loading ? <Card>Loading PDF export observability...</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>We couldn't load PDF export observability right now.</Card> : null}
        {!loading && !error && diagnostics ? <PdfExportObservabilityPanel diagnostics={diagnostics} /> : null}
      </div>
    </MacShell>
  );
}
