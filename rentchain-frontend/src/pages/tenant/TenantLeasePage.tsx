import React from "react";
import { getTenantLeaseWorkspace } from "../../api/tenantPortal";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantKeyValueGrid,
  TenantLoadingState,
  TenantSurfaceShell,
  formatDate,
  formatMoney,
  prettyStatus,
} from "./TenantWorkspaceShared";

export default function TenantLeasePage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantLeaseWorkspace>>>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTenantLeaseWorkspace());
    } catch (err: any) {
      setData(null);
      setError(err?.payload?.error || err?.message || "Unable to load lease details.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <TenantSurfaceShell
      title="Lease"
      subtitle="Your lease page renders only the tenant-safe lease projection approved by the tenant foundation backend."
    >
      {loading ? <TenantLoadingState label="Loading lease details..." /> : null}
      {!loading && error ? <TenantErrorState message={error} retry={load} /> : null}
      {!loading && !error && !data ? (
        <TenantEmptyState
          title="No lease is available yet"
          body="Lease details will appear here once your active tenancy is available through the tenant workspace."
        />
      ) : null}
      {!loading && !error && data ? (
        <>
          <TenantInfoCard heading="Lease Summary" accent="#7c3aed">
            <TenantKeyValueGrid
              rows={[
                { label: "Status", value: prettyStatus(data.status) },
                { label: "Start date", value: formatDate(data.startDate) },
                { label: "End date", value: formatDate(data.endDate) },
                { label: "Monthly rent", value: formatMoney(data.monthlyRent) },
              ]}
            />
          </TenantInfoCard>

          <TenantInfoCard heading="Lease Document" accent="#0f766e">
            {data.documentUrl ? (
              <a href={data.documentUrl} target="_blank" rel="noreferrer">
                Open lease document
              </a>
            ) : (
              <div style={{ color: "var(--text-muted, #64748b)" }}>
                No approved lease document link is available in this workspace yet.
              </div>
            )}
          </TenantInfoCard>
        </>
      ) : null}
    </TenantSurfaceShell>
  );
}
