import React from "react";
import { Link } from "react-router-dom";
import { getActiveLeasesForLandlord, type LandlordActiveLease } from "@/api/leasesApi";

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : 0;
  return amount.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function downloadLeaseSummary(lease: LandlordActiveLease) {
  const text = [
    `Property: ${lease.propertyName || "Property"}`,
    `Unit: ${lease.unitNumber || "—"}`,
    `Tenant: ${lease.tenantName || "—"}`,
    `Tenant email: ${lease.tenantEmail || "—"}`,
    `Monthly rent: ${formatCurrency(lease.monthlyRent)}`,
    `Start date: ${lease.startDate || "—"}`,
    `End date: ${lease.endDate || "—"}`,
    `Status: ${lease.status || "—"}`,
    `Lease document: ${lease.documentUrl || "Not available"}`,
  ].join("\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lease-${lease.unitNumber || lease.id}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function LandlordActiveLeasesPage() {
  const [leases, setLeases] = React.useState<LandlordActiveLease[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getActiveLeasesForLandlord();
        if (!active) return;
        setLeases(Array.isArray(response?.leases) ? response.leases : []);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load active leases.");
        setLeases([]);
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
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Active leases</div>
        <div style={{ color: "#475569", fontSize: 14 }}>
          View the current active lease rollup for your portfolio, including quick actions to open, email, or save each lease reference.
        </div>
      </div>

      {loading ? <div>Loading active leases…</div> : null}
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {!loading && !error && leases.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#475569",
          }}
        >
          No active leases were found for this landlord yet.
        </div>
      ) : null}

      {!loading && !error && leases.length > 0 ? (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
          <table style={{ width: "100%", minWidth: 920, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569" }}>
                {["Property", "Unit", "Tenant", "Rent", "Term", "Actions"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leases.map((lease) => {
                const ledgerPath = `/leases/${encodeURIComponent(lease.id)}/ledger`;
                const ledgerUrl =
                  typeof window !== "undefined"
                    ? `${window.location.origin}${ledgerPath}`
                    : ledgerPath;
                const emailSubject = encodeURIComponent(`Lease for ${lease.propertyName} unit ${lease.unitNumber}`);
                const emailBody = encodeURIComponent(
                  [
                    `Lease reference for ${lease.propertyName} unit ${lease.unitNumber}.`,
                    "",
                    `Monthly rent: ${formatCurrency(lease.monthlyRent)}`,
                    `Term: ${formatDate(lease.startDate)} to ${formatDate(lease.endDate)}`,
                    `View ledger: ${ledgerUrl}`,
                    lease.documentUrl ? `Lease document: ${lease.documentUrl}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n")
                );
                const emailHref = lease.tenantEmail
                  ? `mailto:${encodeURIComponent(lease.tenantEmail)}?subject=${emailSubject}&body=${emailBody}`
                  : null;

                return (
                  <tr key={lease.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{lease.propertyName}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{lease.id}</div>
                    </td>
                    <td style={{ padding: 12 }}>{lease.unitNumber || "—"}</td>
                    <td style={{ padding: 12 }}>
                      <div>{lease.tenantName || "Tenant not linked"}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{lease.tenantEmail || "No email on file"}</div>
                    </td>
                    <td style={{ padding: 12 }}>{formatCurrency(lease.monthlyRent)}</td>
                    <td style={{ padding: 12 }}>
                      <div>{formatDate(lease.startDate)}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>to {formatDate(lease.endDate)}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link to={ledgerPath} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}>
                          View
                        </Link>
                        {emailHref ? (
                          <a
                            href={emailHref}
                            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}
                          >
                            Email
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8" }}
                          >
                            Email
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (lease.documentUrl) {
                              const a = document.createElement("a");
                              a.href = lease.documentUrl;
                              a.target = "_blank";
                              a.rel = "noreferrer";
                              a.download = "";
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              return;
                            }
                            downloadLeaseSummary(lease);
                          }}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
                        >
                          Save
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
