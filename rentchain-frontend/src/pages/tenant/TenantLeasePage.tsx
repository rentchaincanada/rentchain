import React from "react";
import { getTenantLeaseWorkspace, signTenantLease } from "../../api/tenantPortal";
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
  const [signing, setSigning] = React.useState(false);
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

  async function handleTenantSign() {
    if (!data?.leaseId) return;
    setSigning(true);
    setError(null);
    try {
      setData(await signTenantLease(data.leaseId));
    } catch (err: any) {
      setError(err?.payload?.error || err?.message || "Unable to record your lease signature.");
    } finally {
      setSigning(false);
    }
  }

  const execution = data?.leaseExecution || null;
  const timelineRows = execution
    ? [
        {
          label: "Lease details",
          value:
            execution.executionStatus === "blocked"
              ? "Needs attention"
              : "Ready",
        },
        {
          label: "Tenant signature",
          value:
            execution.tenantSignatureStatus === "completed"
              ? "Completed"
              : execution.tenantSignatureStatus === "needed"
              ? "Needed"
              : execution.tenantSignatureStatus === "blocked"
              ? "Blocked"
              : "Not required",
        },
        {
          label: "Landlord signature",
          value:
            execution.landlordSignatureStatus === "completed"
              ? "Completed"
              : execution.landlordSignatureStatus === "needed"
              ? "Needed"
              : execution.landlordSignatureStatus === "blocked"
              ? "Blocked"
              : "Not required",
        },
        {
          label: "Fully executed",
          value: execution.executionStatus === "fully_executed" ? "Completed" : "Pending",
        },
      ]
    : [];

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
            {data.leasePdfLabel ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>{data.leasePdfLabel}</div>
                {data.leasePdfDescription ? (
                  <div style={{ color: "var(--text-muted, #64748b)" }}>{data.leasePdfDescription}</div>
                ) : null}
              </div>
            ) : null}
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

          <TenantInfoCard heading="Lease Signing" accent="#7c3aed">
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800 }}>{data.signatureReadinessLabel || "Lease signing unavailable"}</div>
                <div style={{ color: "var(--text-muted, #64748b)" }}>
                  {data.signatureReadinessDescription || "Lease signing details are not available in this workspace yet."}
                </div>
              </div>

              {data.tenantSignature ? (
                <TenantKeyValueGrid
                  rows={[
                    { label: "Signed at", value: formatDate(data.tenantSignature.signedAt) },
                    {
                      label: "Signature method",
                      value:
                        data.tenantSignature.signatureMethod === "drawn"
                          ? "Drawn signature"
                          : data.tenantSignature.signatureMethod === "typed"
                          ? "Typed signature"
                          : "—",
                    },
                    { label: "Signed by", value: data.tenantSignature.signatureDisplayName || "—" },
                  ]}
                />
              ) : null}
            </div>
          </TenantInfoCard>

          {execution ? (
            <TenantInfoCard heading="Lease Execution" accent="#0f172a">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 800 }}>{execution.executionLabel}</div>
                  <div style={{ color: "var(--text-muted, #64748b)" }}>{execution.executionDescription}</div>
                </div>

                <TenantKeyValueGrid rows={timelineRows} />

                {execution.completedAt ? (
                  <div style={{ color: "var(--text-muted, #64748b)" }}>
                    Completed at {formatDate(execution.completedAt)}
                  </div>
                ) : null}

                {execution.requiredNextAction === "tenant_signature" && data?.leaseId ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <button type="button" onClick={() => void handleTenantSign()} disabled={signing}>
                      {signing ? "Recording signature..." : "Confirm tenant signature"}
                    </button>
                    <div style={{ color: "var(--text-muted, #64748b)" }}>
                      This records tenant signature metadata for the current lease workflow without storing any drawn signature image.
                    </div>
                  </div>
                ) : null}
              </div>
            </TenantInfoCard>
          ) : null}
        </>
      ) : null}
    </TenantSurfaceShell>
  );
}
