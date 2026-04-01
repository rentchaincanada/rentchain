import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { fetchAdminAudit, type AdminAudit } from "../../api/adminApi";

const EMPTY_AUDIT: AdminAudit = {
  summary: {
    recentAdminActions: 0,
    recentExports: 0,
    recentIntegrityEvents: 0,
    recentSavedFilterActions: 0,
  },
  sections: {
    adminActions: [],
    exports: [],
    integrityEvents: [],
    savedFilterActions: [],
  },
};

function AuditList({
  title,
  items,
  renderMeta,
}: {
  title: string;
  items: Array<{ id: string; label: string; occurredAt: string | number | null; relatedAdminPath?: string | null }>;
  renderMeta?: (item: any) => React.ReactNode;
}) {
  return (
    <Card style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 700 }}>{title}</div>
      {!items.length ? (
        <div style={{ color: "#64748b" }}>No recent activity recorded yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: "grid", gap: 4, borderTop: "1px solid rgba(15, 23, 42, 0.08)", paddingTop: 10 }}>
              <div style={{ fontWeight: 600 }}>{item.label}</div>
              {renderMeta ? <div style={{ color: "#64748b", fontSize: 13 }}>{renderMeta(item)}</div> : null}
              <div style={{ color: "#64748b", fontSize: 13 }}>{String(item.occurredAt || "Unknown time")}</div>
              {item.relatedAdminPath ? (
                <Link to={item.relatedAdminPath} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                  Open related page
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export const AdminAuditPage: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<AdminAudit>(EMPTY_AUDIT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminAudit();
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load admin audit");
      showToast({
        message: "Failed to load admin audit",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const hasAny =
    data.summary.recentAdminActions +
      data.summary.recentExports +
      data.summary.recentIntegrityEvents +
      data.summary.recentSavedFilterActions >
    0;

  return (
    <MacShell title="Admin · Audit">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Audit</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Recent admin actions, export activity, integrity-related events, and saved-filter operations in a safe read-only summary view.
              </div>
            </div>
            <Button variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        {loading ? <Card>Loading audit activity…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load admin audit: {error}</Card> : null}

        {!loading && !error ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              {[
                ["Recent Admin Actions", data.summary.recentAdminActions],
                ["Recent Exports", data.summary.recentExports],
                ["Recent Integrity Events", data.summary.recentIntegrityEvents],
                ["Recent Saved Filter Actions", data.summary.recentSavedFilterActions],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
                </Card>
              ))}
            </div>

            {!hasAny ? (
              <Card style={{ color: "#475569" }}>No recent admin audit activity is available yet.</Card>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <AuditList
                  title="Recent Admin Actions"
                  items={data.sections.adminActions}
                  renderMeta={(item) => [item.pageKey, item.route].filter(Boolean).join(" · ")}
                />
                <AuditList
                  title="Recent Exports"
                  items={data.sections.exports}
                  renderMeta={(item: any) =>
                    [
                      item.exportType || null,
                      typeof item.rowCount === "number" ? `${item.rowCount} rows` : null,
                      item.capped ? "capped" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  }
                />
                <AuditList
                  title="Recent Integrity/Admin Events"
                  items={data.sections.integrityEvents}
                  renderMeta={(item: any) => [item.severity, item.eventType].filter(Boolean).join(" · ")}
                />
                <AuditList
                  title="Recent Saved Filter Actions"
                  items={data.sections.savedFilterActions}
                  renderMeta={(item: any) => [item.action, item.pageKey].filter(Boolean).join(" · ")}
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </MacShell>
  );
};

export default AdminAuditPage;
