import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { exportAdminIntegrityCsv, fetchAdminIntegrity, type AdminIntegrity } from "../../api/adminApi";

const EMPTY_INTEGRITY: AdminIntegrity = {
  sections: [
    {
      key: "orphan_properties",
      label: "Orphan Properties",
      severity: "high",
      count: 0,
      description: "",
      samples: [],
    },
    {
      key: "missing_owner_linkage",
      label: "Missing Owner Linkage",
      severity: "high",
      count: 0,
      description: "",
      samples: [],
    },
    {
      key: "duplicate_active_leases",
      label: "Duplicate Active Leases",
      severity: "high",
      count: 0,
      description: "",
      samples: [],
    },
    {
      key: "stale_lease_pointers",
      label: "Stale Lease Pointers",
      severity: "medium",
      count: 0,
      description: "",
      samples: [],
    },
    {
      key: "property_unit_mismatches",
      label: "Property / Unit Mismatches",
      severity: "medium",
      count: 0,
      description: "",
      samples: [],
    },
  ],
  totals: {
    issueTypes: 0,
    totalIssues: 0,
    highSeverity: 0,
    mediumSeverity: 0,
    lowSeverity: 0,
  },
};

function SeverityPill({ severity }: { severity: "high" | "medium" | "low" }) {
  const tone = severity === "high" ? "danger" : severity === "medium" ? "accent" : "default";
  return <Pill tone={tone}>{severity}</Pill>;
}

export const AdminIntegrityPage: React.FC = () => {
  const { showToast } = useToast();
  const [data, setData] = useState<AdminIntegrity>(EMPTY_INTEGRITY);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminIntegrity();
      setData({
        sections: result.sections,
        totals: result.totals,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load admin integrity");
      showToast({
        message: "Failed to load admin integrity",
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

  const handleExport = async () => {
    try {
      setExporting(true);
      const { blob, filename } = await exportAdminIntegrityCsv();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast({
        message: "Failed to export integrity CSV",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  const hasIssues = data.totals.totalIssues > 0;

  return (
    <MacShell title="Admin · Integrity">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Integrity</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Read-only platform integrity snapshot across properties, leases, and tenant linkages with bounded samples and safe drill-through links.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={handleExport} disabled={loading || exporting}>
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
              <Button variant="secondary" onClick={load} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </Section>

        {loading ? <Card>Loading integrity issues…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load admin integrity: {error}</Card> : null}

        {!loading && !error ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              {[
                ["Issue Types", data.totals.issueTypes],
                ["Total Issues", data.totals.totalIssues],
                ["High Severity", data.totals.highSeverity],
                ["Medium Severity", data.totals.mediumSeverity],
                ["Low Severity", data.totals.lowSeverity],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
                </Card>
              ))}
            </div>

            {!hasIssues ? (
              <Card style={{ color: "#475569" }}>No integrity issues detected in the current admin snapshot.</Card>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {data.sections.map((section) => (
                  <Card key={section.key} style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 700 }}>{section.label}</div>
                          <SeverityPill severity={section.severity} />
                        </div>
                        <div style={{ color: "#475569" }}>{section.description}</div>
                      </div>
                      <Pill tone={section.count > 0 ? "danger" : "default"}>{section.count}</Pill>
                    </div>

                    {section.samples.length ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {section.samples.map((sample) => (
                          <div
                            key={sample.id}
                            style={{
                              display: "grid",
                              gap: 6,
                              borderTop: "1px solid rgba(15, 23, 42, 0.08)",
                              paddingTop: 10,
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{sample.label}</div>
                            <div style={{ color: "#64748b", fontSize: 13 }}>
                              {sample.type}
                              {sample.propertyId ? ` · Property ${sample.propertyId}` : ""}
                              {sample.leaseId ? ` · Lease ${sample.leaseId}` : ""}
                              {sample.tenantId ? ` · Tenant ${sample.tenantId}` : ""}
                            </div>
                            {sample.relatedAdminPath ? (
                              <Link to={sample.relatedAdminPath} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                                Review sample
                              </Link>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#64748b" }}>No sample records for this issue type right now.</div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </MacShell>
  );
};

export default AdminIntegrityPage;
