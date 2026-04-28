import React from "react";
import { Link } from "react-router-dom";
import {
  createTenantLeasePaymentCheckout,
  exportTenantIdentityPackage,
  getTenantLeasePaymentStatus,
  getTenantWorkspace,
} from "../../api/tenantPortal";
import { getTenantAccess, type TenantAccessWorkspace } from "../../api/tenantAccess";
import { getTenantAttachments } from "../../api/tenantAttachmentsApi";
import { getTenantProfile } from "../../api/tenantProfile";
import { getTenantApplicationCompletion } from "../../api/tenantApplicationCompletion";
import { getTenantNotificationPreferences } from "../../api/tenantNotificationPreferences";
import { getTenantCommunicationsWorkspace } from "../../api/tenantCommunicationsApi";
import { listTenantScreenings, type TenantScreeningRequest } from "../../api/tenantScreeningApi";
import {
  createTenantSharePackage,
  listTenantSharePackages,
  respondToTenantShareVerificationRequest,
  revokeTenantSharePackage,
  revokeTenantShareVerificationRequest,
  respondToTenantSharePackage,
  type TenantSharePackageLink,
} from "../../api/tenantSharePackages";
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

function prettyIdentityCompletionStatus(
  value: "complete" | "in_progress" | "missing" | "needs_attention" | null | undefined
) {
  switch (value) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In progress";
    case "needs_attention":
      return "Needs attention";
    case "missing":
    default:
      return "Missing";
  }
}

function prettyVerificationLevel(value: "none" | "partial" | "strong" | null | undefined) {
  switch (value) {
    case "strong":
      return "Strong";
    case "partial":
      return "Partial";
    case "none":
    default:
      return "None";
  }
}

function prettyScreeningIdentityStatus(
  value: "not_started" | "in_progress" | "completed" | "needs_attention" | "blocked" | null | undefined
) {
  switch (value) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "needs_attention":
      return "Needs attention";
    case "blocked":
      return "Blocked";
    case "not_started":
    default:
      return "Not started";
  }
}

function prettyShareRequestItem(
  value:
    | "identity_summary"
    | "credibility_summary"
    | "application_summary"
    | "documents_summary"
    | "lease_summary"
    | "payment_readiness_summary"
) {
  switch (value) {
    case "credibility_summary":
      return "Credibility summary";
    case "application_summary":
      return "Application summary";
    case "documents_summary":
      return "Documents summary";
    case "lease_summary":
      return "Lease summary";
    case "payment_readiness_summary":
      return "Payment readiness summary";
    case "identity_summary":
    default:
      return "Identity summary";
  }
}

function prettyRentPaymentStatus(
  value: "setup_required" | "checkout_created" | "payment_pending" | "paid" | "failed" | "canceled" | "expired" | null | undefined
) {
  switch (value) {
    case "checkout_created":
      return "Checkout created";
    case "payment_pending":
      return "Payment pending";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    case "expired":
      return "Expired";
    case "setup_required":
    default:
      return "Setup required";
  }
}

function formatPaymentExperienceStatus(value: "pending" | "paid" | "failed" | "canceled" | null | undefined) {
  switch (value) {
    case "pending":
      return "Pending";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return "No payment yet";
  }
}

