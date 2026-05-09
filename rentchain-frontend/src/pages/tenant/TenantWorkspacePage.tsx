import React from "react";
import { Link } from "react-router-dom";
import {
  createInstitutionalHandoffDraft,
  createTenantLeasePaymentCheckout,
  exportTenantIdentityPackage,
  getTenantLeasePaymentStatus,
  getTenantWorkspace,
  listInstitutionalHandoffDrafts,
  type InstitutionalHandoffSummary,
  type InstitutionalExportV2,
  voidInstitutionalHandoffDraft,
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
  listTenantTrustExports,
  prepareTenantTrustExport,
  previewTenantTrustExport,
  revokeTenantTrustExport,
  type TenantTrustExportAudience,
  type TenantTrustExportPreview,
  type TenantTrustExportRecord,
} from "../../api/tenantTrustExports";
import {
  createTenantInstitutionAccessGrant,
  listTenantInstitutionAccessGrants,
  previewTenantInstitutionAccess,
  revokeTenantInstitutionAccessGrant,
  type TenantInstitutionAccessAudience,
  type TenantInstitutionAccessGrant,
  type TenantInstitutionAccessPreview,
} from "../../api/tenantInstitutionAccess";
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
import {
  describeRentPaymentGuidance,
  formatPaymentExperienceStatus,
  mapRentPaymentCheckoutErrorMessage,
  prettyRentPaymentStatus,
} from "../../lib/payments/paymentStatusGuidance";
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

function prettyInstitutionalSchemaStatus(value: "valid" | "valid_with_warnings" | "invalid" | null | undefined) {
  switch (value) {
    case "valid_with_warnings":
      return "Valid with warnings";
    case "invalid":
      return "Invalid";
    case "valid":
    default:
      return "Valid";
  }
}

function prettyComplianceReadinessStatus(value: "not_ready" | "partial" | "ready" | null | undefined) {
  switch (value) {
    case "ready":
      return "Ready";
    case "partial":
      return "Partial";
    case "not_ready":
    default:
      return "Not ready";
  }
}

function prettyComplianceCheckStatus(value: "pass" | "warning" | "missing" | null | undefined) {
  switch (value) {
    case "pass":
      return "Pass";
    case "warning":
      return "Warning";
    case "missing":
    default:
      return "Missing";
  }
}

function trustExportPurposeForAudience(audience: TenantTrustExportAudience) {
  if (audience === "insurer") return "insurance_review" as const;
  if (audience === "lender") return "lender_review" as const;
  if (audience === "institutional_landlord") return "institutional_landlord_review" as const;
  if (audience === "auditor") return "auditor_review" as const;
  return "tenant_controlled_portability" as const;
}

function prettyTrustExportAudience(value: TenantTrustExportAudience | null | undefined) {
  switch (value) {
    case "insurer":
      return "Insurer review";
    case "lender":
      return "Lender review";
    case "institutional_landlord":
      return "Institutional landlord review";
    case "auditor":
      return "Auditor review";
    case "tenant_portability":
    default:
      return "Tenant portability";
  }
}

function prettyTrustExportLifecycle(value: string | null | undefined) {
  switch (value) {
    case "prepared":
      return "Prepared";
    case "revoked":
      return "Revoked";
    case "expired":
      return "Expired";
    case "blocked":
      return "Blocked";
    case "consent_required":
      return "Consent required";
    case "preview":
    default:
      return "Preview";
  }
}

function institutionAccessPurposeForAudience(audience: TenantInstitutionAccessAudience) {
  if (audience === "lender") return "lender_review" as const;
  if (audience === "institutional_landlord") return "institutional_landlord_review" as const;
  if (audience === "auditor") return "auditor_review" as const;
  return "insurance_review" as const;
}

function prettyInstitutionAccessAudience(value: TenantInstitutionAccessAudience | null | undefined) {
  switch (value) {
    case "lender":
      return "Lender review";
    case "institutional_landlord":
      return "Institutional landlord review";
    case "auditor":
      return "Auditor review";
    case "insurer":
    default:
      return "Insurer review";
  }
}

function prettyPolicyReason(value: string) {
  return value.replace(/_/g, " ");
}

function prettyInstitutionType(
  value: "bank" | "lender" | "insurer" | "regulator" | "internal_review" | null | undefined
) {
  switch (value) {
    case "bank":
      return "Bank";
    case "lender":
      return "Lender";
    case "insurer":
      return "Insurer";
    case "regulator":
      return "Regulator";
    case "internal_review":
    default:
      return "Internal review";
  }
}

function prettyHandoffStatus(
  value:
    | "draft"
    | "ready_for_manual_review"
    | "ready_for_tenant_managed_release"
    | "blocked"
    | "voided"
    | null
    | undefined
) {
  switch (value) {
    case "ready_for_tenant_managed_release":
      return "Ready for tenant-managed release";
    case "ready_for_manual_review":
      return "Ready for manual review";
    case "blocked":
      return "Blocked";
    case "voided":
      return "Voided";
    case "draft":
    default:
      return "Draft";
  }
}

