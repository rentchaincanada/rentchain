import React from "react";
import { useParams } from "react-router-dom";
import { fetchPublicTenantSharePackage } from "../../api/publicTenantSharePackageApi";

function prettyStatus(value: string | null | undefined) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function TenantSharePackagePage() {
  const { token = "" } = useParams();
  const [data, setData] = React.useState<Awaited<ReturnType<typeof fetchPublicTenantSharePackage>> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchPublicTenantSharePackage(token);
        if (!mounted) return;
        if (!result) {
          setError("This shared rental profile is unavailable.");
          setData(null);
          return;
        }
        setData(result);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "This shared rental profile is unavailable.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)", padding: 24 }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Shared Rental Profile</h1>
          <div style={{ color: "#475569" }}>
            A tenant-approved summary of rental readiness and verification signals.
          </div>
        </div>

        {loading ? (
          <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18 }}>
            Loading shared rental profile…
          </div>
        ) : null}

        {!loading && error ? (
          <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18, color: "#b91c1c" }}>
            {error}
          </div>
        ) : null}

        {!loading && !error && data ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18, display: "grid", gap: 8 }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{data.identity.readinessLabel}</div>
              <div style={{ color: "#475569", lineHeight: 1.6 }}>{data.identity.readinessDescription}</div>
            </div>

            <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#fff", padding: 18 }}>
              <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>Summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {[
                  ["Identity status", prettyStatus(data.identity.identityStatus)],
                  ["Verification", prettyStatus(data.identity.verification.level)],
                  ["Profile", prettyStatus(data.profile.completionStatus)],
                  ["Application reuse", data.application.reusable ? "Ready" : "Still building"],
                  ["Documents", prettyStatus(data.documents.completionStatus)],
                  ["Screening", prettyStatus(data.screening.status)],
                  ["Active leases", String(data.leases.summary.activeCount)],
                  ["Lease history", String(data.leases.summary.historicalCount)],
                ].map(([label, value]) => (
                  <div key={label} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 4 }}>
                    <div style={{ color: "#64748b", fontSize: "0.85rem" }}>{label}</div>
                    <div style={{ color: "#0f172a", fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
