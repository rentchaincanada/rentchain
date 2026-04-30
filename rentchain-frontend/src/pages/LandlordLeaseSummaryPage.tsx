import React from "react";
import { Link, useParams } from "react-router-dom";
import { getLeaseById, type LandlordActiveLease } from "@/api/leasesApi";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

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

function prettyLeaseStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized === "notice_pending") return "Renew letter needed";
  if (normalized === "renewal_pending") return "Renewal pending";
  if (normalized === "renewal_accepted") return "Renewing";
  if (normalized === "move_out_pending") return "Quitting";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
    `Status: ${prettyLeaseStatus(lease.status)}`,
    `Lease document: ${lease.documentUrl ? "Available" : "Not available"}`,
  ].join("\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lease-${lease.unitNumber || lease.id}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ color: "#0f172a" }}>{value}</div>
    </div>
  );
}

export default function LandlordLeaseSummaryPage() {
  const { leaseId = "" } = useParams();
  const [lease, setLease] = React.useState<LandlordActiveLease | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      if (!leaseId) {
        setError("Missing lease id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await getLeaseById(leaseId);
        if (!active) return;
        setLease(response.lease || null);
      } catch (err: unknown) {
        if (!active) return;
        setError(errorMessage(err, "Failed to load lease summary."));
        setLease(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [leaseId]);

  const ledgerPath = lease ? `/leases/${encodeURIComponent(lease.id)}/ledger` : `/leases/${encodeURIComponent(leaseId)}/ledger`;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Lease summary</div>
        <div style={{ color: "#475569", fontSize: 14 }}>
          Review the current landlord-visible lease details when a separate lease document is not attached.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link
          to={ledgerPath}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}
        >
          Open ledger
        </Link>
        <button
          type="button"
          onClick={() => {
            if (lease) downloadLeaseSummary(lease);
          }}
          disabled={!lease}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
        >
          Save lease summary
        </button>
        <Link
          to="/leases"
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}
        >
          Back to leases
        </Link>
      </div>

      {loading ? <div>Loading lease summary…</div> : null}
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {lease ? (
        <>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              padding: 16,
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#fff",
            }}
          >
            <DetailRow label="Property" value={lease.propertyName || "Property"} />
            <DetailRow label="Unit" value={lease.unitNumber || "—"} />
            <DetailRow label="Tenant" value={lease.tenantName || "—"} />
            <DetailRow label="Monthly rent" value={formatCurrency(lease.monthlyRent)} />
            <DetailRow label="Start date" value={formatDate(lease.startDate)} />
            <DetailRow label="End date" value={formatDate(lease.endDate)} />
            <DetailRow label="Status" value={prettyLeaseStatus(lease.status)} />
            <DetailRow label="Lease document" value={lease.documentUrl ? "Available" : "Not attached"} />
          </div>

          {lease.leaseExecution || lease.paymentReadiness || lease.leaseLifecycleSummary ? (
            <div
              style={{
                display: "grid",
                gap: 16,
                padding: 16,
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Current lease signals</div>

              {lease.leaseExecution ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Execution</div>
                  <div>{lease.leaseExecution.executionLabel}</div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>{lease.leaseExecution.executionDescription}</div>
                </div>
              ) : null}

              {lease.paymentReadiness ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Payment readiness</div>
                  <div>{lease.paymentReadiness.readinessLabel}</div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>{lease.paymentReadiness.readinessDescription}</div>
                </div>
              ) : null}

              {lease.leaseLifecycleSummary ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Lifecycle</div>
                  <div>{lease.leaseLifecycleSummary.lifecycleLabel}</div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>{lease.leaseLifecycleSummary.lifecycleDescription}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
