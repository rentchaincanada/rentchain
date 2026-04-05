import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import { fetchAdminRegistryImports, startAdminRegistryImport, type RegistryImportView } from "../../api/adminRegistryApi";

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatImportStage(stage: string | null | undefined) {
  return String(stage || "--").replace(/_/g, " ");
}

function isImportActive(item: RegistryImportView) {
  return item.status === "queued" || item.status === "processing";
}

function getImportStatusTone(status: RegistryImportView["status"]): "accent" | "muted" {
  return status === "completed" ? "accent" : "muted";
}

function getImportStatusStyle(status: RegistryImportView["status"]): React.CSSProperties | undefined {
  if (status === "failed" || status === "cancelled") {
    return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
  }
  if (status === "processing" || status === "queued") {
    return { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  }
  return undefined;
}

export default function AdminRegistryImportsPage() {
  const [items, setItems] = useState<RegistryImportView[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");

  const totalRows = useMemo(() => items.reduce((sum, item) => sum + (item.rowCount || 0), 0), [items]);
  const hasActiveImports = useMemo(() => items.some((item) => isImportActive(item)), [items]);

  const load = useCallback(async (options?: { quiet?: boolean }) => {
    try {
      if (!options?.quiet) setLoading(true);
      const result = await fetchAdminRegistryImports("halifax_r400");
      setItems(result);
      if (!options?.quiet) setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load registry imports");
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!hasActiveImports) return undefined;
    const timer = window.setInterval(() => {
      void load({ quiet: true });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasActiveImports, load]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setSourceFileName(file.name);
  };

  const handleImport = async () => {
    try {
      setUploading(true);
      setError(null);
      setNotice(null);
      const result = await startAdminRegistryImport({
        sourceKey: "halifax_r400",
        csvText,
        sourceFileName: sourceFileName || "halifax-registry.csv",
      });
      setCsvText("");
      setSourceFileName("");
      setNotice(`Import queued: ${result.importId}`);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to import Halifax registry file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <MacShell title="Admin · Registry Imports">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Registry Imports</h1>
                <Pill tone="accent">Halifax</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Upload Halifax CSV content once, then track the async parse, normalization, matching, projection, and audit stages here.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to="/admin/registry/sources">
                <Button variant="secondary">Sources</Button>
              </Link>
              <Link to="/admin/registry/review">
                <Button variant="secondary">Review queue</Button>
              </Link>
            </div>
          </div>
        </Section>

        <Card style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Upload Halifax CSV</div>
          <input type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event.target.files?.[0] || null)} />
          <Input placeholder="Optional file name" value={sourceFileName} onChange={(event) => setSourceFileName(event.target.value)} />
          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            rows={10}
            style={{ width: "100%", borderRadius: 16, border: "1px solid rgba(148,163,184,0.3)", padding: 12, boxSizing: "border-box" }}
            placeholder="Paste Halifax CSV content here if you are not using file upload."
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button onClick={handleImport} disabled={!csvText.trim() || uploading}>
              {uploading ? "Queueing..." : "Queue import"}
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh history
            </Button>
          </div>
          {notice ? <div style={{ color: "#0f766e" }}>{notice}</div> : null}
          {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
        </Card>

        <Card style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700 }}>Import History</div>
            <div style={{ color: "#64748b" }}>Total imported rows: {totalRows}</div>
          </div>
          {loading ? <div>Loading imports…</div> : null}
          {!loading && !items.length ? <div style={{ color: "#475569" }}>No registry imports have run yet.</div> : null}
          {items.map((item) => (
            <div key={item.id} style={{ border: "1px solid rgba(148,163,184,0.2)", borderRadius: 16, padding: 16, display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{item.sourceFileName || item.id}</div>
                <Pill tone={getImportStatusTone(item.status)} style={getImportStatusStyle(item.status)}>
                  {item.status}
                </Pill>
              </div>
              {item.progress ? (
                <div style={{ color: "#334155", fontSize: 14 }}>
                  Stage: {formatImportStage(item.progress.stage)} · Progress: {item.progress.percent}%
                  {item.progress.rowCount || item.progress.rowsProcessed
                    ? ` (${item.progress.rowsProcessed}/${item.progress.rowCount || item.rowCount || 0})`
                    : ""}
                </div>
              ) : null}
              <div style={{ color: "#475569", fontSize: 14 }}>
                Rows: {item.rowCount} · Parsed: {item.parsedRowCount} · Normalized: {item.normalizedRowCount}
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>
                Matched: {item.matchedRowCount} · Unmatched: {item.unmatchedRowCount} · Mismatches: {item.mismatchRowCount} · Ignored: {item.ignoredRowCount ?? 0} · Skipped: {item.skippedRowCount ?? 0}
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Missing PID: {item.diagnostics?.missingPidCount ?? 0} · Missing address: {item.diagnostics?.missingAddressCount ?? 0} · Unsupported status: {item.diagnostics?.unsupportedStatusCount ?? 0}
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Invalid numeric fields: {item.diagnostics?.invalidNumericFieldCount ?? 0} · Duplicate row hash: {item.diagnostics?.duplicateRowHashCount ?? 0}
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Started: {formatDate(item.startedAt)} · Completed: {formatDate(item.completedAt)} · Heartbeat: {formatDate(item.lastHeartbeatAt)}
              </div>
              {typeof item.retryCount === "number" && item.retryCount > 0 ? (
                <div style={{ color: "#64748b", fontSize: 13 }}>File-load retries: {item.retryCount}</div>
              ) : null}
              {item.failureStage ? (
                <div style={{ color: "#991b1b", fontSize: 13 }}>Failure stage: {formatImportStage(item.failureStage)}</div>
              ) : null}
              {item.errorSummary ? <div style={{ color: "#b91c1c", fontSize: 14 }}>{item.errorSummary}</div> : null}
            </div>
          ))}
        </Card>
      </div>
    </MacShell>
  );
}
