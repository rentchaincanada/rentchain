import React from "react";
import { Link } from "react-router-dom";
import { getTenantWorkspace } from "../../api/tenantPortal";
import { getTenantAccess, type TenantAccessWorkspace } from "../../api/tenantAccess";
import { getTenantAttachments } from "../../api/tenantAttachmentsApi";
import { getTenantProfile } from "../../api/tenantProfile";
import { getTenantApplicationCompletion } from "../../api/tenantApplicationCompletion";
import { getTenantNotificationPreferences } from "../../api/tenantNotificationPreferences";
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
import StructuredNotificationList from "../StructuredNotificationList";
import { buildTenantStructuredNotificationTriggers } from "../structuredNotificationTriggers";
import { filterStructuredNotificationsByPreferences } from "../notificationChannelRouting";

export default function TenantWorkspacePage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantWorkspace>> | null>(null);
  const [access, setAccess] = React.useState<TenantAccessWorkspace | null>(null);
  const [attachments, setAttachments] = React.useState<Awaited<ReturnType<typeof getTenantAttachments>> | null>(null);
  const [profileData, setProfileData] = React.useState<Awaited<ReturnType<typeof getTenantProfile>> | null>(null);
  const [completion, setCompletion] = React.useState<Awaited<ReturnType<typeof getTenantApplicationCompletion>> | null>(null);
  const [notificationPreferences, setNotificationPreferences] = React.useState<Awaited<ReturnType<typeof getTenantNotificationPreferences>> | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workspaceResult, accessResult, attachmentsResult, completionResult, preferencesResult] = await Promise.allSettled([
        getTenantWorkspace(),
        getTenantAccess(),
        getTenantAttachments(),
        getTenantApplicationCompletion(),
        getTenantNotificationPreferences(),
      ]);

      if (workspaceResult.status === "rejected") {
        throw workspaceResult.reason;
      }

      setData(workspaceResult.value);
      setAccess(accessResult.status === "fulfilled" ? accessResult.value : null);
      setAttachments(attachmentsResult.status === "fulfilled" ? attachmentsResult.value : null);
      setCompletion(completionResult.status === "fulfilled" ? completionResult.value : null);
      setNotificationPreferences(preferencesResult.status === "fulfilled" ? preferencesResult.value : null);
    } catch (err: any) {
      setData(null);
      setAccess(null);
      setAttachments(null);
      setCompletion(null);
      setNotificationPreferences(null);
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