function institutionalHandoffStatusDescription(
  value:
    | "draft"
    | "ready_for_manual_review"
    | "ready_for_tenant_managed_release"
    | "blocked"
    | "voided"
    | null
    | undefined
) {
  switch (value) {
    case "ready_for_tenant_managed_release":
      return "This draft is ready for tenant-managed manual release. You may manually share a downloaded export outside RentChain when you choose.";
    case "ready_for_manual_review":
      return "This draft is ready for manual review before any tenant-managed sharing decision.";
    case "blocked":
      return "This draft still needs more readiness details before manual review can proceed.";
    case "voided":
      return "This draft has been voided and is no longer part of your current manual-release preparation.";
    case "draft":
    default:
      return "This draft is still being prepared for manual review.";
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

function describeShareLinkReusePath(entry: TenantSharePackageLink): string {
  const identitySummaryApproved = entry.approvedItems.includes("identity_summary");
  const applicationSummaryApproved = entry.approvedItems.includes("application_summary");
  const referenceStatus = entry.identityExchangeReference?.referenceStatus || "not_ready";

  if (identitySummaryApproved && applicationSummaryApproved) {
    return "Apply with RentChain is available with your approved identity and reusable application details.";
  }

  if (identitySummaryApproved) {
    return "This link currently shares identity summary only. Additional approval is still required before reusable application details can be used.";
  }

  if (referenceStatus === "available" || referenceStatus === "limited") {
    return "This link can support summary-only follow-through today. Broader reuse still requires your approval.";
  }

  return "This link does not yet support a reusable RentChain application path.";
}

export default function TenantWorkspacePage() {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getTenantWorkspace>> | null>(null);
  const [institutionalPackage, setInstitutionalPackage] = React.useState<InstitutionalExportV2 | null>(null);
  const [access, setAccess] = React.useState<TenantAccessWorkspace | null>(null);
  const [attachments, setAttachments] = React.useState<Awaited<ReturnType<typeof getTenantAttachments>> | null>(null);
  const [profileData, setProfileData] = React.useState<Awaited<ReturnType<typeof getTenantProfile>> | null>(null);
  const [completion, setCompletion] = React.useState<Awaited<ReturnType<typeof getTenantApplicationCompletion>> | null>(null);
  const [notificationPreferences, setNotificationPreferences] = React.useState<Awaited<ReturnType<typeof getTenantNotificationPreferences>> | null>(null);
  const [communications, setCommunications] = React.useState<Awaited<ReturnType<typeof getTenantCommunicationsWorkspace>> | null>(null);
  const [screenings, setScreenings] = React.useState<TenantScreeningRequest[]>([]);
  const [sharePackages, setSharePackages] = React.useState<TenantSharePackageLink[]>([]);
  const [trustExports, setTrustExports] = React.useState<TenantTrustExportRecord[]>([]);
  const [trustExportPreview, setTrustExportPreview] = React.useState<TenantTrustExportPreview | null>(null);
  const [trustExportAudience, setTrustExportAudience] = React.useState<TenantTrustExportAudience>("tenant_portability");
  const [trustExportConsentAccepted, setTrustExportConsentAccepted] = React.useState(false);
  const [trustExportBusy, setTrustExportBusy] = React.useState(false);
  const [trustExportError, setTrustExportError] = React.useState<string | null>(null);
  const [institutionAccessGrants, setInstitutionAccessGrants] = React.useState<TenantInstitutionAccessGrant[]>([]);
  const [institutionAccessPreview, setInstitutionAccessPreview] = React.useState<TenantInstitutionAccessPreview | null>(null);
  const [institutionAccessAudience, setInstitutionAccessAudience] = React.useState<TenantInstitutionAccessAudience>("insurer");
  const [institutionAccessRecipientEmail, setInstitutionAccessRecipientEmail] = React.useState("");
  const [institutionAccessOrganization, setInstitutionAccessOrganization] = React.useState("");
  const [institutionAccessConsentAccepted, setInstitutionAccessConsentAccepted] = React.useState(false);
  const [institutionAccessBusy, setInstitutionAccessBusy] = React.useState(false);
  const [institutionAccessError, setInstitutionAccessError] = React.useState<string | null>(null);
  const [freshShareUrl, setFreshShareUrl] = React.useState<string | null>(null);
  const [shareBusy, setShareBusy] = React.useState(false);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [exportBusy, setExportBusy] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [showExportPreview, setShowExportPreview] = React.useState(false);
  const [handoffDrafts, setHandoffDrafts] = React.useState<InstitutionalHandoffSummary[]>([]);
  const [handoffBusy, setHandoffBusy] = React.useState(false);
  const [handoffError, setHandoffError] = React.useState<string | null>(null);
  const [handoffInstitutionType, setHandoffInstitutionType] = React.useState<
    "bank" | "lender" | "insurer" | "regulator" | "internal_review"
  >("internal_review");
  const [handoffDisplayName, setHandoffDisplayName] = React.useState("");
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
      const [
        workspaceResult,
        accessResult,
        attachmentsResult,
        completionResult,
        preferencesResult,
        communicationsResult,
        screeningsResult,
        sharePackagesResult,
        trustExportsResult,
        institutionAccessGrantsResult,
        handoffDraftsResult,
      ] = await Promise.allSettled([
        getTenantWorkspace(),
        getTenantAccess(),
        getTenantAttachments(),
        getTenantApplicationCompletion(),
        getTenantNotificationPreferences(),
        getTenantCommunicationsWorkspace(),
        listTenantScreenings(),
        listTenantSharePackages(),
        listTenantTrustExports(),
        listTenantInstitutionAccessGrants(),
        listInstitutionalHandoffDrafts(),
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
      setTrustExports(trustExportsResult.status === "fulfilled" ? trustExportsResult.value : []);
      setInstitutionAccessGrants(
        institutionAccessGrantsResult.status === "fulfilled" ? institutionAccessGrantsResult.value : []
      );
      setHandoffDrafts(handoffDraftsResult.status === "fulfilled" ? handoffDraftsResult.value : []);
    } catch (err: any) {
      setData(null);
      setAccess(null);
      setAttachments(null);
      setCompletion(null);
      setNotificationPreferences(null);
      setCommunications(null);
      setScreenings([]);
      setSharePackages([]);
      setTrustExports([]);
      setInstitutionAccessGrants([]);
      setHandoffDrafts([]);
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
      setRentPaymentError(mapRentPaymentCheckoutErrorMessage(err?.payload?.detail || err?.payload?.error || err?.message));
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
      const next = await exportTenantIdentityPackage("2.0");
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
      link.download = "rentchain-institutional-identity-package-v2.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("JSON download is unavailable in this browser right now.");
    }
  }, [institutionalPackage]);

  const handlePreviewTrustExport = React.useCallback(async () => {
    try {
      setTrustExportBusy(true);
      setTrustExportError(null);
      const next = await previewTenantTrustExport({
        audience: trustExportAudience,
        purpose: trustExportPurposeForAudience(trustExportAudience),
        expiresInDays: 14,
        consentAccepted: trustExportConsentAccepted,
      });
      setTrustExportPreview(next);
    } catch (err: any) {
      setTrustExportError(err?.payload?.error || err?.message || "Unable to preview this trust export right now.");
    } finally {
      setTrustExportBusy(false);
    }
  }, [trustExportAudience, trustExportConsentAccepted]);

  const handlePrepareTrustExport = React.useCallback(async () => {
    try {
      setTrustExportBusy(true);
      setTrustExportError(null);
      const prepared = await prepareTenantTrustExport({
        audience: trustExportAudience,
        purpose: trustExportPurposeForAudience(trustExportAudience),
        expiresInDays: 14,
        consentAccepted: trustExportConsentAccepted,
      });
      setTrustExportPreview(prepared);
      setTrustExports((current) => [prepared, ...current.filter((entry) => entry.exportId !== prepared.exportId)]);
    } catch (err: any) {
      setTrustExportError(
        err?.payload?.error === "TENANT_TRUST_EXPORT_CONSENT_REQUIRED"
          ? "Confirm consent before preparing a trust export."
          : err?.payload?.error || err?.message || "Unable to prepare this trust export right now."
      );
    } finally {
      setTrustExportBusy(false);
    }
  }, [trustExportAudience, trustExportConsentAccepted]);

  const handleRevokeTrustExport = React.useCallback(async (exportId: string) => {
    try {
      setTrustExportBusy(true);
      setTrustExportError(null);
      const revoked = await revokeTenantTrustExport(exportId);
      setTrustExports((current) => current.map((entry) => (entry.exportId === exportId ? revoked : entry)));
      setTrustExportPreview((current) => (current?.exportId === exportId ? revoked : current));
    } catch (err: any) {
      setTrustExportError(err?.payload?.error || err?.message || "Unable to revoke this trust export right now.");
    } finally {
      setTrustExportBusy(false);
    }
  }, []);

  const handleDownloadTrustExportJson = React.useCallback((record: TenantTrustExportPreview | TenantTrustExportRecord) => {
    try {
      const blob = new Blob([JSON.stringify(record, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rentchain-tenant-controlled-trust-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setTrustExportError("Trust export JSON download is unavailable in this browser right now.");
    }
  }, []);

  const institutionAccessRequest = React.useCallback(
    (consentAccepted: boolean) => ({
      audience: institutionAccessAudience,
      purpose: institutionAccessPurposeForAudience(institutionAccessAudience),
      recipient: {
        email: institutionAccessRecipientEmail,
        organizationName: institutionAccessOrganization,
      },
      expiresInDays: 14,
      consentAccepted,
    }),
    [institutionAccessAudience, institutionAccessOrganization, institutionAccessRecipientEmail],
  );

  const handlePreviewInstitutionAccess = React.useCallback(async () => {
    try {
      setInstitutionAccessBusy(true);
      setInstitutionAccessError(null);
      const next = await previewTenantInstitutionAccess(institutionAccessRequest(institutionAccessConsentAccepted));
      setInstitutionAccessPreview(next);
    } catch (err: any) {
      setInstitutionAccessError(
        err?.payload?.error === "TENANT_INSTITUTION_ACCESS_RECIPIENT_REQUIRED"
          ? "Enter a recipient email before previewing institution access."
          : err?.payload?.error || err?.message || "Unable to preview institution access right now."
      );
    } finally {
      setInstitutionAccessBusy(false);
    }
  }, [institutionAccessConsentAccepted, institutionAccessRequest]);

  const handleCreateInstitutionAccessGrant = React.useCallback(async () => {
    try {
      setInstitutionAccessBusy(true);
      setInstitutionAccessError(null);
      const created = await createTenantInstitutionAccessGrant(institutionAccessRequest(institutionAccessConsentAccepted));
      setInstitutionAccessPreview(created);
      setInstitutionAccessGrants((current) => [created, ...current.filter((entry) => entry.grantId !== created.grantId)]);
    } catch (err: any) {
      setInstitutionAccessError(
        err?.payload?.error === "TENANT_INSTITUTION_ACCESS_CONSENT_REQUIRED"
          ? "Confirm consent before creating institution access."
          : err?.payload?.error === "TENANT_INSTITUTION_ACCESS_RECIPIENT_REQUIRED"
          ? "Enter a recipient email before creating institution access."
          : err?.payload?.error || err?.message || "Unable to create institution access right now."
      );
    } finally {
      setInstitutionAccessBusy(false);
    }
  }, [institutionAccessConsentAccepted, institutionAccessRequest]);

  const handleRevokeInstitutionAccessGrant = React.useCallback(async (grantId: string) => {
    try {
      setInstitutionAccessBusy(true);
      setInstitutionAccessError(null);
      const revoked = await revokeTenantInstitutionAccessGrant(grantId);
      setInstitutionAccessGrants((current) => current.map((entry) => (entry.grantId === grantId ? revoked : entry)));
      setInstitutionAccessPreview((current) => (current?.grantId === grantId ? revoked : current));
    } catch (err: any) {
      setInstitutionAccessError(err?.payload?.error || err?.message || "Unable to revoke institution access right now.");
    } finally {
      setInstitutionAccessBusy(false);
    }
  }, []);

  const handleCreateInstitutionalHandoff = React.useCallback(async () => {
    try {
      setHandoffBusy(true);
      setHandoffError(null);
      const created = await createInstitutionalHandoffDraft({
        institutionProfile: {
          institutionType: handoffInstitutionType,
          displayName: handoffDisplayName,
          integrationMode: "sandbox",
        },
      });
      setHandoffDrafts((current) => [created, ...current.filter((entry) => entry.id !== created.id)]);
      setHandoffDisplayName("");
    } catch (err: any) {
      setHandoffError(err?.payload?.error || err?.message || "Unable to prepare an institutional handoff draft right now.");
    } finally {
      setHandoffBusy(false);
    }
  }, [handoffDisplayName, handoffInstitutionType]);

  const handleVoidInstitutionalHandoff = React.useCallback(async (handoffId: string) => {
    try {
      setHandoffBusy(true);
      setHandoffError(null);
      const updated = await voidInstitutionalHandoffDraft(handoffId);
      setHandoffDrafts((current) => current.map((entry) => (entry.id === handoffId ? updated : entry)));
    } catch (err: any) {
      setHandoffError(err?.payload?.error || err?.message || "Unable to void this institutional handoff draft right now.");
    } finally {
      setHandoffBusy(false);
    }
  }, []);

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
  const paymentSummary = rentPaymentDetails || data?.lease?.rentPaymentSummary || null;
  const latestPaymentStatus =
    paymentSummary?.latestPayment?.status || paymentSummary?.paymentExperience?.history?.[0]?.status || null;
  const paymentExperienceStatusLabel = formatPaymentExperienceStatus({
    latestPaymentStatus,
    latestStatus: paymentSummary?.paymentExperience?.latestStatus || null,
  });
  const tenantPaymentGuidance = describeRentPaymentGuidance({
    audience: "tenant",
    latestPaymentStatus,
    latestStatus: paymentSummary?.paymentExperience?.latestStatus || null,
    blockedReason: paymentSummary?.paymentRail.blockedReason || null,
    paymentRailEnabled: paymentSummary?.paymentRail.enabled ?? null,
  });

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

            {paymentSummary ? (
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
                      value: paymentSummary.paymentRail.enabled ? "Enabled" : "Not enabled",
                    },
                    {
                      label: "Latest status",
                      value: paymentExperienceStatusLabel,
                    },
                  ]}
                />
                <div style={{ color: textTokens.secondary }}>{tenantPaymentGuidance}</div>
                {(paymentSummary.paymentExperience?.history || []).length ? (
                  <div style={{ display: "grid", gap: spacing.xs }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Payment history</div>
                    {(paymentSummary.paymentExperience?.history || [])
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
                {paymentSummary.paymentExperience?.receiptSummary?.available ? (
                  <div style={{ display: "grid", gap: spacing.xs }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>
                      {paymentSummary.paymentExperience?.receiptSummary.label}
                    </div>
                    <div style={{ color: textTokens.secondary }}>
                      Lease {paymentSummary.paymentExperience?.receiptSummary.leaseReference || "reference"} ·{" "}
                      {formatMoney((paymentSummary.paymentExperience?.receiptSummary?.amountCents || 0) / 100)}{" "}
                      ·{" "}
                      {formatDate(paymentSummary.paymentExperience?.receiptSummary?.paidAt)}
                    </div>
                    <div>
                      <button type="button" onClick={() => window.print()}>
                        Print / Save payment summary
                      </button>
                    </div>
                  </div>
                ) : null}
                {paymentSummary.paymentRail.enabled &&
                data.lease.paymentReadiness.readinessStatus === "ready_to_configure" &&
                paymentSummary.paymentExperience?.latestStatus !== "pending" &&
                paymentSummary.paymentExperience?.latestStatus !== "paid" ? (
                  <div style={{ display: "grid", gap: spacing.xs }}>
                    <button type="button" onClick={() => void handlePayRent()} disabled={rentPaymentBusy}>
                      {rentPaymentBusy
                        ? "Opening checkout..."
                        : paymentSummary.paymentExperience?.retryAvailable
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
          {handoffError ? <div style={{ color: "#b91c1c" }}>{handoffError}</div> : null}

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
                  <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                    Tenant-controlled export. Institution-ready structure. No data is sent automatically.
                  </div>
                  <TenantKeyValueGrid
                    rows={[
                      { label: "Schema version", value: institutionalPackage.schema.version },
                      { label: "Schema name", value: institutionalPackage.schema.name },
                      { label: "Jurisdiction", value: institutionalPackage.schema.jurisdiction },
                      { label: "Data scope", value: prettyStatus(institutionalPackage.schema.dataScope) },
                      { label: "Consent required", value: institutionalPackage.schema.consentRequired ? "Yes" : "No" },
                    ]}
                  />

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Subject</div>
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Subject type", value: prettyStatus(institutionalPackage.subject.subjectType) },
                        { label: "Identity status", value: prettyStatus(institutionalPackage.subject.identityStatus) },
                        { label: "Verification level", value: prettyVerificationLevel(institutionalPackage.subject.verificationLevel) },
                        { label: "Completeness", value: prettyStatus(institutionalPackage.subject.completenessLevel) },
                      ]}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Identity</div>
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Portability status", value: prettyStatus(institutionalPackage.identity.portabilityStatus) },
                        { label: "Identity readiness", value: prettyStatus(institutionalPackage.identity.identityReadiness) },
                        { label: "Credibility readiness", value: prettyStatus(institutionalPackage.identity.credibilityReadiness) },
                      ]}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Rental history</div>
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Active lease available", value: institutionalPackage.rentalHistory.activeLeaseAvailable ? "Yes" : "No" },
                        { label: "Lease execution", value: prettyStatus(institutionalPackage.rentalHistory.leaseExecutionStatus) },
                        { label: "Lease summary available", value: institutionalPackage.rentalHistory.leaseSummaryAvailable ? "Yes" : "No" },
                      ]}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Payment readiness</div>
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Rent terms ready", value: institutionalPackage.paymentReadiness.rentTermsReady ? "Yes" : "No" },
                        { label: "Payment rail available", value: institutionalPackage.paymentReadiness.paymentRailAvailable ? "Yes" : "No" },
                        {
                          label: "Latest payment status",
                          value: prettyStatus(institutionalPackage.paymentReadiness.latestPaymentStatus || "not_available"),
                        },
                      ]}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Audit</div>
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Audit trail available", value: institutionalPackage.audit.auditTrailAvailable ? "Yes" : "No" },
                        { label: "Total identity events", value: String(institutionalPackage.audit.totalIdentityEvents) },
                        { label: "Recent activity available", value: institutionalPackage.audit.recentActivityAvailable ? "Yes" : "No" },
                      ]}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Validation</div>
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Validation status", value: prettyInstitutionalSchemaStatus(institutionalPackage.validation.status) },
                        { label: "Warnings", value: String(institutionalPackage.validation.warnings.length) },
                        { label: "Missing recommended fields", value: String(institutionalPackage.validation.missingRecommendedFields.length) },
                      ]}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Compliance readiness</div>
                    <TenantKeyValueGrid
                      rows={[
                        {
                          label: "Readiness",
                          value: prettyComplianceReadinessStatus(institutionalPackage.complianceReadiness.readinessStatus),
                        },
                        {
                          label: "Export storage",
                          value: prettyStatus(institutionalPackage.complianceReadiness.exportTraceability.exportStorage),
                        },
                        {
                          label: "Outbound transfer",
                          value: prettyStatus(institutionalPackage.complianceReadiness.exportTraceability.outboundTransfer),
                        },
                      ]}
                    />
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      {institutionalPackage.complianceReadiness.readinessDescription}
                    </div>
                    <TenantKeyValueGrid
                      rows={institutionalPackage.complianceReadiness.checks.map((check) => ({
                        label: check.label,
                        value: prettyComplianceCheckStatus(check.status),
                      }))}
                    />
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      Exports are generated on request and are not stored by RentChain.
                    </div>
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      No data is sent automatically.
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Audit traceability</div>
                    <TenantKeyValueGrid
                      rows={[
                        {
                          label: "Audit traceability",
                          value: institutionalPackage.complianceReadiness.auditTraceability.traceabilityLabel,
                        },
                        {
                          label: "Draft metadata trace",
                          value: institutionalPackage.complianceReadiness.auditTraceability.evidenceCoverage
                            .handoffDraftMetadataAvailable
                            ? "Available"
                            : "Not available",
                        },
                        {
                          label: "Institution event coverage",
                          value:
                            institutionalPackage.complianceReadiness.auditTraceability.evidenceCoverage
                              .observabilityCoverage === "draft_creation_only"
                              ? "Draft creation only"
                              : "Not available",
                        },
                        {
                          label: "Canonical institution events",
                          value: institutionalPackage.complianceReadiness.auditTraceability.evidenceCoverage
                            .canonicalInstitutionEventsAvailable
                            ? "Available"
                            : "Not available",
                        },
                      ]}
                    />
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      {institutionalPackage.complianceReadiness.auditTraceability.traceabilityDescription}
                    </div>
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      This audit traceability summary reflects reduced, tenant-safe evidence only. Institutional exports
                      are generated on demand, are not stored by RentChain, and are not transmitted automatically.
                    </div>
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      Current gaps: export generation is not recorded as an institutional event stream, institutional
                      handoff lifecycle coverage is limited, and a broader access audit summary is not available.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Tenant-controlled trust export</div>
            <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
              Prepare a non-public, metadata-only trust export for tenant review. No data is sent automatically, no public profile is created, and support/internal metadata stays excluded.
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600, color: textTokens.primary }}>Intended audience</span>
                <select
                  value={trustExportAudience}
                  onChange={(event) => {
                    setTrustExportAudience(event.target.value as TenantTrustExportAudience);
                    setTrustExportPreview(null);
                  }}
                >
                  <option value="tenant_portability">Tenant portability</option>
                  <option value="insurer">Insurer review</option>
                  <option value="lender">Lender review</option>
                  <option value="institutional_landlord">Institutional landlord review</option>
                  <option value="auditor">Auditor review</option>
                </select>
              </label>
              <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                Purpose: {prettyStatus(trustExportPurposeForAudience(trustExportAudience))}
                <br />
                Expires: 14 days after preparation
              </div>
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: textTokens.secondary, lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={trustExportConsentAccepted}
                onChange={(event) => {
                  setTrustExportConsentAccepted(event.target.checked);
                  setTrustExportPreview(null);
                }}
                style={{ marginTop: 4 }}
              />
              <span>
                I consent to preparing a metadata-only trust export for {prettyTrustExportAudience(trustExportAudience)}. I understand this does not prove eligibility, does not send data automatically, and revocation cannot recall files already downloaded or shared outside RentChain.
              </span>
            </label>

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void handlePreviewTrustExport()} disabled={trustExportBusy}>
                {trustExportBusy ? "Checking..." : "Preview trust export"}
              </button>
              <button
                type="button"
                onClick={() => void handlePrepareTrustExport()}
                disabled={trustExportBusy || !trustExportConsentAccepted}
              >
                Prepare export
              </button>
              {trustExportPreview?.package?.status === "export_ready" ? (
                <button type="button" onClick={() => handleDownloadTrustExportJson(trustExportPreview)}>
                  Download preview JSON
                </button>
              ) : null}
            </div>

            {trustExportError ? <div style={{ color: "#b91c1c" }}>{trustExportError}</div> : null}

            {trustExportPreview ? (
              <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>Trust export preview</div>
                  <div style={{ color: textTokens.secondary }}>{prettyTrustExportLifecycle(trustExportPreview.lifecycle)}</div>
                </div>
                <TenantKeyValueGrid
                  rows={[
                    { label: "Audience", value: prettyTrustExportAudience(trustExportPreview.audience) },
                    { label: "Consent", value: trustExportPreview.consent.granted ? "Granted for this package" : "Required" },
                    { label: "Policy status", value: prettyStatus(trustExportPreview.package.status) },
                    { label: "Included claims", value: String(trustExportPreview.includedClaims.length) },
                    { label: "Blocked claims", value: String(trustExportPreview.excludedClaims.length) },
                    { label: "Public access", value: trustExportPreview.publicAccessEnabled ? "Enabled" : "Disabled" },
                    { label: "External submission", value: trustExportPreview.externalSubmissionEnabled ? "Enabled" : "Disabled" },
                    { label: "Expires", value: formatDate(trustExportPreview.expiresAt) },
                  ]}
                />

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>Included metadata</div>
                  {trustExportPreview.includedClaims.length ? (
                    trustExportPreview.includedClaims.map((claim) => (
                      <div key={claim.attestationId} style={{ color: textTokens.secondary }}>
                        {claim.claimLabel} - {prettyStatus(claim.claimCategory)}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: textTokens.secondary }}>No claims are exportable until consent and policy checks pass.</div>
                  )}
                </div>

                {trustExportPreview.excludedClaims.length ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, color: textTokens.primary }}>Excluded metadata</div>
                    {trustExportPreview.excludedClaims.map((claim) => (
                      <div key={claim.attestationId} style={{ color: textTokens.secondary }}>
                        {claim.claimLabel}: {claim.reasons.map(prettyPolicyReason).join(", ")}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>Always excluded</div>
                  {trustExportPreview.redactions.map((item) => (
                    <div key={item} style={{ color: textTokens.secondary }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700, color: textTokens.primary }}>Prepared trust exports</div>
              {trustExports.length ? (
                trustExports.map((entry) => (
                  <div key={entry.exportId} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 8 }}>
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Audience", value: prettyTrustExportAudience(entry.audience) },
                        { label: "Status", value: prettyTrustExportLifecycle(entry.lifecycle) },
                        { label: "Prepared", value: formatDate(entry.createdAt) },
                        { label: "Expires", value: formatDate(entry.expiresAt) },
                        { label: "Claims", value: String(entry.includedClaims.length) },
                      ]}
                    />
                    <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => handleDownloadTrustExportJson(entry)}>
                        Download JSON
                      </button>
                      {entry.lifecycle === "prepared" ? (
                        <button type="button" onClick={() => void handleRevokeTrustExport(entry.exportId)} disabled={trustExportBusy}>
                          Revoke export
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: textTokens.secondary }}>
                  Prepared trust exports will appear here. They remain tenant-controlled and non-public.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Tenant-mediated institution access</div>
            <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
              Prepare a controlled, non-public access grant for a specific recipient. This does not create a public profile, does not send data to an institution, and does not enable automatic decisions.
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600, color: textTokens.primary }}>Recipient email</span>
                <input
                  value={institutionAccessRecipientEmail}
                  onChange={(event) => {
                    setInstitutionAccessRecipientEmail(event.target.value);
                    setInstitutionAccessPreview(null);
                  }}
                  placeholder="reviewer@example.com"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600, color: textTokens.primary }}>Organization</span>
                <input
                  value={institutionAccessOrganization}
                  onChange={(event) => {
                    setInstitutionAccessOrganization(event.target.value);
                    setInstitutionAccessPreview(null);
                  }}
                  placeholder="Optional"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600, color: textTokens.primary }}>Audience</span>
                <select
                  value={institutionAccessAudience}
                  onChange={(event) => {
                    setInstitutionAccessAudience(event.target.value as TenantInstitutionAccessAudience);
                    setInstitutionAccessPreview(null);
                  }}
                >
                  <option value="insurer">Insurer review</option>
                  <option value="lender">Lender review</option>
                  <option value="institutional_landlord">Institutional landlord review</option>
                  <option value="auditor">Auditor review</option>
                </select>
              </label>
              <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                Purpose: {prettyStatus(institutionAccessPurposeForAudience(institutionAccessAudience))}
                <br />
                Expires: 14 days after grant
              </div>
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: textTokens.secondary, lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={institutionAccessConsentAccepted}
                onChange={(event) => {
                  setInstitutionAccessConsentAccepted(event.target.checked);
                  setInstitutionAccessPreview(null);
                }}
                style={{ marginTop: 4 }}
              />
              <span>
                I consent to preparing metadata-only institution access for {prettyInstitutionAccessAudience(institutionAccessAudience)}. I understand recipient access requires controlled future authentication, no public link is created, and this is not an eligibility or approval decision.
              </span>
            </label>

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void handlePreviewInstitutionAccess()} disabled={institutionAccessBusy}>
                {institutionAccessBusy ? "Checking..." : "Preview access"}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateInstitutionAccessGrant()}
                disabled={institutionAccessBusy || !institutionAccessConsentAccepted}
              >
                Create access grant
              </button>
            </div>

            {institutionAccessError ? <div style={{ color: "#b91c1c" }}>{institutionAccessError}</div> : null}

            {institutionAccessPreview ? (
              <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>Institution access preview</div>
                  <div style={{ color: textTokens.secondary }}>{prettyTrustExportLifecycle(institutionAccessPreview.lifecycle)}</div>
                </div>
                <TenantKeyValueGrid
                  rows={[
                    { label: "Recipient", value: institutionAccessPreview.recipient.email },
                    { label: "Audience", value: prettyInstitutionAccessAudience(institutionAccessPreview.audience) },
                    { label: "Consent", value: institutionAccessPreview.consent.granted ? "Granted for this access grant" : "Required" },
                    { label: "Policy status", value: prettyStatus(institutionAccessPreview.package.status) },
                    { label: "Included claims", value: String(institutionAccessPreview.includedClaims.length) },
                    { label: "Public access", value: institutionAccessPreview.publicAccessEnabled ? "Enabled" : "Disabled" },
                    { label: "Recipient URL", value: institutionAccessPreview.recipientAccess.accessUrl || "Not created" },
                    { label: "Expires", value: formatDate(institutionAccessPreview.expiresAt) },
                  ]}
                />
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>Included metadata</div>
                  {institutionAccessPreview.includedClaims.length ? (
                    institutionAccessPreview.includedClaims.map((claim) => (
                      <div key={claim.attestationId} style={{ color: textTokens.secondary }}>
                        {claim.claimLabel} - {prettyStatus(claim.claimCategory)}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: textTokens.secondary }}>No claims are accessible until consent and policy checks pass.</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 700, color: textTokens.primary }}>Always excluded</div>
                  {institutionAccessPreview.redactions.map((item) => (
                    <div key={item} style={{ color: textTokens.secondary }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 700, color: textTokens.primary }}>Institution access grants</div>
              {institutionAccessGrants.length ? (
                institutionAccessGrants.map((entry) => (
                  <div key={entry.grantId} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 8 }}>
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Recipient", value: entry.recipient.email },
                        { label: "Audience", value: prettyInstitutionAccessAudience(entry.audience) },
                        { label: "Status", value: prettyTrustExportLifecycle(entry.lifecycle) },
                        { label: "Created", value: formatDate(entry.createdAt) },
                        { label: "Expires", value: formatDate(entry.expiresAt) },
                        { label: "Access URL", value: entry.recipientAccess.accessUrl || "Not created" },
                      ]}
                    />
                    {entry.lifecycle === "active" ? (
                      <button type="button" onClick={() => void handleRevokeInstitutionAccessGrant(entry.grantId)} disabled={institutionAccessBusy}>
                        Revoke access
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div style={{ color: textTokens.secondary }}>
                  Institution access grants will appear here. They stay tenant-controlled, time-bound, and non-public.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "12px 14px",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: textTokens.primary }}>Institutional handoff drafts</div>
            <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
              Prepare a draft institutional handoff. This supports tenant-managed manual-release preparation only. No data is sent automatically, and institution connections are not enabled yet.
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600, color: textTokens.primary }}>Institution type</span>
              <select
                value={handoffInstitutionType}
                onChange={(event) =>
                  setHandoffInstitutionType(
                    event.target.value as "bank" | "lender" | "insurer" | "regulator" | "internal_review"
                  )
                }
              >
                <option value="bank">Bank</option>
                <option value="lender">Lender</option>
                <option value="insurer">Insurer</option>
                <option value="regulator">Regulator</option>
                <option value="internal_review">Internal review</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600, color: textTokens.primary }}>Display name (optional)</span>
              <input
                type="text"
                value={handoffDisplayName}
                onChange={(event) => setHandoffDisplayName(event.target.value)}
                placeholder="Optional draft label"
                maxLength={80}
              />
            </label>

            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              <button type="button" onClick={() => void handleCreateInstitutionalHandoff()} disabled={handoffBusy}>
                {handoffBusy ? "Preparing draft..." : "Prepare institutional handoff"}
              </button>
            </div>

            {handoffDrafts.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {handoffDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    style={{
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <TenantKeyValueGrid
                      rows={[
                        { label: "Institution type", value: prettyInstitutionType(draft.institutionProfile.institutionType) },
                        { label: "Display name", value: draft.institutionProfile.displayName },
                        { label: "Schema version", value: draft.schema.version },
                        { label: "Readiness", value: prettyComplianceReadinessStatus(draft.compliance.readinessStatus) },
                        { label: "Validation", value: prettyInstitutionalSchemaStatus(draft.compliance.validationStatus) },
                        { label: "Status", value: prettyHandoffStatus(draft.handoffStatus) },
                        { label: "Created", value: formatDate(draft.createdAt) },
                        { label: "Updated", value: formatDate(draft.updatedAt) },
                      ]}
                    />
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      {institutionalHandoffStatusDescription(draft.handoffStatus)}
                    </div>
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      No data is sent automatically. You may manually share a downloaded export outside RentChain when you choose.
                    </div>
                    <div style={{ color: textTokens.secondary, lineHeight: 1.6 }}>
                      Institution connections are not enabled yet.
                    </div>
                    {draft.handoffStatus !== "voided" ? (
                      <div style={{ display: "flex", gap: spacing.sm }}>
                        <button type="button" onClick={() => void handleVoidInstitutionalHandoff(draft.id)} disabled={handoffBusy}>
                          Void draft
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: textTokens.secondary }}>
                No institutional handoff drafts yet.
              </div>
            )}
          </div>
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
                  <div style={{ color: textTokens.secondary }}>
                    Reuse path: {describeShareLinkReusePath(entry)}
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
                      <div style={{ color: textTokens.secondary }}>
                        No new access is granted unless you approve it.
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
