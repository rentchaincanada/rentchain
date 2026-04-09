import React from "react";
import { Link } from "react-router-dom";
import { getTenantWorkspace } from "../../api/tenantPortal";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantKeyValueGrid,
  TenantLoadingState,
  TenantSurfaceShell,
  formatDate,
  formatMoney,
  prettyAuthority,
  prettyStatus,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";

export default function TenantWorkspacePage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantWorkspace>> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getTenantWorkspace();
      setData(next);
    } catch (err: any) {
      setData(null);
      setError(err?.payload?.error || err?.message || "Unable to load your tenant workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <TenantSurfaceShell title="Tenant Workspace" subtitle="Loading your property, application, lease, and maintenance summary.">
        <TenantLoadingState />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell title="Tenant Workspace" subtitle="Your summary is generated from the tenant-safe workspace contract only.">
        {unauthorized ? (
          <TenantErrorState message="Your current session cannot open this workspace yet. Sign in again or contact support if this looks wrong." retry={load} />
        ) : (
          <TenantErrorState message={error} retry={load} />
        )}
      </TenantSurfaceShell>
    );
  }

  const propertyAddress = [data?.property?.street1, data?.property?.street2, data?.property?.city, data?.property?.province]
    .filter(Boolean)
    .join(", ");
  const maintenanceCount = Array.isArray(data?.maintenance) ? data.maintenance.length : 0;
  const nextActions = data?.application?.nextActions || [];

  return (
    <TenantSurfaceShell
      title="Tenant Workspace"
      subtitle="Your RentChain tenant workspace is powered by the landlord-side canonical records that are safe for tenant access."
      action={
        <Link
          to="/tenant/invite/redeem"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 12px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 700,
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          Redeem invite
        </Link>
      }
    >
      <TenantInfoCard heading="Workspace Summary" accent="#0f766e">
        <TenantKeyValueGrid
          rows={[
            { label: "Access", value: prettyAuthority(data?.context?.authority) },
            { label: "Property", value: propertyAddress || "No property summary yet" },
            { label: "Application", value: prettyStatus(data?.application?.status) },
            { label: "Lease", value: prettyStatus(data?.lease?.status) },
            { label: "Maintenance", value: `${maintenanceCount} request${maintenanceCount === 1 ? "" : "s"}` },
          ]}
        />
      </TenantInfoCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: spacing.md,
        }}
      >
        <TenantInfoCard heading="Application" accent="#1d4ed8">
          {data?.application ? (
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ color: textTokens.secondary }}>Current status: <strong>{prettyStatus(data.application.status)}</strong></div>
              <div style={{ color: textTokens.secondary }}>Updated: {formatDate(data.application.updatedAt || data.application.createdAt)}</div>
              <Link to="/tenant/application">Open application status</Link>
            </div>
          ) : (
            <TenantEmptyState title="No application projection yet" body="We couldn't find a tenant-safe application view for this workspace yet." />
          )}
        </TenantInfoCard>

        <TenantInfoCard heading="Lease" accent="#7c3aed">
          {data?.lease ? (
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ color: textTokens.secondary }}>Status: <strong>{prettyStatus(data.lease.status)}</strong></div>
              <div style={{ color: textTokens.secondary }}>Rent: {formatMoney(data.lease.monthlyRent)}</div>
              <Link to="/tenant/lease">Open lease details</Link>
            </div>
          ) : (
            <TenantEmptyState title="No lease projection yet" body="Lease details will appear here once your active tenancy is available to the tenant workspace." />
          )}
        </TenantInfoCard>

        <TenantInfoCard heading="Maintenance" accent="#b45309">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: textTokens.secondary }}>
              {maintenanceCount > 0
                ? `You have ${maintenanceCount} maintenance request${maintenanceCount === 1 ? "" : "s"} in view.`
                : "You have no maintenance requests yet."}
            </div>
            <Link to="/tenant/maintenance">Open maintenance</Link>
          </div>
        </TenantInfoCard>
      </div>

      {nextActions.length ? (
        <TenantInfoCard heading="Next Steps" accent="#0891b2">
          <div style={{ display: "grid", gap: 8 }}>
            {nextActions.map((item) => (
              <div key={item} style={{ color: textTokens.secondary }}>
                {item}
              </div>
            ))}
          </div>
        </TenantInfoCard>
      ) : null}
    </TenantSurfaceShell>
  );
}
