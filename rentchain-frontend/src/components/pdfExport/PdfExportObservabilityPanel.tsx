import type { PdfExportDiagnostics } from "@/api/pdfExportObservabilityApi";
import { Card } from "@/components/ui/Ui";

function label(value: string | null | undefined) {
  const raw = String(value || "unknown").trim();
  return raw.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function Metric({ label: metricLabel, value }: { label: string; value: string | number | null }) {
  return (
    <Card style={{ borderRadius: 8, display: "grid", gap: 4 }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{metricLabel}</div>
      <div style={{ color: "#0f172a", fontSize: 22, fontWeight: 900 }}>{value ?? "N/A"}</div>
    </Card>
  );
}

export function PdfExportObservabilityPanel({ diagnostics }: { diagnostics: PdfExportDiagnostics }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card style={{ borderRadius: 8, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>PDF export observability</h2>
            <div style={{ color: "#64748b", fontSize: 13 }}>{diagnostics.generatedAt}</div>
          </div>
          <div style={{ color: "#334155", fontSize: 13, fontWeight: 800 }}>Manual review required</div>
        </div>
        <div style={{ color: "#475569" }}>
          PDF export telemetry is operational metadata only. It is non-blocking and does not collect document contents,
          raw screening payloads, or payment account details.
        </div>
        <div style={{ color: "#475569", fontSize: 13 }}>
          Telemetry execution blocking enabled: {diagnostics.telemetryExecutionBlockingEnabled ? "Yes" : "No"}. Sensitive content logged:{" "}
          {diagnostics.sensitiveContentLogged ? "Yes" : "No"}.
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Metric label="Total events" value={diagnostics.summary.totalEvents} />
        <Metric label="Completed" value={diagnostics.summary.completed} />
        <Metric label="Failed" value={diagnostics.summary.failed} />
        <Metric label="Mobile fallbacks" value={diagnostics.summary.mobileFallbacks} />
        <Metric label="Downloads" value={diagnostics.summary.downloads} />
        <Metric label="Prints" value={diagnostics.summary.prints} />
        <Metric label="Avg duration ms" value={diagnostics.summary.averageDurationMs} />
        <Metric label="Total bytes" value={diagnostics.summary.totalBytes} />
      </div>

      <Card style={{ borderRadius: 8, display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Export types</h3>
        {diagnostics.byExportType.length ? (
          diagnostics.byExportType.map((item) => (
            <div key={item.exportType} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
              <div style={{ fontWeight: 800 }}>{label(item.exportType)}</div>
              <div style={{ color: "#475569", fontSize: 13 }}>
                {item.totalEvents} events · {item.completed} completed · {item.failed} failed · {item.mobileFallbacks} fallbacks
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: "#64748b" }}>No PDF export telemetry has been recorded yet.</div>
        )}
      </Card>

      <Card style={{ borderRadius: 8, display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Recent diagnostics</h3>
        {diagnostics.recentEvents.length ? (
          diagnostics.recentEvents.map((event) => (
            <div key={event.eventId} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <strong>{label(event.eventName)}</strong>
                <span style={{ color: "#64748b", fontSize: 12 }}>{event.createdAt}</span>
              </div>
              <div style={{ color: "#475569", fontSize: 13 }}>
                {label(event.exportType)} · {label(event.renderingPath)} · {label(event.browserClass)} · {label(event.viewportCategory)}
              </div>
              {event.errorCode ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{event.errorCode}</div> : null}
            </div>
          ))
        ) : (
          <div style={{ color: "#64748b" }}>No recent PDF diagnostic events are available.</div>
        )}
      </Card>

      <Card style={{ borderRadius: 8, display: "grid", gap: 6 }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Privacy boundaries</h3>
        {diagnostics.privacyBoundaries.map((boundary) => (
          <div key={boundary} style={{ color: "#475569", fontSize: 13 }}>
            {boundary}
          </div>
        ))}
      </Card>
    </div>
  );
}
