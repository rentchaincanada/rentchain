import React from "react";
import { getTenantApplicationStatus } from "../../api/tenantPortal";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantKeyValueGrid,
  TenantLoadingState,
  TenantSurfaceShell,
  formatDate,
  prettyStatus,
} from "./TenantWorkspaceShared";
import { spacing, text as textTokens } from "../../styles/tokens";

export default function TenantApplicationStatusPage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantApplicationStatus>>>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTenantApplicationStatus());
    } catch (err: any) {
      setData(null);
      setError(err?.payload?.error || err?.message || "Unable to load application status.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <TenantSurfaceShell
      title="Application Status"
      subtitle="This page only renders the tenant-safe application projection from the tenant foundation backend."
    >
      {loading ? <TenantLoadingState label="Loading application status..." /> : null}
      {!loading && error ? <TenantErrorState message={error} retry={load} /> : null}
      {!loading && !error && !data ? (
        <TenantEmptyState
          title="No application status yet"
          body="This workspace does not currently expose an application status projection."
        />
      ) : null}
      {!loading && !error && data ? (
        <>
          <TenantInfoCard heading="Application Summary" accent="#1d4ed8">
            <TenantKeyValueGrid
              rows={[
                { label: "Status", value: prettyStatus(data.status) },
                { label: "Created", value: formatDate(data.createdAt) },
                { label: "Updated", value: formatDate(data.updatedAt) },
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
            <TenantInfoCard heading="Missing Steps" accent="#b45309">
              {data.missingSteps.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {data.missingSteps.map((item) => (
                    <div key={item} style={{ color: textTokens.secondary }}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: textTokens.muted }}>No missing steps are currently listed.</div>
              )}
            </TenantInfoCard>

            <TenantInfoCard heading="Next Actions" accent="#0f766e">
              {data.nextActions.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {data.nextActions.map((item) => (
                    <div key={item} style={{ color: textTokens.secondary }}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: textTokens.muted }}>No next actions are currently listed.</div>
              )}
            </TenantInfoCard>
          </div>
        </>
      ) : null}
    </TenantSurfaceShell>
  );
}
