import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { fetchAdminOverview, type AdminOverview } from "../../api/adminApi";

type AdminQuickLinkCountKey = keyof Pick<
  AdminOverview["summary"],
  "totalProperties" | "totalTenants" | "totalLeases" | "integrityWarnings"
>;

const QUICK_LINKS: Array<{
  title: string;
  to: string;
  description: string;
  countKey: AdminQuickLinkCountKey | null;
}> = [
  {
    title: "Properties",
    to: "/admin/properties",
    description: "Review platform-wide properties and ownership health.",
    countKey: "totalProperties" as const,
  },
  {
    title: "Tenants",
    to: "/admin/tenants",
    description: "Inspect tenant identity, placement, and screening state.",
    countKey: "totalTenants" as const,
  },
  {
    title: "Leases",
    to: "/admin/leases",
    description: "Audit lease coverage, rent terms, and integrity issues.",
    countKey: "totalLeases" as const,
  },
  {
    title: "Integrity",
    to: "/admin/integrity",
    description: "Integrity dashboard is the next phase for deeper issue review.",
    countKey: "integrityWarnings" as const,
  },
  {
    title: "Security incidents",
    to: "/admin/security/incidents",
    description: "Review metadata-only security, impersonation, policy, and projection signals.",
    countKey: null,
  },
];

const EMPTY_OVERVIEW: AdminOverview = {
  summary: {
    totalProperties: 0,
    totalUnits: 0,
    totalTenants: 0,
    totalLeases: 0,
    activeLeases: 0,
    integrityWarnings: 0,
    orphanRecords: 0,
  },
  activity: {
    recentAdminAccessCount: 0,
    recentHighImpactEvents: [],
  },
  integrity: {
    orphanProperties: 0,
    missingOwnerLinks: 0,
    duplicateActiveLeases: 0,
    staleLeasePointers: 0,
    propertyUnitMismatches: 0,
  },
};

export const AdminDashboardPage: React.FC = () => {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<AdminOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchAdminOverview();
      setOverview({
        summary: result.summary,
        activity: result.activity,
        integrity: result.integrity,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load admin overview");
      showToast({
        message: "Failed to load admin overview",
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

  return (
    <MacShell title="Admin · Dashboard">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Admin Dashboard</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Platform-wide snapshot across properties, tenants, leases, recent admin activity, and integrity warning counts.
              </div>
            </div>
            <Button variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        {loading ? <Card>Loading admin overview…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load admin overview: {error}</Card> : null}

        {!loading && !error ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              {[
                ["Total Properties", overview.summary.totalProperties],
                ["Total Tenants", overview.summary.totalTenants],
                ["Total Leases", overview.summary.totalLeases],
                ["Active Leases", overview.summary.activeLeases],
                ["Integrity Warnings", overview.summary.integrityWarnings],
                ["Orphan Records", overview.summary.orphanRecords],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
                </Card>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {QUICK_LINKS.map((link) => (
                <Card key={link.to} style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{link.title}</div>
                    {link.countKey ? <Pill tone="accent">{overview.summary[link.countKey]}</Pill> : <Pill tone="muted">Review</Pill>}
                  </div>
                  <div style={{ color: "#475569", minHeight: 40 }}>{link.description}</div>
                  <Link to={link.to} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                    Open {link.title}
                  </Link>
                </Card>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Integrity Snapshot</div>
                <div style={{ display: "grid", gap: 8, color: "#475569" }}>
                  <div>Orphan Properties: {overview.integrity.orphanProperties}</div>
                  <div>Missing Owner Links: {overview.integrity.missingOwnerLinks}</div>
                  <div>Duplicate Active Leases: {overview.integrity.duplicateActiveLeases}</div>
                  <div>Stale Lease Pointers: {overview.integrity.staleLeasePointers}</div>
                  <div>Property / Unit Mismatches: {overview.integrity.propertyUnitMismatches}</div>
                </div>
              </Card>

              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Recent Activity</div>
                <div style={{ color: "#475569" }}>
                  Recent admin access count: <strong style={{ color: "#0f172a" }}>{overview.activity.recentAdminAccessCount}</strong>
                </div>
                {overview.activity.recentHighImpactEvents.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {overview.activity.recentHighImpactEvents.map((event) => (
                      <div key={event.key} style={{ borderTop: "1px solid rgba(15, 23, 42, 0.08)", paddingTop: 8 }}>
                        <div style={{ fontWeight: 600 }}>{event.label}</div>
                        <div style={{ color: "#64748b", fontSize: 13 }}>{String(event.ts || "Unknown time")}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#64748b" }}>No recent admin events are available yet.</div>
                )}
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </MacShell>
  );
};

export default AdminDashboardPage;
