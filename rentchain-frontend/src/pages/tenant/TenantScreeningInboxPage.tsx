import React from "react";
import { Link } from "react-router-dom";
import { listTenantScreenings, type TenantScreeningRequest } from "../../api/tenantScreeningApi";
import TenantScreeningConsentCard from "../../components/tenant/TenantScreeningConsentCard";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";
import {
  TenantEmptyState,
  TenantErrorState,
  TenantInfoCard,
  TenantKeyValueGrid,
  TenantLoadingState,
  TenantSurfaceShell,
  TenantUnauthorizedState,
  formatDate,
} from "./TenantWorkspaceShared";
import { buildTenantScreeningInboxItemView } from "./tenantScreeningInboxView";

function badgeColors(status: ReturnType<typeof buildTenantScreeningInboxItemView>["status"]) {
  switch (status) {
    case "consent_required":
      return { background: "rgba(245,158,11,0.14)", color: "#92400e" };
    case "consent_confirmed":
      return { background: "rgba(59,130,246,0.14)", color: "#1d4ed8" };
    case "screening_in_progress":
      return { background: "rgba(14,165,233,0.14)", color: "#0c4a6e" };
    case "completed":
      return { background: "rgba(34,197,94,0.12)", color: "#166534" };
    case "manual_review":
      return { background: "rgba(168,85,247,0.12)", color: "#6b21a8" };
    case "blocked":
      return { background: "rgba(239,68,68,0.12)", color: "#991b1b" };
    default:
      return { background: "rgba(148,163,184,0.16)", color: "#475569" };
  }
}

export default function TenantScreeningInboxPage() {
  const [items, setItems] = React.useState<TenantScreeningRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listTenantScreenings();
      const nextItems = Array.isArray((response as any)?.items) ? (response as any).items : [];
      setItems(nextItems);
    } catch (err: any) {
      setItems([]);
      setError(err?.payload?.error || err?.message || "Unable to load screening requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleConsentUpdated = React.useCallback((screeningRequest: TenantScreeningRequest) => {
    setItems((current) => current.map((item) => (item.id === screeningRequest.id ? screeningRequest : item)));
  }, []);

  if (loading) {
    return (
      <TenantSurfaceShell
        title="Screening Requests"
        subtitle="Review screening requests and manage consent for your rental applications."
      >
        <TenantLoadingState label="Loading your screening requests..." />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    if (/unauthorized|forbidden/i.test(error)) {
      return (
        <TenantSurfaceShell
          title="Screening Requests"
          subtitle="Review screening requests and manage consent for your rental applications."
        >
          <TenantUnauthorizedState />
        </TenantSurfaceShell>
      );
    }
    return (
      <TenantSurfaceShell
        title="Screening Requests"
        subtitle="Review screening requests and manage consent for your rental applications."
      >
        <TenantErrorState message={error} retry={load} />
      </TenantSurfaceShell>
    );
  }

  if (items.length === 0) {
    return (
      <TenantSurfaceShell
        title="Screening Requests"
        subtitle="Review screening requests and manage consent for your rental applications."
      >
        <TenantEmptyState
          title="No screening requests yet."
          body="If a landlord requests screening for one of your applications, it will appear here."
        />
      </TenantSurfaceShell>
    );
  }

  return (
    <TenantSurfaceShell
      title="Screening Requests"
      subtitle="Review screening requests and manage consent for your rental applications."
      action={
        <Link
          to="/tenant/application"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 12px",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            color: textTokens.primary,
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Open application checklist
        </Link>
      }
    >
      <div style={{ display: "grid", gap: spacing.md }}>
        {items.map((item) => {
          const view = buildTenantScreeningInboxItemView(item);
          const badge = badgeColors(view.status);
          const showConsentCard = view.status === "consent_required" || view.status === "consent_confirmed";
          return (
            <TenantInfoCard key={item.id} heading={view.propertyContext} accent={badge.color}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>
                    {view.requestContext}
                  </div>
                  <div style={{ color: textTokens.secondary }}>
                    Requested by <strong style={{ color: textTokens.primary }}>{view.requesterLabel}</strong>
                  </div>
                  <div style={{ color: textTokens.secondary }}>{view.description}</div>
                </div>
                <div
                  style={{
                    alignSelf: "start",
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: badge.background,
                    color: badge.color,
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  {view.statusLabel}
                </div>
              </div>

              <TenantKeyValueGrid
                rows={[
                  { label: "Consent", value: view.consentLabel },
                  { label: "Provider", value: view.providerLabel },
                  { label: "Requested", value: formatDate(view.requestedAt) },
                  { label: "Last update", value: formatDate(view.activityAt) },
                ]}
              />

              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  background: colors.panel,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700, color: textTokens.primary }}>Next step</div>
                <div style={{ color: textTokens.secondary }}>
                  {view.nextActionLabel}
                </div>
                {view.consentedAt && !showConsentCard ? (
                  <div style={{ color: textTokens.muted }}>
                    Consent confirmed on {formatDate(view.consentedAt)}.
                  </div>
                ) : null}
              </div>

              {showConsentCard ? (
                <TenantScreeningConsentCard screening={item} onConsentUpdated={handleConsentUpdated} />
              ) : null}
            </TenantInfoCard>
          );
        })}
      </div>
    </TenantSurfaceShell>
  );
}
