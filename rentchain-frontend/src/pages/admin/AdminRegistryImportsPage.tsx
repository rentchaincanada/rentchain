import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Input, Pill, Section } from "../../components/ui/Ui";
import { fetchAdminRegistryImports, startAdminRegistryImport, type RegistryImportView } from "../../api/adminRegistryApi";

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function AdminRegistryImportsPage() {
  const [items, setItems] = useState<RegistryImportView[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");

  const totalRows = useMemo(() => items.reduce((sum, item) => sum + (item.rowCount || 0), 0), [items]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminRegistryImports("halifax_r400");
      setItems(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load registry imports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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
      await startAdminRegistryImport({
        sourceKey: "halifax_r400",
        csvText,
        sourceFileName: sourceFileName || "halifax-registry.csv",
      });
      setCsvText("");
      setSourceFileName("");
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
                Upload Halifax CSV content, run normalization and matching, and track import summaries.
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
              {uploading ? "Importing..." : "Run import"}
            </Button>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Refresh history
            </Button>
          </div>
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
                <Pill tone={item.status === "completed" ? "accent" : "muted"}>{item.status}</Pill>
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>
                Rows: {item.rowCount} · Parsed: {item.parsedRowCount} · Normalized: {item.normalizedRowCount}
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>
                Matched: {item.matchedRowCount} · Unmatched: {item.unmatchedRowCount} · Mismatches: {item.mismatchRowCount}
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Started: {formatDate(item.startedAt)} · Completed: {formatDate(item.completedAt)}
              </div>
              {item.errorSummary ? <div style={{ color: "#b91c1c", fontSize: 14 }}>{item.errorSummary}</div> : null}
            </div>
          ))}
        </Card>
      </div>
    </MacShell>
  );
}
