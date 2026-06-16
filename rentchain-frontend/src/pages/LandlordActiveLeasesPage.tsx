import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  archiveLeaseRecord,
  convertUnitReferenceToLease,
  enableLeasePaymentRail,
  getActiveLeasesForLandlord,
  getArchivedLeasesForLandlord,
  getLeaseReconciliationCandidates,
  downloadSignedLease,
  refreshLeaseDocumentUrl,
  restoreLeaseRecord,
  type LandlordActiveLease,
  type LeaseReconciliationCandidate,
} from "@/api/leasesApi";
import {
  describeRentPaymentGuidance,
  formatPaymentExperienceStatus,
  prettyRentPaymentStatus,
} from "@/lib/payments/paymentStatusGuidance";
import { isTargetedHiddenLeaseId } from "@/lib/testDataVisibilityTargets";
import LeaseSigningDashboard from "@/components/LeaseSigningDashboard";
import { downloadLeaseSummaryPdf } from "@/utils/leaseSummaryPdf";
import { printSummaryDocument } from "@/utils/printSummary";
import { LockedFeature } from "@/components/billing/LockedFeature";
import { useEntitlements } from "@/hooks/useEntitlements";
import { isUpgradeRequiredError } from "@/lib/gatedFeatureErrors";
import "./LandlordActiveLeasesPage.css";

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : 0;
  return amount.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isGoogleStorageSignedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "storage.googleapis.com" || url.hostname === "storage.cloud.google.com" || url.hostname.endsWith(".storage.googleapis.com");
  } catch {
    return false;
  }
}

function isAppDomainLeasePdfFallback(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && /^\/leases\/.+\.pdf$/i.test(url.pathname);
  } catch {
    return /^\/leases\/.+\.pdf(?:$|\?)/i.test(value);
  }
}

function canUseLegacyDocumentFallback(value: string) {
  const next = String(value || "").trim();
  return Boolean(next) && !isGoogleStorageSignedUrl(next) && !isAppDomainLeasePdfFallback(next);
}

function isScheduleADocumentUrl(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && (normalized.includes("schedule-a") || normalized.includes("schedule_a"));
}

function primaryLeaseDocumentUrl(lease: LandlordActiveLease) {
  const value = String(lease.documentUrl || "").trim();
  return value && !isScheduleADocumentUrl(value) ? value : "";
}

function scheduleADocumentUrl(lease: LandlordActiveLease) {
  const explicit = String(lease.scheduleAUrl || "").trim();
  if (explicit) return explicit;
  const legacy = String(lease.documentUrl || "").trim();
  return isScheduleADocumentUrl(legacy) ? legacy : "";
}

function isSignedLeaseRecord(lease: LandlordActiveLease) {
  const signingStatus = String((lease as any).currentSigningStatus || (lease as any).signingStatus || "").trim().toLowerCase();
  const executionStatus = String(lease.leaseExecution?.executionStatus || "").trim().toLowerCase();
  return signingStatus === "signed" || executionStatus === "fully_executed" || lease.signatureStatus === "signed";
}