export default function TenantWorkspacePage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantWorkspace>> | null>(null);
  const [institutionalPackage, setInstitutionalPackage] = React.useState<Awaited<ReturnType<typeof exportTenantIdentityPackage>> | null>(null);
  const [access, setAccess] = React.useState<TenantAccessWorkspace | null>(null);
  const [attachments, setAttachments] = React.useState<Awaited<ReturnType<typeof getTenantAttachments>> | null>(null);
  const [profileData, setProfileData] = React.useState<Awaited<ReturnType<typeof getTenantProfile>> | null>(null);
  const [completion, setCompletion] = React.useState<Awaited<ReturnType<typeof getTenantApplicationCompletion>> | null>(null);
  const [notificationPreferences, setNotificationPreferences] = React.useState<Awaited<ReturnType<typeof getTenantNotificationPreferences>> | null>(null);
  const [communications, setCommunications] = React.useState<Awaited<ReturnType<typeof getTenantCommunicationsWorkspace>> | null>(null);
  const [screenings, setScreenings] = React.useState<TenantScreeningRequest[]>([]);
  const [sharePackages, setSharePackages] = React.useState<TenantSharePackageLink[]>([]);
  const [freshShareUrl, setFreshShareUrl] = React.useState<string | null>(null);
  const [shareBusy, setShareBusy] = React.useState(false);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [exportBusy, setExportBusy] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [showExportPreview, setShowExportPreview] = React.useState(false);
  const [rentPaymentBusy, setRentPaymentBusy] = React.useState(false);
  const [rentPaymentError, setRentPaymentError] = React.useState<string | null>(null);
  const [rentPaymentDetails, setRentPaymentDetails] = React.useState<Awaited<
    ReturnType<typeof getTenantLeasePaymentStatus>
  > | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workspaceResult, accessResult, attachmentsResult, completionResult, preferencesResult, communicationsResult, screeningsResult, sharePackagesResult] = await Promise.allSettled([
        getTenantWorkspace(),
        getTenantAccess(),
        getTenantAttachments(),
        getTenantApplicationCompletion(),
        getTenantNotificationPreferences(),
        getTenantCommunicationsWorkspace(),
        listTenantScreenings(),
        listTenantSharePackages(),
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
      setSharePackages(sharePackagesResult.status === "fulfilled" ? sharePackagesResult.value : []);
    } catch (err: any) {
      setData(null);
      setAccess(null);
      setAttachments(null);
      setCompletion(null);
      setNotificationPreferences(null);
      setCommunications(null);
      setScreenings([]);
      setSharePackages([]);
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
    const leaseId = String(data?.lease?.leaseId || "").trim();
    if (!leaseId) {
      setRentPaymentDetails(null);
      return;
    }
    (async () => {
      try {
        const next = await getTenantLeasePaymentStatus(leaseId);
        if (!cancelled) setRentPaymentDetails(next);
      } catch {
        if (!cancelled) setRentPaymentDetails(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.lease?.leaseId]);

  async function handlePayRent() {
    if (!data?.lease?.leaseId) return;
    setRentPaymentBusy(true);
    setRentPaymentError(null);
    try {
      const result = await createTenantLeasePaymentCheckout(data.lease.leaseId);
      if (result?.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      setRentPaymentError("Unable to start rent payment checkout.");
    } catch (err: any) {
      setRentPaymentError(err?.payload?.detail || err?.payload?.error || err?.message || "Unable to start rent payment checkout.");
    } finally {
      setRentPaymentBusy(false);
    }
  }

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

  const handleGenerateShareLink = React.useCallback(async () => {
    try {
      setShareBusy(true);
      setShareError(null);
      const created = await createTenantSharePackage();
      setFreshShareUrl(created.shareUrl);
      const next = await listTenantSharePackages();
      setSharePackages(next);
    } catch (err: any) {
      setShareError(err?.payload?.error || err?.message || "Unable to create a share link right now.");
    } finally {
      setShareBusy(false);
    }
  }, []);

  const handleCopyShareLink = React.useCallback(async () => {
    if (!freshShareUrl) return;
    try {
      await navigator.clipboard.writeText(freshShareUrl);
    } catch {
      setShareError("Copy is unavailable in this browser right now.");
    }
  }, [freshShareUrl]);

  const handleExportRentalIdentity = React.useCallback(async () => {
    try {
      setExportBusy(true);
      setExportError(null);
      const next = await exportTenantIdentityPackage();
      setInstitutionalPackage(next);
      setShowExportPreview(true);
    } catch (err: any) {
      setExportError(err?.payload?.error || err?.message || "Unable to prepare this export right now.");
    } finally {
      setExportBusy(false);
    }
  }, []);

  const handleDownloadExportJson = React.useCallback(() => {
    if (!institutionalPackage) return;
    try {
      const blob = new Blob([JSON.stringify(institutionalPackage, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rentchain-institutional-identity-package.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("JSON download is unavailable in this browser right now.");
    }
  }, [institutionalPackage]);

  const handleRevokeShareLink = React.useCallback(async (id: string) => {
    try {
      setShareBusy(true);
      setShareError(null);
      await revokeTenantSharePackage(id);
      setSharePackages((current) => current.filter((entry) => entry.id !== id));
    } catch (err: any) {
      setShareError(err?.payload?.error || err?.message || "Unable to revoke this share link right now.");
    } finally {
      setShareBusy(false);
    }
  }, []);

  const handleRespondToShareRequest = React.useCallback(
    async (
      id: string,
      approvedItems: Array<
        | "identity_summary"
        | "credibility_summary"
        | "application_summary"
        | "documents_summary"
        | "lease_summary"
        | "payment_readiness_summary"
      >
    ) => {
      try {
        setShareBusy(true);
        setShareError(null);
        const updated = await respondToTenantSharePackage(id, approvedItems);
        setSharePackages((current) => current.map((entry) => (entry.id === id ? updated : entry)));
      } catch (err: any) {
        setShareError(err?.payload?.error || err?.message || "Unable to update this share request right now.");
      } finally {
        setShareBusy(false);
      }
    },
    []
  );

  const handleRespondToVerificationRequest = React.useCallback(
    async (
      sharePackageId: string,
      requestId: string,
      approvedScopes: Array<
        | "identity_summary"
        | "credibility_summary"
        | "application_summary"
        | "documents_summary"
        | "lease_summary"
        | "payment_readiness_summary"
      >
    ) => {
      try {
        setShareBusy(true);
        setShareError(null);
        const updated = await respondToTenantShareVerificationRequest(sharePackageId, requestId, approvedScopes);
        setSharePackages((current) => current.map((entry) => (entry.id === sharePackageId ? updated : entry)));
      } catch (err: any) {
        setShareError(err?.payload?.error || err?.message || "Unable to update this verification request right now.");
      } finally {
        setShareBusy(false);
      }
    },
    []
  );

  const handleRevokeVerificationRequest = React.useCallback(async (sharePackageId: string, requestId: string) => {
    try {
      setShareBusy(true);
      setShareError(null);
      const updated = await revokeTenantShareVerificationRequest(sharePackageId, requestId);
      setSharePackages((current) => current.map((entry) => (entry.id === sharePackageId ? updated : entry)));
    } catch (err: any) {
      setShareError(err?.payload?.error || err?.message || "Unable to revoke this verification request right now.");
    } finally {
      setShareBusy(false);
    }
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
  const tenantIdentityRecord = data?.tenantIdentityRecord || null;
  const tenantCredibilitySignals = data?.tenantCredibilitySignals || null;
  const portableIdentity = data?.portableIdentity || null;
  const identityTimeline = data?.identityTimeline?.events || [];
  const communicationsView = buildTenantCommunicationsWorkspaceState(communications);
  const screeningSummary = buildTenantScreeningDashboardSummary(screenings);
  const identityExchangeReference = sharePackages[0]?.identityExchangeReference || null;
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

      <TenantInfoCard heading="Payment readiness" accent="#1d4ed8">
        {data?.lease?.paymentReadiness ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: "1.02rem", fontWeight: 800, color: textTokens.primary }}>
                {data.lease.paymentReadiness.readinessLabel}
              </div>
              <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                {data.lease.paymentReadiness.readinessDescription}
              </div>
            </div>

            <TenantKeyValueGrid
              rows={[
                {
                  label: "Rent amount",
                  value: data.lease.paymentReadiness.rentTerms.rentAmountAvailable ? "Available" : "Needed",
                },
                {
                  label: "Due day",
                  value: data.lease.paymentReadiness.rentTerms.dueDateAvailable ? "Available" : "Needed",
                },
                {
                  label: "Lease dates",
                  value: data.lease.paymentReadiness.rentTerms.leaseDatesAvailable ? "Available" : "Needed",
                },
                {
                  label: "Tenant linked",
                  value: data.lease.paymentReadiness.rentTerms.tenantLinked ? "Linked" : "Needs review",
                },
                {
                  label: "Lease executed",
                  value: data.lease.paymentReadiness.rentTerms.leaseExecuted ? "Complete" : "In progress",
                },
              ]}
            />

            <div style={{ color: textTokens.secondary }}>
              Next step:{" "}
              <strong>
                {data.lease.paymentReadiness.requiredNextAction === "complete_lease_details"
                  ? "Complete lease details"
                  : data.lease.paymentReadiness.requiredNextAction === "review_rent_terms"
                  ? "Review rent terms"
                  : data.lease.paymentReadiness.requiredNextAction === "confirm_payment_setup_later"
                  ? "Confirm payment setup later"
                  : "No immediate follow-up"}
              </strong>
            </div>

            {(rentPaymentDetails || data.lease.rentPaymentSummary) ? (
              <div
                style={{
                  display: "grid",
                  gap: spacing.xs,
                  padding: spacing.sm,
                  border: "1px solid rgba(148,163,184,0.35)",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontWeight: 700, color: textTokens.primary }}>Rent payment checkout</div>
                <div style={{ color: textTokens.secondary }}>
                  Payment processed by Stripe. RentChain does not store card or bank payment details.
                </div>
                <TenantKeyValueGrid
                  rows={[
                    {
                      label: "Rent collection",
                      value: (rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentRail.enabled
                        ? "Enabled"
                        : "Not enabled",
                    },
                    {
                      label: "Latest status",
                      value: formatPaymentExperienceStatus(
                        (rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.latestStatus || null
                      ),
                    },
                  ]}
                />
                {((rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.history || []).length ? (
                  <div style={{ display: "grid", gap: spacing.xs }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Payment history</div>
                    {((rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.history || [])
                      .slice(0, 3)
                      .map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: spacing.sm,
                            color: textTokens.secondary,
                            fontSize: "0.92rem",
                          }}
                        >
                          <span>{prettyRentPaymentStatus(entry.status)}</span>
                          <span>{formatDate(entry.paidAt || entry.updatedAt || entry.createdAt)}</span>
                          <span>{formatMoney(entry.amountCents / 100)}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={{ color: textTokens.secondary }}>No payment history yet.</div>
                )}
                {(rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.receiptSummary?.available ? (
                  <div style={{ display: "grid", gap: spacing.xs }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>
                      {(rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.receiptSummary.label}
                    </div>
                    <div style={{ color: textTokens.secondary }}>
                      Lease {(rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.receiptSummary
                        .leaseReference || "reference"} ·{" "}
                      {formatMoney(
                        ((rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.receiptSummary
                          ?.amountCents || 0) / 100
                      )}{" "}
                      ·{" "}
                      {formatDate(
                        (rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.receiptSummary?.paidAt
                      )}
                    </div>
                    <div>
                      <button type="button" onClick={() => window.print()}>
                        Print / Save payment summary
                      </button>
                    </div>
                  </div>
                ) : null}
                {(rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentRail.enabled &&
                data.lease.paymentReadiness.readinessStatus === "ready_to_configure" &&
                (rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.latestStatus !== "pending" &&
                (rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.latestStatus !== "paid" ? (
                  <div style={{ display: "grid", gap: spacing.xs }}>
                    <button type="button" onClick={() => void handlePayRent()} disabled={rentPaymentBusy}>
                      {rentPaymentBusy
                        ? "Opening checkout..."
                        : (rentPaymentDetails || data.lease.rentPaymentSummary)?.paymentExperience?.retryAvailable
                        ? "Retry payment"
                        : "Pay rent"}
                    </button>
                    {rentPaymentError ? <div style={{ color: "#b91c1c" }}>{rentPaymentError}</div> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ color: textTokens.secondary }}>
            Payment readiness will appear here when your current lease exposes enough rent-term detail for future setup planning.
          </div>
        )}
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

      <TenantInfoCard heading="Your Rental Identity" accent="#0f766e">
        {tenantIdentityRecord ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: textTokens.primary }}>
                {tenantIdentityRecord.readinessLabel}
              </div>
              <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                {tenantIdentityRecord.readinessDescription}
              </div>
            </div>

            <TenantKeyValueGrid
              rows={[
                { label: "Identity status", value: prettyStatus(tenantIdentityRecord.identityStatus) },
                { label: "Verification level", value: prettyVerificationLevel(tenantIdentityRecord.verification.level) },
                { label: "Profile", value: prettyIdentityCompletionStatus(tenantIdentityRecord.profile.completionStatus) },
                { label: "Application reuse", value: tenantIdentityRecord.application.reusable ? "Ready" : "Still building" },
                { label: "Documents", value: prettyIdentityCompletionStatus(tenantIdentityRecord.documents.completionStatus) },
                { label: "Screening", value: prettyScreeningIdentityStatus(tenantIdentityRecord.screening.status) },
                {
                  label: "Lease history",
                  value:
                    tenantIdentityRecord.leases.activeCount > 0 || tenantIdentityRecord.leases.historicalCount > 0
                      ? `${tenantIdentityRecord.leases.activeCount} active / ${tenantIdentityRecord.leases.historicalCount} historical`
                      : "No lease history yet",
                },
              ]}
            />

            {tenantIdentityRecord.documents.missingCategories.length ? (
              <div
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700, color: textTokens.primary }}>Missing pieces</div>
                <div style={{ color: textTokens.secondary }}>
                  {tenantIdentityRecord.documents.missingCategories.join(", ")}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ color: textTokens.secondary }}>
            Your rental identity summary will appear here once enough tenant-safe records are available.
          </div>
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Credibility signals" accent="#0f766e">
        {tenantCredibilitySignals ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: "1.02rem", fontWeight: 800, color: textTokens.primary }}>
                {tenantCredibilitySignals.summary.summaryLabel}
              </div>
              <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                {tenantCredibilitySignals.summary.summaryDescription}
              </div>
            </div>

            <TenantKeyValueGrid
              rows={tenantCredibilitySignals.signals.map((signal) => ({
                label: signal.label,
                value:
                  signal.status === "verified"
                    ? "Verified"
                    : signal.status === "available"
                    ? "Available"
                    : signal.status === "incomplete"
                    ? "Incomplete"
                    : "Not available",
              }))}
            />
          </div>
        ) : (
          <div style={{ color: textTokens.secondary }}>
            Credibility signals will appear here once enough tenant-safe identity signals are available.
          </div>
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Portable Rental Identity" accent="#1d4ed8">
        {portableIdentity ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: "1.02rem", fontWeight: 800, color: textTokens.primary }}>
                {portableIdentity.portabilityLabel}
              </div>
              <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                {portableIdentity.portabilityDescription}
              </div>
            </div>

            <TenantKeyValueGrid
              rows={[
                {
                  label: "Identity ready",
                  value: portableIdentity.readiness.identityReady ? "Ready" : "Needs attention",
                },
                {
                  label: "Application reusable",
                  value: portableIdentity.readiness.applicationReusable ? "Ready" : "Still building",
                },
                {
                  label: "Credibility ready",
                  value: portableIdentity.readiness.credibilityReady ? "Ready" : "Still building",
                },
                {
                  label: "Sharing controls available",
                  value: portableIdentity.readiness.sharingEnabled ? "Available" : "Not available",
                },
                {
                  label: "Reusable across applications",
                  value: portableIdentity.reusableAcrossApplications ? "Yes" : "Not yet",
                },
              ]}
            />

            <div style={{ color: textTokens.secondary }}>
              Next step:{" "}
              <strong>
                {portableIdentity.nextAction === "complete_identity"
                  ? "Complete identity details"
                  : portableIdentity.nextAction === "enable_sharing"
                  ? "Review sharing controls"
                  : portableIdentity.nextAction === "review_reusability"
                  ? "Review reusability details"
                  : "No immediate follow-up"}
              </strong>
            </div>
          </div>
        ) : (
          <div style={{ color: textTokens.secondary }}>
            Portable identity status will appear here once enough tenant-safe identity signals are available.
          </div>
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Institutional readiness" accent="#0f766e">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
            Prepare a tenant-controlled export of your rental identity as a structured summary for offline record sharing or future institutional review. This does not send data anywhere or create an external integration.
          </div>

          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void handleExportRentalIdentity()} disabled={exportBusy}>
              {exportBusy ? "Preparing export..." : "Export Rental Identity"}
            </button>
            {institutionalPackage ? (
              <>
                <button type="button" onClick={handleDownloadExportJson}>
                  Download JSON
                </button>
                <button type="button" className="no-print" onClick={() => window.print()}>
                  Print / Save PDF
                </button>
              </>
            ) : null}
          </div>

          {exportError ? <div style={{ color: "#b91c1c" }}>{exportError}</div> : null}

          {institutionalPackage ? (
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowExportPreview((current) => !current)}
                style={{ justifySelf: "start" }}
              >
                {showExportPreview ? "Hide preview" : "Show preview"}
              </button>

              {showExportPreview ? (
                <div
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>Export preview</div>
                  <TenantKeyValueGrid
                    rows={[
                      { label: "Identity status", value: prettyStatus(institutionalPackage.identitySummary.identityStatus) },
                      { label: "Verification level", value: prettyVerificationLevel(institutionalPackage.identitySummary.verificationLevel) },
                      { label: "Completeness", value: prettyStatus(institutionalPackage.identitySummary.completenessLevel) },
                      { label: "Credibility", value: institutionalPackage.credibilitySummary.summaryLabel },
                      { label: "Active lease", value: institutionalPackage.leaseSummary.activeLease ? "Yes" : "No" },
                      { label: "Lease execution", value: prettyStatus(institutionalPackage.leaseSummary.leaseExecutionStatus) },
                      { label: "Payment readiness", value: institutionalPackage.paymentReadinessSummary.readinessLabel },
                      { label: "Audit events", value: String(institutionalPackage.auditSummary.totalEvents) },
                      { label: "Consent required", value: institutionalPackage.metadata.consentRequired ? "Yes" : "No" },
                    ]}
                  />

                  <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                    {institutionalPackage.credibilitySummary.summaryDescription}
                  </div>

                  {institutionalPackage.auditSummary.recentActivity.length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 700, color: textTokens.primary }}>Recent activity</div>
                      {institutionalPackage.auditSummary.recentActivity.map((event) => (
                        <div key={`${event.type}:${event.occurredAt}`} style={{ color: textTokens.secondary }}>
                          {event.label} • {formatDate(event.occurredAt)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </TenantInfoCard>

      <TenantInfoCard heading="Activity timeline" accent="#0891b2">
        {identityTimeline.length ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {identityTimeline.map((event) => (
              <div
                key={`${event.type}:${event.occurredAt}`}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>{event.label}</div>
                  <div style={{ color: textTokens.secondary }}>{formatDate(event.occurredAt)}</div>
                </div>
                <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>{event.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: textTokens.secondary }}>
            Identity-related activity will appear here as your application, screening, and lease workflow progress.
          </div>
        )}
      </TenantInfoCard>

      <TenantInfoCard heading="Manage Shared Access" accent="#1d4ed8">
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
            Generate a privacy-safe share link, review any additional access requests, and approve only the extra summaries you want to share. Public access stays read-only and never exposes raw documents, screening provider details, or signature data.
          </div>

          {identityExchangeReference ? (
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 700, color: textTokens.primary }}>Identity exchange</div>
              <div style={{ color: textTokens.primary }}>{identityExchangeReference.referenceLabel}</div>
              <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                {identityExchangeReference.referenceDescription}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void handleGenerateShareLink()} disabled={shareBusy}>
              {shareBusy ? "Generating..." : "Generate share link"}
            </button>
            {freshShareUrl ? (
              <button type="button" onClick={() => void handleCopyShareLink()}>
                Copy latest link
              </button>
            ) : null}
          </div>

          {freshShareUrl ? (
            <div style={{ color: textTokens.secondary }} data-testid="fresh-share-url">
              Latest link: {freshShareUrl}
            </div>
          ) : null}

          {shareError ? (
            <div style={{ color: "#b91c1c" }}>{shareError}</div>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Active share links</div>
            {sharePackages.length ? (
              sharePackages.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ color: textTokens.secondary }}>
                    Created {formatDate(entry.createdAt)} • Expires {formatDate(entry.expiresAt)}
                  </div>
                  <div style={{ color: textTokens.secondary }}>
                    Approved:{" "}
                    {entry.approvedItems.length
                      ? entry.approvedItems.map((item) => prettyShareRequestItem(item)).join(", ")
                      : "Identity summary only"}
                  </div>
                  {entry.verificationRequests.some((request) => request.status === "approved") ? (
                    <div style={{ color: textTokens.secondary }}>
                      Verification approvals:{" "}
                      {entry.verificationRequests
                        .filter((request) => request.status === "approved")
                        .flatMap((request) => request.requestedScopes)
                        .map((item) => prettyShareRequestItem(item))
                        .join(", ")}
                    </div>
                  ) : null}
                  {entry.requestedItems.length ? (
                    <div
                      style={{
                        border: "1px solid rgba(15,23,42,0.08)",
                        borderRadius: 12,
                        padding: "10px 12px",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: textTokens.primary }}>Pending request</div>
                      <div style={{ color: textTokens.secondary }}>
                        {entry.requestedItems.map((item) => prettyShareRequestItem(item)).join(", ")}
                      </div>
                      <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => void handleRespondToShareRequest(entry.id, entry.requestedItems)}
                          disabled={shareBusy}
                        >
                          Approve requested access
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRespondToShareRequest(entry.id, [])}
                          disabled={shareBusy}
                        >
                          Deny request
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {entry.verificationRequests
                    .filter((request) => request.status === "requested")
                    .map((request) => (
                      <div
                        key={request.requestId}
                        style={{
                          border: "1px solid rgba(15,23,42,0.08)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: textTokens.primary }}>Verification request</div>
                        <div style={{ color: textTokens.secondary }}>
                          {request.requestedScopes.map((item) => prettyShareRequestItem(item)).join(", ")}
                        </div>
                        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() =>
                              void handleRespondToVerificationRequest(entry.id, request.requestId, request.requestedScopes)
                            }
                            disabled={shareBusy}
                          >
                            Approve request
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRespondToVerificationRequest(entry.id, request.requestId, [])}
                            disabled={shareBusy}
                          >
                            Decline request
                          </button>
                        </div>
                      </div>
                    ))}
                  {entry.verificationRequests
                    .filter((request) => request.status === "approved")
                    .map((request) => (
                      <div
                        key={`${request.requestId}-approved`}
                        style={{
                          border: "1px solid rgba(15,23,42,0.08)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: textTokens.primary }}>Approved verification request</div>
                        <div style={{ color: textTokens.secondary }}>
                          {request.requestedScopes.map((item) => prettyShareRequestItem(item)).join(", ")}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => void handleRevokeVerificationRequest(entry.id, request.requestId)}
                            disabled={shareBusy}
                          >
                            Revoke request
                          </button>
                        </div>
                      </div>
                    ))}
                  <div>
                    <button type="button" onClick={() => void handleRevokeShareLink(entry.id)} disabled={shareBusy}>
                      Revoke link
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No active share links yet.
              </div>
            )}
          </div>
        </div>
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
