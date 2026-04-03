import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { fetchAdminRegistrySources, type RegistrySourceView } from "../../api/adminRegistryApi";

export default function AdminRegistrySourcesPage() {
  const [items, setItems] = useState<RegistrySourceView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchAdminRegistrySources();
        if (!active) return;
        setItems(result);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load registry sources");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <MacShell title="Admin · Registry Sources">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Registry Sources</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Internal-only source definitions for Halifax-first registry imports and future Canadian adapters.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to="/admin/registry/imports">
                <Button variant="secondary">Open imports</Button>
              </Link>
              <Link to="/admin/registry/review">
                <Button variant="secondary">Open review queue</Button>
              </Link>
            </div>
          </div>
        </Section>

        <Card style={{ display: "grid", gap: 12 }}>
          {loading ? <div>Loading registry sources…</div> : null}
          {!loading && error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}
          {!loading && !items.length ? <div style={{ color: "#475569" }}>No registry sources configured.</div> : null}
          {items.map((item) => (
            <div key={item.id} style={{ border: "1px solid rgba(148,163,184,0.22)", borderRadius: 16, padding: 16, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.sourceLabel}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {item.jurisdictionMunicipality}, {item.jurisdictionProvince} · {item.sourceType}
                  </div>
                </div>
                <Pill tone={item.active ? "accent" : "muted"}>{item.active ? "Active" : "Inactive"}</Pill>
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>
                Source key: {item.sourceKey} · Ingestion: {item.ingestionMode} · Refresh: {item.refreshFrequency}
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>Latest import: {item.latestImportId || "--"}</div>
            </div>
          ))}
        </Card>
      </div>
    </MacShell>
  );
}
