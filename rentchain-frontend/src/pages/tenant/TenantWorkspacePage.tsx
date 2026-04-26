import React from "react";
import { Link } from "react-router-dom";
import { getTenantWorkspace } from "../../api/tenantPortal";
import { getTenantAccess, type TenantAccessWorkspace } from "../../api/tenantAccess";
import { getTenantAttachments } from "../../api/tenantAttachmentsApi";
import { getTenantProfile } from "../../api/tenantProfile";
import { getTenantApplicationCompletion } from "../../api/tenantApplicationCompletion";
import { getTenantNotificationPreferences } from "../../api/tenantNotificationPreferences";
import { getTenantCommunicationsWorkspace } from "../../api/tenantCommunicationsApi";
import { listTenantScreenings, type TenantScreeningRequest } from "../../api/tenantScreeningApi";
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
import TenantProfileCompletionCard from "./TenantProfileCompletionCard";
import { buildTenantProfileCompletion } from "./tenantProfileCompletion";
import { buildTenantDocumentVaultView } from "./tenantDocumentVault";
import { buildTenantApplicationReuseView } from "./tenantApplicationReuse";
import { buildTenantWorkspaceModeView } from "./tenantWorkspaceMode";
import { buildActiveTenancyWorkspaceState } from "./activeTenancyWorkspaceState";
import { buildTenantCommunicationsWorkspaceState } from "./tenantCommunicationsWorkspaceState";
import TenantWorkspaceModeBanner from "./TenantWorkspaceModeBanner";
import StructuredNotificationList from "../StructuredNotificationList";
import { buildTenantStructuredNotificationTriggers } from "../structuredNotificationTriggers";
import { filterStructuredNotificationsByPreferences } from "../notificationChannelRouting";
import { buildTenantScreeningDashboardSummary } from "./tenantScreeningInboxView";