function normalizePhoneInput(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function formatBlockingReason(reason: string) {
  switch (String(reason || "").trim().toLowerCase()) {
    case "occupant_name_required":
      return "Occupant name required";
    case "rent_required":
      return "Monthly rent required";
    default:
      return String(reason || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function buildCompleteTenantInfoHref(candidate: LeaseReconciliationCandidate) {
  const params = new URLSearchParams();
  params.set("propertyId", String(candidate.propertyId));
  params.set("unitId", String(candidate.unitId));
  return `/properties?${params.toString()}`;
}

function matchesLeaseSearch(lease: LandlordActiveLease, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  const haystack = [lease.tenantName, lease.unitNumber, lease.propertyName]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  return haystack.includes(normalizedQuery);
}

function isVisibleLease(lease: LandlordActiveLease) {
  return lease.hiddenFromActiveLists !== true && !isTargetedHiddenLeaseId(lease.id);
}

function statusBadge(status: string | null | undefined) {
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "4px 8px",
        borderRadius: 999,
        background: "#eff6ff",
        color: "#1d4ed8",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {prettyLeaseStatus(status)}
    </span>
  );
}

function formatCoherenceToken(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function occupancyDisplayLabel(lease: LandlordActiveLease) {
  const coherence = lease.stateCoherence;
  if (!coherence) return null;
  if (coherence.flags?.requiresReview || coherence.occupancyState === "review_required" || coherence.occupancyState === "unknown") {
    return "Review needed";
  }
  if (coherence.leaseOperationalState === "archived") return "Archived";
  if (coherence.occupancyState === "upcoming") return "Upcoming";
  if (coherence.occupancyState === "occupied" || coherence.occupancyState === "notice_period") return "Occupied";
  if (coherence.occupancyState === "vacant") return "Vacant";
  return "Review needed";
}

function renderOccupancyDisplay(lease: LandlordActiveLease) {
  const label = occupancyDisplayLabel(lease);
  if (!label) return null;
  return (
    <div style={{ color: label === "Review needed" ? "#92400e" : "#64748b", fontSize: 12, marginTop: 6 }}>
      Occupancy: <strong>{label}</strong>
    </div>
  );
}

function renderStateCoherence(lease: LandlordActiveLease) {
  const coherence = lease.stateCoherence;
  if (!coherence) return null;
  const needsReview = coherence.flags?.requiresReview || coherence.coherenceStatus === "review_required";
  const paymentActivityLabel =
    coherence.paymentReadinessState === "recorded_activity_present"
      ? "Recorded ledger payment activity present"
      : null;
  if (!needsReview && !paymentActivityLabel) return null;
  return (
    <div
      style={{
        display: "grid",
        gap: 3,
        marginTop: 6,
        color: needsReview ? "#92400e" : "#475569",
        fontSize: 12,
      }}
    >
      {needsReview ? (
        <div style={{ fontWeight: 800 }}>
          Needs review: {formatCoherenceToken(coherence.leaseOperationalState)} lease · Review needed occupancy
        </div>
      ) : null}
      {paymentActivityLabel ? <div>{paymentActivityLabel}</div> : null}
    </div>
  );
}

function executionNextActionLabel(value: string | null | undefined) {
  switch (String(value || "").trim().toLowerCase()) {
    case "tenant_signature":
      return "Tenant signature needed";
    case "landlord_signature":
      return "Landlord signature needed";
    case "review_signed_lease":
      return "Review signed lease";
    case "none":
      return "No action needed";
    default:
      return "Complete lease details";
  }
}

function paymentReadinessChecklist(lease: LandlordActiveLease) {
  const readiness = lease.paymentReadiness;
  if (!readiness) return "Payment readiness unavailable";
  const missing: string[] = [];
  if (!readiness.rentTerms.rentAmountAvailable) missing.push("Rent amount missing");
  if (!readiness.rentTerms.dueDateAvailable) missing.push("Due day missing");
  if (!readiness.rentTerms.leaseDatesAvailable) missing.push("Lease dates missing");
  if (!readiness.rentTerms.tenantLinked) missing.push("Tenant or unit linkage missing");
  if (missing.length === 0) return readiness.readinessLabel;
  return missing.join(" · ");
}

function lifecycleNextActionLabel(
  value:
    | "review_expiring_lease"
    | "prepare_renewal_notice"
    | "follow_up_response"
    | "review_renewal_outcome"
    | "review_move_out"
    | "none"
    | undefined
) {
  switch (value) {
    case "prepare_renewal_notice":
      return "Prepare renewal notice";
    case "follow_up_response":
      return "Follow up on renewal response";
    case "review_renewal_outcome":
      return "Review renewal outcome";
    case "review_move_out":
      return "Review move-out follow-through";
    case "review_expiring_lease":
      return "Review expiring lease";
    default:
      return "No follow-up needed";
  }
}

function renderLifecycleSummary(lease: LandlordActiveLease) {
  const lifecycle = lease.leaseLifecycleSummary;
  if (!lifecycle) return null;
  return (
    <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{lifecycle.lifecycleLabel}</div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{lifecycleNextActionLabel(lifecycle.requiredNextAction)}</div>
      {typeof lifecycle.daysUntilExpiry === "number" ? (
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {lifecycle.daysUntilExpiry === 0
            ? "Lease ends today"
            : lifecycle.daysUntilExpiry === 1
            ? "1 day until lease end"
            : `${lifecycle.daysUntilExpiry} days until lease end`}
        </div>
      ) : null}
    </div>
  );
}

function jurisdictionWorkflowTitle(lease: LandlordActiveLease) {
  const policies = Array.isArray(lease.jurisdictionPolicies) ? lease.jurisdictionPolicies : [];
  const jurisdiction = policies[0]?.jurisdiction;
  if (jurisdiction === "NS") return "NS Workflow Guidance";
  if (jurisdiction === "ON") return "ON Workflow Guidance";
  return "Jurisdiction Workflow Guidance";
}

function compactPolicyActionLabel(policyKey: string, fallback: string) {
  switch (policyKey) {
    case "rent_increase_workflow_availability":
      return "Rent Increase Workflow";
    case "notice_workflow_readiness":
      return "Notice Workflow";
    case "deposit_workflow_review":
      return "Deposit Workflow";
    case "lease_renewal_review":
      return "Renewal Review";
    case "move_out_preparation":
      return "Move-Out Prep";
    case "lease_execution_readiness":
      return "Execution Review";
    default:
      return fallback.replace(/\s+(available|recommended)$/i, "");
  }
}

function policyWorkflowHref(leaseId: string, policyKey: string) {
  const base = `/leases/${encodeURIComponent(leaseId)}/workflows`;
  switch (policyKey) {
    case "rent_increase_workflow_availability":
      return `${base}/rent-increase`;
    case "deposit_workflow_review":
      return `${base}/deposit`;
    case "lease_execution_readiness":
      return `${base}/execution`;
    case "lease_renewal_review":
      return `${base}/renewal`;
    case "move_out_preparation":
      return `${base}/move-out`;
    case "notice_workflow_readiness":
      return `${base}/notice`;
    default:
      return `/leases/${encodeURIComponent(leaseId)}/summary`;
  }
}

function renderJurisdictionPolicyGuidance(lease: LandlordActiveLease) {
  const policies = Array.isArray(lease.jurisdictionPolicies) ? lease.jurisdictionPolicies : [];
  if (policies.length === 0) return null;
  const visiblePolicies = policies.slice(0, 6);
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
        marginTop: 8,
        padding: "8px 10px",
        border: "1px solid #bfdbfe",
        borderRadius: 10,
        background: "#eff6ff",
        color: "#1e3a8a",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 800, marginRight: 2 }}>{jurisdictionWorkflowTitle(lease)}:</div>
      {visiblePolicies.map((policy) => (
        <Link
          key={`${policy.policyKey}:${policy.sourceRuleKey}`}
          to={policyWorkflowHref(lease.id, policy.policyKey)}
          title={`${policy.label}: ${policy.recommendation}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 24,
            padding: "3px 8px",
            borderRadius: 999,
            border: "1px solid #bfdbfe",
            background: "#fff",
            color: policy.severity === "warning" || policy.severity === "critical" ? "#92400e" : "#1d4ed8",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          {compactPolicyActionLabel(policy.policyKey, policy.label)}
        </Link>
      ))}
      <div style={{ color: "#475569" }}>Verify local requirements.</div>
    </div>
  );
}

export default function LandlordActiveLeasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "archived" ? "archived" : "active";
  const entitlements = useEntitlements();
  const leasesEnabled = entitlements.hasCapability("leases");
  const [leases, setLeases] = React.useState<LandlordActiveLease[]>([]);
  const [candidates, setCandidates] = React.useState<LeaseReconciliationCandidate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCandidate, setSelectedCandidate] = React.useState<LeaseReconciliationCandidate | null>(null);
  const [convertSaving, setConvertSaving] = React.useState(false);
  const [paymentRailBusyLeaseId, setPaymentRailBusyLeaseId] = React.useState<string | null>(null);
  const [documentBusyLeaseId, setDocumentBusyLeaseId] = React.useState<string | null>(null);
  const [occupantName, setOccupantName] = React.useState("");
  const [tenantEmail, setTenantEmail] = React.useState("");
  const [tenantPhone, setTenantPhone] = React.useState("");
  const [coApplicantEmail, setCoApplicantEmail] = React.useState("");
  const [coApplicantPhone, setCoApplicantPhone] = React.useState("");
  const [startDate, setStartDate] = React.useState(todayIso());
  const [endDate, setEndDate] = React.useState("");
  const [monthlyRent, setMonthlyRent] = React.useState("");
  const [isNarrowLayout, setIsNarrowLayout] = React.useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateLayout = (event?: MediaQueryListEvent) => {
      setIsNarrowLayout(event ? event.matches : mediaQuery.matches);
    };
    updateLayout();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateLayout);
      return () => mediaQuery.removeEventListener("change", updateLayout);
    }
    mediaQuery.addListener(updateLayout);
    return () => mediaQuery.removeListener(updateLayout);
  }, []);

  const load = React.useCallback(async () => {
    if (entitlements.loading) return;
    if (!leasesEnabled) {
      setLeases([]);
      setCandidates([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [leaseResponse, candidateResponse] = await Promise.all([
        view === "archived" ? getArchivedLeasesForLandlord() : getActiveLeasesForLandlord(),
        view === "active" ? getLeaseReconciliationCandidates() : Promise.resolve({ candidates: [] }),
      ]);
      const nextLeases = Array.isArray(leaseResponse?.leases)
        ? leaseResponse.leases.filter(isVisibleLease)
        : [];
      setLeases(nextLeases);
      setCandidates(Array.isArray(candidateResponse?.candidates) ? candidateResponse.candidates : []);
    } catch (err: unknown) {
      setError(isUpgradeRequiredError(err) ? null : errorMessage(err, "Failed to load lease operations."));
      setLeases([]);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [entitlements.loading, leasesEnabled, view]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!selectedCandidate) return;
    setOccupantName(String(selectedCandidate.occupantName || ""));
    setTenantEmail("");
    setTenantPhone("");
    setCoApplicantEmail("");
    setCoApplicantPhone("");
    setStartDate(todayIso());
    setEndDate(String(selectedCandidate.leaseEndDate || ""));
    setMonthlyRent(String(selectedCandidate.monthlyRent || ""));
  }, [selectedCandidate]);

  async function handleArchive(lease: LandlordActiveLease) {
    const confirmed = window.confirm(
      "Archive this lease from the landlord lease workspace? You can restore it later from View archive."
    );
    if (!confirmed) return;
    await archiveLeaseRecord(lease.id);
    await load();
  }

  async function handleRestore(lease: LandlordActiveLease) {
    await restoreLeaseRecord(lease.id);
    await load();
  }

  async function handleEnableRentCollection(lease: LandlordActiveLease) {
    setPaymentRailBusyLeaseId(lease.id);
    setError(null);
    try {
      await enableLeasePaymentRail(lease.id);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to enable rent collection."));
    } finally {
      setPaymentRailBusyLeaseId(null);
    }
  }

  async function openLeaseDocument(lease: LandlordActiveLease, documentKind: "lease" | "schedule-a" = "lease") {
    const fallbackUrl = documentKind === "schedule-a" ? scheduleADocumentUrl(lease) : primaryLeaseDocumentUrl(lease);
    let primaryRefreshReturnedScheduleA = false;
    setDocumentBusyLeaseId(lease.id);
    try {
      const refreshed =
        documentKind === "schedule-a"
          ? await refreshLeaseDocumentUrl(lease.id, { document: "schedule-a" })
          : await refreshLeaseDocumentUrl(lease.id);
      const nextUrl = String(refreshed?.documentUrl || "").trim() || fallbackUrl;
      if (documentKind === "lease" && isScheduleADocumentUrl(nextUrl)) {
        primaryRefreshReturnedScheduleA = true;
        throw new Error("Primary lease document unavailable. Use View Schedule A for the supplemental form.");
      }
      if (!nextUrl) throw new Error("Lease document is not available.");
      window.open(nextUrl, "_blank", "noreferrer");
    } catch (err: unknown) {
      if (documentKind === "lease" && !primaryRefreshReturnedScheduleA && isSignedLeaseRecord(lease)) {
        try {
          const signedDocument = await downloadSignedLease(lease.id);
          const signedUrl = String(signedDocument?.documentUrl || "").trim();
          if (signedUrl) {
            window.open(signedUrl, "_blank", "noreferrer");
            return;
          }
        } catch {
          // Keep the original document-refresh error visible below.
        }
      }
      if (!primaryRefreshReturnedScheduleA && canUseLegacyDocumentFallback(fallbackUrl)) {
        window.open(fallbackUrl, "_blank", "noreferrer");
        return;
      }
      setError(errorMessage(err, documentKind === "schedule-a" ? "Schedule A link expired and needs regeneration." : "Lease document link expired and needs regeneration."));
    } finally {
      setDocumentBusyLeaseId(null);
    }
  }

  async function handleConvert() {
    if (!selectedCandidate) return;
    setConvertSaving(true);
    setError(null);
    try {
      await convertUnitReferenceToLease(selectedCandidate.unitId, {
        occupantName,
        tenantEmail: tenantEmail.trim() || undefined,
        tenantPhone: tenantPhone.trim() || undefined,
        coApplicantEmail: coApplicantEmail.trim() || undefined,
        coApplicantPhone: coApplicantPhone.trim() || undefined,
        startDate,
        endDate: endDate || null,
        monthlyRent: Number(monthlyRent || 0),
      });
      setSelectedCandidate(null);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to convert reference to lease."));
    } finally {
      setConvertSaving(false);
    }
  }

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredLeases = React.useMemo(
    () => leases.filter((lease) => matchesLeaseSearch(lease, normalizedSearchQuery)),
    [leases, normalizedSearchQuery]
  );

  function buildLeaseActionMeta(lease: LandlordActiveLease) {
    const ledgerPath = `/leases/${encodeURIComponent(lease.id)}/ledger`;
    const summaryPath = `/leases/${encodeURIComponent(lease.id)}/summary`;
    const ledgerUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${ledgerPath}`
        : ledgerPath;
    const emailSubject = encodeURIComponent(`Lease for ${lease.propertyName} unit ${lease.unitNumber}`);
    const emailBody = encodeURIComponent(
      [
        `Lease reference for ${lease.propertyName} unit ${lease.unitNumber}.`,
        "",
        `Monthly rent: ${formatCurrency(lease.monthlyRent)}`,
        `Status: ${prettyLeaseStatus(lease.status)}`,
        `Term: ${formatDate(lease.startDate)} to ${formatDate(lease.endDate)}`,
        `View ledger: ${ledgerUrl}`,
        `Lease summary: ${typeof window !== "undefined" ? `${window.location.origin}${summaryPath}` : summaryPath}`,
      ]
        .filter(Boolean)
        .join("\n")
    );
    return {
      ledgerPath,
      summaryPath,
      emailHref: lease.tenantEmail
        ? `mailto:${encodeURIComponent(lease.tenantEmail)}?subject=${emailSubject}&body=${emailBody}`
        : null,
    };
  }

  function renderLeaseActions(lease: LandlordActiveLease) {
    const { ledgerPath, summaryPath, emailHref } = buildLeaseActionMeta(lease);
    const primaryDocumentUrl = primaryLeaseDocumentUrl(lease);
    const scheduleAUrl = scheduleADocumentUrl(lease);
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {primaryDocumentUrl ? (
            <button
              type="button"
              onClick={() => void openLeaseDocument(lease)}
              disabled={documentBusyLeaseId === lease.id}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}
            >
              {documentBusyLeaseId === lease.id ? "Opening..." : "View lease"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              title={scheduleAUrl ? "Only Schedule A is available for this record." : "No primary lease PDF is attached to this record."}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b" }}
            >
              Primary lease document unavailable
            </button>
          )}
          <Link
            to={summaryPath}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", textDecoration: "none" }}
          >
            Lease summary
          </Link>
          {scheduleAUrl ? (
            <button
              type="button"
              onClick={() => void openLeaseDocument(lease, "schedule-a")}
              disabled={documentBusyLeaseId === lease.id}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}
            >
              {documentBusyLeaseId === lease.id ? "Opening..." : "View Schedule A"}
            </button>
          ) : null}
          <Link to={ledgerPath} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}>
            Ledger
          </Link>
          {emailHref ? (
            <a
              href={emailHref}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", textDecoration: "none", color: "#0f172a" }}
            >
              Email
            </a>
          ) : (
            <button
              type="button"
              disabled
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8" }}
            >
              Email
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (primaryLeaseDocumentUrl(lease)) {
                void openLeaseDocument(lease);
                return;
              }
              downloadLeaseSummaryPdf(lease);
            }}
            disabled={documentBusyLeaseId === lease.id}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
          >
            Save
          </button>
          {view === "archived" ? (
            <button
              type="button"
              onClick={() => void handleRestore(lease)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
            >
              Restore
            </button>
          ) : (
            <>
              {lease.rentPaymentSummary?.paymentRail.enabled !== true &&
              lease.paymentReadiness?.readinessStatus === "ready_to_configure" ? (
                <button
                  type="button"
                  onClick={() => void handleEnableRentCollection(lease)}
                  disabled={paymentRailBusyLeaseId === lease.id}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
                >
                  {paymentRailBusyLeaseId === lease.id ? "Enabling..." : "Enable rent collection"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleArchive(lease)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a" }}
              >
                Archive lease
              </button>
            </>
          )}
        </div>
        {view !== "archived" ? <LeaseSigningDashboard leaseId={lease.id} tenantEmail={lease.tenantEmail} /> : null}
      </div>
    );
  }

  return (
    <div className="rc-leases-page" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>Lease operations</div>
          <div style={{ color: "#475569", fontSize: 14 }}>
            Keep canonical lease records visible, reconcile occupied units missing leases, and use the ledger and archive views safely.
          </div>
        </div>
        <button
          type="button"
          className="no-print"
          onClick={() => void printSummaryDocument("summary")}
          style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#FFFFFF", fontWeight: 900, cursor: "pointer" }}
        >
          Print / Save PDF
        </button>
      </div>

      <div className="print-only print-only-summary">
        <div className="printHeader">
          <div className="printTitle">Lease operations summary</div>
          <div className="printMeta">
            <div>View: {view === "archived" ? "Archived leases" : "Active leases"}</div>
            <div>Visible leases: {filteredLeases.length}</div>
          </div>
        </div>
        <table className="printTable">
          <thead>
            <tr>
              <th>Property</th>
              <th>Unit</th>
              <th>Tenant</th>
              <th>Status</th>
              <th>Lifecycle</th>
              <th>Payment readiness</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeases.map((lease) => (
              <tr key={lease.id}>
                <td>{lease.propertyName || "Property"}</td>
                <td>{lease.unitNumber || "—"}</td>
                <td>{lease.tenantName || "—"}</td>
                <td>{prettyLeaseStatus(lease.status)}</td>
                <td>{lease.leaseLifecycleSummary?.lifecycleLabel || "—"}</td>
                <td>{lease.paymentReadiness?.readinessLabel || "Payment readiness unavailable"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setSearchParams({})}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: view === "active" ? "#0f172a" : "#fff",
            color: view === "active" ? "#fff" : "#0f172a",
          }}
        >
          Active leases
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ view: "archived" })}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: view === "archived" ? "#0f172a" : "#fff",
            color: view === "archived" ? "#fff" : "#0f172a",
          }}
        >
          View archive
        </button>
      </div>

      <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Search leases</span>
        <input
          aria-label="Search leases"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by tenant, unit, or property"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#0f172a",
          }}
        />
      </label>

      {entitlements.loading || loading ? <div>Loading lease operations…</div> : null}
      {!entitlements.loading && !leasesEnabled ? (
        <LockedFeature
          featureKey="leases"
          ctaLabel="Upgrade to Starter"
        />
      ) : null}
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {!entitlements.loading && leasesEnabled && !loading && view === "active" && candidates.length > 0 ? (
        <div style={{ display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: 16 }}>
          <div style={{ fontWeight: 800, color: "#0f172a" }}>Occupied units missing lease records</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Units remain the occupancy source of truth. Convert these occupied reference states into real lease records only when you are ready.
          </div>
          {candidates.map((candidate) => (
            <div
              key={candidate.unitId}
              style={{
                display: "grid",
                gap: 8,
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {candidate.propertyName} · Unit {candidate.unitNumber}
                  </div>
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    {candidate.occupantName || "Occupant name missing"} · {formatCurrency(candidate.monthlyRent)}
                    {candidate.leaseEndDate ? ` · Ends ${formatDate(candidate.leaseEndDate)}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {candidate.leaseDocument?.url ? (
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      Lease document link expired and needs regeneration.
                    </span>
                  ) : null}
                  {candidate.canConvert ? (
                    <button
                      type="button"
                      aria-label={`Convert unit ${candidate.unitNumber} to lease`}
                      onClick={() => setSelectedCandidate(candidate)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#0f172a",
                      }}
                    >
                      Convert to lease
                    </button>
                  ) : (
                    <Link
                      to={buildCompleteTenantInfoHref(candidate)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#0f172a",
                        textDecoration: "none",
                      }}
                    >
                      Complete tenant info
                    </Link>
                  )}
                </div>
              </div>
              {!candidate.canConvert && candidate.blockingReasons.length > 0 ? (
                <div style={{ color: "#b45309", fontSize: 12 }}>
                  Missing: {candidate.blockingReasons.map(formatBlockingReason).join(", ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!entitlements.loading && leasesEnabled && !loading && !error && leases.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#475569",
          }}
        >
          {view === "archived" ? "No archived leases yet." : "No active leases were found for this landlord yet."}
        </div>
      ) : null}

      {!entitlements.loading && leasesEnabled && !loading && !error && leases.length > 0 && filteredLeases.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#475569",
          }}
        >
          No leases match your search.
        </div>
      ) : null}

      {!entitlements.loading && leasesEnabled && !loading && !error && filteredLeases.length > 0 && !isNarrowLayout ? (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
          <table style={{ width: "100%", minWidth: 1040, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569" }}>
                {["Property", "Unit", "Tenant", "Status", "Rent", "Term", "Actions"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 12, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeases.map((lease) => {
                return (
                  <tr key={lease.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{lease.propertyName}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{lease.id}</div>
                    </td>
                    <td style={{ padding: 12 }}>{lease.unitNumber || "—"}</td>
                    <td style={{ padding: 12 }}>
                      <div>{lease.tenantName || "Tenant not linked"}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{lease.tenantEmail || "No email on file"}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div>{statusBadge(lease.status)}</div>
                      {renderOccupancyDisplay(lease)}
                      {lease.leaseExecution ? (
                        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                            {lease.leaseExecution.executionLabel}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>
                            {executionNextActionLabel(lease.leaseExecution.requiredNextAction)}
                          </div>
                        </div>
                      ) : null}
                      {renderLifecycleSummary(lease)}
                      {renderStateCoherence(lease)}
                      {renderJurisdictionPolicyGuidance(lease)}
                      {lease.archivedAt ? (
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                          Archived {formatDate(lease.archivedAt)}
                        </div>
                      ) : null}
                      {lease.paymentReadiness ? (
                        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                            {lease.paymentReadiness.readinessLabel}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>
                            {paymentReadinessChecklist(lease)}
                          </div>
                        </div>
                      ) : null}
                      {lease.rentPaymentSummary ? (
                        <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                          {(() => {
                            const latestPaymentStatus =
                              lease.rentPaymentSummary?.latestPayment?.status ||
                              lease.rentPaymentSummary?.paymentExperience?.history?.[0]?.status ||
                              null;
                            const paymentStatusLabel = formatPaymentExperienceStatus({
                              latestPaymentStatus,
                              latestStatus: lease.rentPaymentSummary.paymentExperience?.latestStatus || null,
                            });
                            const paymentGuidance = describeRentPaymentGuidance({
                              audience: "landlord",
                              latestPaymentStatus,
                              latestStatus: lease.rentPaymentSummary.paymentExperience?.latestStatus || null,
                              blockedReason: lease.rentPaymentSummary.paymentRail.blockedReason || null,
                              paymentRailEnabled: lease.rentPaymentSummary.paymentRail.enabled,
                            });
                            return (
                              <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                            {lease.rentPaymentSummary.paymentRail.enabled ? "Rent collection enabled" : "Rent collection not enabled"}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>
                            {paymentStatusLabel}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>{paymentGuidance}</div>
                          {(lease.rentPaymentSummary.paymentExperience?.history || []).length ? (
                            <div style={{ color: "#64748b", fontSize: 12 }}>
                              {lease.rentPaymentSummary.paymentExperience.history
                                .slice(0, 2)
                                .map((entry) => prettyRentPaymentStatus(entry.status))
                                .join(" → ")}
                            </div>
                          ) : null}
                              </>
                            );
                          })()}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: 12 }}>{formatCurrency(lease.monthlyRent)}</td>
                    <td style={{ padding: 12 }}>
                      <div>{formatDate(lease.startDate)}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>to {formatDate(lease.endDate)}</div>
                    </td>
                    <td style={{ padding: 12 }}>{renderLeaseActions(lease)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!entitlements.loading && leasesEnabled && !loading && !error && filteredLeases.length > 0 && isNarrowLayout ? (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredLeases.map((lease) => (
            <div
              key={lease.id}
              data-testid="lease-mobile-card"
              style={{
                display: "grid",
                gap: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#fff",
                padding: 14,
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{lease.propertyName || "Property"}</div>
                <div style={{ color: "#475569", fontSize: 13 }}>
                  Unit {lease.unitNumber || "—"} • {lease.tenantName || "Tenant not linked"}
                </div>
              </div>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Status</div>
                  <div style={{ marginTop: 6 }}>{statusBadge(lease.status)}</div>
                  {renderOccupancyDisplay(lease)}
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Rent</div>
                  <div style={{ color: "#0f172a", fontWeight: 700, marginTop: 6 }}>{formatCurrency(lease.monthlyRent)}</div>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Term</div>
                  <div style={{ color: "#0f172a", marginTop: 6 }}>
                    {formatDate(lease.startDate)} to {formatDate(lease.endDate)}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Payment readiness</div>
                  <div style={{ color: "#0f172a", marginTop: 6 }}>
                    {lease.paymentReadiness?.readinessLabel || "Payment readiness unavailable"}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>Lifecycle</div>
                  <div style={{ color: "#0f172a", marginTop: 6 }}>
                    {lease.leaseLifecycleSummary?.lifecycleLabel || "No lifecycle status available"}
                  </div>
                </div>
              </div>
              {lease.leaseLifecycleSummary ? (
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  {lifecycleNextActionLabel(lease.leaseLifecycleSummary.requiredNextAction)}
                </div>
              ) : null}
              {lease.paymentReadiness ? (
                <div style={{ color: "#64748b", fontSize: 12 }}>{paymentReadinessChecklist(lease)}</div>
              ) : null}
              {renderStateCoherence(lease)}
              {renderJurisdictionPolicyGuidance(lease)}
              {renderLeaseActions(lease)}
            </div>
          ))}
        </div>
      ) : null}

      {selectedCandidate ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 90,
          }}
          onClick={() => !convertSaving && setSelectedCandidate(null)}
        >
          <div
            style={{
              width: "min(520px, 96vw)",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              background: "#fff",
              boxShadow: "0 20px 50px rgba(15,23,42,0.2)",
              padding: 18,
              display: "grid",
              gap: 10,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              Convert reference to lease
            </div>
            <div style={{ color: "#475569", fontSize: 13 }}>
              This creates a real lease record. The unit reference document stays as supporting context and does not remain the lease truth.
            </div>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Occupant name</span>
              <input value={occupantName} onChange={(event) => setOccupantName(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Tenant email (optional)</span>
              <input value={tenantEmail} onChange={(event) => setTenantEmail(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Tenant phone (optional)</span>
              <input
                inputMode="numeric"
                value={tenantPhone}
                onChange={(event) => setTenantPhone(normalizePhoneInput(event.target.value))}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Co-applicant email (optional)</span>
              <input value={coApplicantEmail} onChange={(event) => setCoApplicantEmail(event.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Co-applicant phone (optional)</span>
              <input
                inputMode="numeric"
                value={coApplicantPhone}
                onChange={(event) => setCoApplicantPhone(normalizePhoneInput(event.target.value))}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: isNarrowLayout ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span>Start date</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span>End date</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span>Monthly rent</span>
                <input type="number" min="0" step="0.01" value={monthlyRent} onChange={(event) => setMonthlyRent(event.target.value)} />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setSelectedCandidate(null)} disabled={convertSaving}>
                Cancel
              </button>
              <button type="button" onClick={() => void handleConvert()} disabled={convertSaving}>
                {convertSaving ? "Converting…" : "Create lease"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