export default function TenantWorkspacePage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantWorkspace>> | null>(null);
  const [access, setAccess] = React.useState<TenantAccessWorkspace | null>(null);
  const [attachments, setAttachments] = React.useState<Awaited<ReturnType<typeof getTenantAttachments>> | null>(null);
  const [profileData, setProfileData] = React.useState<Awaited<ReturnType<typeof getTenantProfile>> | null>(null);
  const [completion, setCompletion] = React.useState<Awaited<ReturnType<typeof getTenantApplicationCompletion>> | null>(null);
  const [notificationPreferences, setNotificationPreferences] = React.useState<Awaited<ReturnType<typeof getTenantNotificationPreferences>> | null>(null);
  const [communications, setCommunications] = React.useState<Awaited<ReturnType<typeof getTenantCommunicationsWorkspace>> | null>(null);
  const [screenings, setScreenings] = React.useState<TenantScreeningRequest[]>([]);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workspaceResult, accessResult, attachmentsResult, completionResult, preferencesResult, communicationsResult, screeningsResult] = await Promise.allSettled([
        getTenantWorkspace(),
        getTenantAccess(),
        getTenantAttachments(),
        getTenantApplicationCompletion(),
        getTenantNotificationPreferences(),
        getTenantCommunicationsWorkspace(),
        listTenantScreenings(),
      ]);

      if (workspaceResult.status === "rejected") {
        throw workspaceResult.reason;
      }

      setData(workspaceResult.value);
      setAccess(accessResult.status === "fulfilled" ? accessResult.value : null);
      setAttachments(attachmentsResult.status === "fulfilled" ? attachmentsResult.value : null);
      setCompletion(completionResult.status === "fulfilled" ? completionResult.value : null);
      setNotificationPreferences(preferencesResult.status === "fulfilled" ? preferencesResult.value : null);
      setCommunications(communicationsResult.status === "fulfilled" ? communicationsResult.value : null);
      setScreenings(
        screeningsResult.status === "fulfilled" && Array.isArray((screeningsResult.value as any)?.items)
          ? (screeningsResult.value as any).items
          : [],
      );
    } catch (err: any) {
      setData(null);
      setAccess(null);
      setAttachments(null);
      setCompletion(null);
      setNotificationPreferences(null);
      setCommunications(null);
      setScreenings([]);
      setError(err?.payload?.error || err?.message || "Unable to load your tenant workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const next = await getTenantProfile();
        if (!cancelled) {
          setProfileData(next);
        }
      } catch {
        if (!cancelled) {
          setProfileData(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <TenantSurfaceShell title="Tenant Dashboard" subtitle="Loading your rental profile, application progress, lease, and maintenance summary.">
        <TenantLoadingState />
      </TenantSurfaceShell>
    );
  }

  if (error) {
    const unauthorized = /unauthorized|forbidden|ambiguous/i.test(error);
    return (
      <TenantSurfaceShell title="Tenant Dashboard" subtitle="Your dashboard only shows tenant-safe information tied to your current rental context.">
        {unauthorized ? (
          <TenantErrorState message="Your current session cannot open this dashboard yet. Sign in again or contact support if this looks wrong." retry={load} />
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
  const profileCompletion = profileData ? buildTenantProfileCompletion(profileData) : null;
  const documentVault = buildTenantDocumentVaultView({
    items: attachments?.data || [],
    summary: attachments?.summary,
    guidance: attachments?.guidance,
    updatedAt: attachments?.updatedAt,
    access,
  });
  const reuse = buildTenantApplicationReuseView({
    completion,
    profile: profileData,
    attachments,
    access,
  });
  const modeView = buildTenantWorkspaceModeView(data?.context);
  const activeTenancy = buildActiveTenancyWorkspaceState({
    context: data?.context,
    lease: data?.lease,
  });
  const communicationsView = buildTenantCommunicationsWorkspaceState(communications);
  const screeningSummary = buildTenantScreeningDashboardSummary(screenings);
  const notificationItems = filterStructuredNotificationsByPreferences(
    buildTenantStructuredNotificationTriggers({
      packageCategories: reuse.packageCategories,
      completion,
      profile: profileData,
      attachments,
      access,
    }),
    notificationPreferences
  );

  return (
    <TenantSurfaceShell
      title="Tenant Dashboard"
      subtitle="Keep your rental profile, documents, application progress, and ongoing tenancy details organized in one place."
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
      <TenantWorkspaceModeBanner view={modeView} />

      <TenantInfoCard heading="Active tenancy" accent="#7c3aed">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: textTokens.primary }}>
              {activeTenancy.title}
            </div>
            <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
              {activeTenancy.explanation}
            </div>
          </div>

          <TenantKeyValueGrid
            rows={[
              { label: "Status", value: activeTenancy.label },
              { label: "Lease reference", value: data?.lease?.leaseId || "Not visible yet" },
              { label: "Lease status", value: prettyStatus(data?.lease?.status) },
              { label: "Monthly rent", value: formatMoney(data?.lease?.monthlyRent) },
            ]}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: spacing.sm,
            }}
          >
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: textTokens.primary }}>Tenancy summary</div>
              {activeTenancy.summaryItems.map((item, index) => (
                <div key={`${item}-${index}`} style={{ color: textTokens.secondary }}>
                  {item}
                </div>
              ))}
            </div>

            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: textTokens.primary }}>
                {activeTenancy.needsAttention.length ? "Needs attention" : "Next steps"}
              </div>
              {(activeTenancy.needsAttention.length ? activeTenancy.needsAttention : activeTenancy.nextActions).map((item, index) => (
                <div key={`${item}-${index}`} style={{ color: textTokens.secondary }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <Link to="/tenant/lease" style={{ fontWeight: 700 }}>
              Open lease details
            </Link>
            <Link to="/tenant/attachments" style={{ fontWeight: 700 }}>
              Open documents
            </Link>
            <Link to="/tenant/payments" style={{ fontWeight: 700 }}>
              Open payments
            </Link>
          </div>
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Dashboard Summary" accent="#0f766e">
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

      <TenantInfoCard heading="Recent activity / notifications" accent="#0891b2">
        <StructuredNotificationList
          heading="Recent workflow updates"
          emptyLabel="Workflow-triggered notifications will appear here as your application, documents, access, and follow-up state change."
          items={notificationItems}
        />
      </TenantInfoCard>

      {profileLoading ? (
        <TenantInfoCard heading="Profile completion" accent="#1d4ed8">
          <div style={{ color: textTokens.secondary }}>
            Loading your profile completion summary...
          </div>
        </TenantInfoCard>
      ) : profileCompletion ? (
        <TenantProfileCompletionCard completion={profileCompletion} compact />
      ) : (
        <TenantInfoCard heading="Profile completion" accent="#1d4ed8">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: textTokens.secondary }}>
              Your profile summary is not available yet, but you can still open your profile workspace and keep your details organized.
            </div>
            <div>
              <Link to="/tenant/profile" style={{ fontWeight: 700 }}>
                View your profile
              </Link>
            </div>
          </div>
        </TenantInfoCard>
      )}

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
              <Link to="/tenant/application">Open application checklist</Link>
            </div>
          ) : (
            <TenantEmptyState title="No application view yet" body="We couldn't find a tenant-safe application summary for this dashboard yet." />
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

        <TenantInfoCard heading="Access" accent="#0891b2">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: textTokens.secondary }}>
              {access
                ? `${access.summary.activeGrants} active access grant${access.summary.activeGrants === 1 ? "" : "s"} and ${access.summary.pendingRequests} pending request${access.summary.pendingRequests === 1 ? "" : "s"}.`
                : "Review what you’ve shared and who can currently view supported profile information."}
            </div>
            <Link to="/tenant/access">Open access</Link>
          </div>
        </TenantInfoCard>

        <TenantInfoCard heading="Documents" accent="#166534">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: textTokens.secondary }}>
              {attachments
                ? `${documentVault.metrics[0]?.value || 0} document${documentVault.metrics[0]?.value === 1 ? "" : "s"} in your vault, ${documentVault.metrics[1]?.value || 0} ready to share, and ${documentVault.metrics[2]?.value || 0} still needing attention.`
                : "Open your document vault to review readiness and sharing visibility."}
            </div>
            <div style={{ color: textTokens.muted }}>
              {attachments?.guidance?.headline || "Keep your profile organized by keeping documents ready in one place."}
            </div>
            <Link to="/tenant/attachments">Open document vault</Link>
          </div>
        </TenantInfoCard>

        <TenantInfoCard heading="Communications" accent="#0f766e">
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ color: textTokens.secondary }}>
              <strong>{communicationsView.label}</strong> — {communicationsView.description}
            </div>
            {communicationsView.threadSummaries.length ? (
              <>
                <div style={{ color: textTokens.secondary }}>
                  Latest update: {communicationsView.threadSummaries[0].latestPreview}
                </div>
                <div style={{ color: textTokens.muted }}>
                  {communicationsView.threadSummaries[0].needsReply
                    ? "A landlord message appears to need your reply."
                    : "Your current tenancy conversation is visible from here."}
                </div>
              </>
            ) : (
              <div style={{ color: textTokens.muted }}>
                Your inbox will appear here once tenancy communication starts.
              </div>
            )}
            <Link to="/tenant/messages">Open communications inbox</Link>
          </div>
        </TenantInfoCard>

        {screenings.length ? (
          <TenantInfoCard heading="Screening Requests" accent="#1d4ed8">
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ color: textTokens.secondary }}>
                {screeningSummary.pendingConsentCount > 0
                  ? `Screening consent requested for ${screeningSummary.pendingConsentCount} application${screeningSummary.pendingConsentCount === 1 ? "" : "s"}.`
                  : `${screeningSummary.total} screening request${screeningSummary.total === 1 ? "" : "s"} currently visible in your tenant workspace.`}
              </div>
              <div style={{ color: textTokens.muted }}>
                {screeningSummary.pendingConsentCount > 0
                  ? "Review the request and record your authorization when you are ready."
                  : screeningSummary.latest?.description || "Review the latest screening workflow status for your applications."}
              </div>
              <Link to="/tenant/screening" style={{ fontWeight: 700 }}>
                {screeningSummary.pendingConsentCount > 0 ? "Review request" : "Open screening requests"}
              </Link>
            </div>
          </TenantInfoCard>
        ) : null}
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
