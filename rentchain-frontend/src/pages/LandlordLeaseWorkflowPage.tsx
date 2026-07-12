import React from "react";
import { Link, useParams } from "react-router-dom";
import { getLeaseById, type JurisdictionPolicyGuidance, type LandlordActiveLease } from "@/api/leasesApi";
import {
  fetchExpiringLeaseRenewals,
  type LandlordLeaseRenewalLease,
  type RenewalNoticeDraftSnapshot,
} from "@/api/landlordLeaseRenewalApi";
import {
  hasSavedRenewalInputs,
  LeaseRenewalOperatorInputsCard,
} from "@/components/leases/LeaseRenewalOperatorInputsCard";
import {
  buildRenewalNoticeReviewModel,
  buildRenewalNoticeDraftText,
  getRenewalNoticeDraftReadiness,
  LeaseRenewalNoticeDraftCard,
  RenewalNoticeDraftSnapshotCapture,
} from "@/components/leases/LeaseRenewalNoticeDraftCard";
import {
  RENEWAL_PIPELINE_BUCKETS,
  deriveRenewalPipelineItems,
  type RenewalPipelineItem,
  type RenewalPipelineTimingBucketKey,
} from "@/lib/leases/renewalPipeline";
import {
  createLandlordDecisionQueueItem,
  fetchLandlordDecisionQueue,
  updateLandlordDecisionQueueItem,
  type LandlordDecisionQueueItem,
} from "@/api/landlordDecisionQueueApi";

type WorkflowKey = "execution" | "rent-increase" | "notice" | "deposit" | "renewal" | "move-out";

type WorkflowConfig = {
  key: WorkflowKey;
  title: string;
  eyebrow: string;
  purpose: string;
  reviewItems: string[];
  policyKeys: string[];
  facts: Array<{
    label: string;
    value(lease: LandlordActiveLease): string;
  }>;
};

const workflowTheme = {
  paper: "#f7f1e7",
  card: "#fffaf1",
  cardStrong: "#fff6e8",
  border: "rgba(91, 70, 48, 0.18)",
  borderStrong: "rgba(91, 70, 48, 0.3)",
  charcoal: "#211c17",
  muted: "#63594d",
  subtle: "#7a6b5c",
  pine: "#245842",
} as const;

const WORKFLOWS: Record<WorkflowKey, WorkflowConfig> = {
  execution: {
    key: "execution",
    title: "Execution Review",
    eyebrow: "Lease execution workflow",
    purpose: "Review the lease package, signature state, and document readiness before treating execution as complete.",
    policyKeys: ["lease_execution_readiness"],
    facts: [
      { label: "Execution status", value: (lease) => lease.leaseExecution?.executionLabel || "Execution status unavailable" },
      { label: "Tenant signature", value: (lease) => lease.leaseExecution?.tenantSignatureStatus || lease.signatureStatus || "Unknown" },
      { label: "Lease document", value: (lease) => lease.leasePdfLabel || lease.leaseExecution?.pdfStatus || "Document status unavailable" },
    ],
    reviewItems: [
      "Confirm the current lease document is the intended signing package.",
      "Confirm tenant and landlord signature state before relying on execution status.",
      "Use the signing timeline and signed document download when available.",
    ],
  },
  "rent-increase": {
    key: "rent-increase",
    title: "Rent Increase Workflow",
    eyebrow: "Rent review workflow",
    purpose: "Review rent terms and jurisdiction-aware rent increase readiness before preparing any notice.",
    policyKeys: ["rent_increase_workflow_availability"],
    facts: [
      { label: "Monthly rent", value: (lease) => formatCurrency(lease.monthlyRent) },
      { label: "Lease end", value: (lease) => formatDate(lease.endDate) },
      { label: "Payment readiness", value: (lease) => lease.paymentReadiness?.readinessLabel || "Payment readiness unavailable" },
    ],
    reviewItems: [
      "Confirm the current rent amount, lease dates, and tenancy context.",
      "Verify current provincial notice timing and form requirements before sending anything.",
      "Keep rent collection setup separate from rent increase notice review.",
    ],
  },
  notice: {
    key: "notice",
    title: "Notice Workflow",
    eyebrow: "Notice readiness workflow",
    purpose: "Review notice-related lease status, lifecycle timing, and audit context before preparing a notice.",
    policyKeys: ["notice_workflow_readiness"],
    facts: [
      { label: "Lease status", value: (lease) => prettyValue(lease.status) },
      { label: "Lifecycle", value: (lease) => lifecycleStatusLabel(lease) },
      { label: "Next action", value: (lease) => prettyValue(lease.leaseLifecycleSummary?.requiredNextAction || "review lease context") },
    ],
    reviewItems: [
      "Confirm which notice type applies before preparing a document.",
      "Review lifecycle timing and recent lease events.",
      "Verify delivery requirements against current provincial rules.",
    ],
  },
  deposit: {
    key: "deposit",
    title: "Deposit Workflow",
    eyebrow: "Deposit review workflow",
    purpose: "Review deposit handling context separately from rent collection and general lease summary details.",
    policyKeys: ["deposit_workflow_review"],
    facts: [
      { label: "Property", value: (lease) => propertyLabel(lease) },
      { label: "Tenant", value: (lease) => lease.tenantName || "Tenant not linked" },
      { label: "Lease dates", value: (lease) => `${formatDate(lease.startDate)} to ${formatDate(lease.endDate)}` },
    ],
    reviewItems: [
      "Confirm any deposit terms against the signed lease package and current provincial requirements.",
      "Keep deposit review distinct from monthly rent collection setup.",
      "Use official provincial resources before making deposit deductions or claims.",
    ],
  },
  renewal: {
    key: "renewal",
    title: "Renewal Review",
    eyebrow: "Renewal workflow",
    purpose: "Review lease end timing and renewal context before deciding on renewal, continuation, or move-out next steps.",
    policyKeys: ["lease_renewal_review"],
    facts: [
      { label: "Lease end", value: (lease) => formatDate(lease.endDate) },
      { label: "Lifecycle", value: (lease) => lifecycleStatusLabel(lease) },
      { label: "Days until end", value: (lease) => daysUntilEndLabel(lease) },
    ],
    reviewItems: [
      "Confirm the lease end date and current occupancy context.",
      "Review whether renewal, continuation, or move-out planning is appropriate.",
      "Verify local requirements before preparing renewal or notice documents.",
    ],
  },
  "move-out": {
    key: "move-out",
    title: "Move-Out Prep",
    eyebrow: "Move-out workflow",
    purpose: "Review lease end, notice, inspection, and deposit context before move-out follow-through.",
    policyKeys: ["move_out_preparation"],
    facts: [
      { label: "Lease end", value: (lease) => formatDate(lease.endDate) },
      { label: "Tenant", value: (lease) => lease.tenantName || "Tenant not linked" },
      { label: "Lifecycle", value: (lease) => lifecycleStatusLabel(lease) },
    ],
    reviewItems: [
      "Confirm move-out timing and any required notice context.",
      "Review inspection and deposit follow-up separately from rent collection.",
      "Verify current provincial forms and timelines before taking action.",
    ],
  },
};

function workflowFromParam(value: string | undefined): WorkflowConfig {
  if (value && Object.prototype.hasOwnProperty.call(WORKFLOWS, value)) {
    return WORKFLOWS[value as WorkflowKey];
  }
  return WORKFLOWS.execution;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : 0;
  return amount.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
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
  return parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function prettyValue(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Not available";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function propertyLabel(lease: LandlordActiveLease) {
  const property = lease.propertyName || lease.propertyLabel || lease.propertyAddress || "Property";
  return lease.unitNumber ? `${property} · Unit ${lease.unitNumber}` : property;
}

function tenantEmailLabel(lease: LandlordActiveLease) {
  const email = String(lease.tenantEmail || "").trim();
  return email || "Tenant email unavailable";
}

function hasTenantEmail(lease: LandlordActiveLease) {
  return Boolean(String(lease.tenantEmail || "").trim());
}

function daysUntilDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const endDay = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  return Math.ceil((endDay - todayDay) / 86_400_000);
}

function lifecycleStatusLabel(lease: LandlordActiveLease) {
  const label = String(lease.leaseLifecycleSummary?.lifecycleLabel || "").trim();
  if (label) return label;
  if (lease.endDate) return "Lifecycle summary pending";
  return "Lifecycle status unavailable";
}

function daysUntilEndLabel(lease: LandlordActiveLease) {
  const summaryDays = lease.leaseLifecycleSummary?.daysUntilExpiry;
  const days = typeof summaryDays === "number" ? summaryDays : daysUntilDate(lease.endDate);
  if (typeof days !== "number") return "Not available";
  if (days < 0) return "Lease end has passed";
  if (days === 0) return "Lease ends today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function portfolioRenewalInputsPath(lease: LandlordActiveLease) {
  const params = new URLSearchParams({ entry: "lease-renewals" });
  if (lease.propertyId) params.set("propertyId", lease.propertyId);
  return `/portfolio-health?${params.toString()}`;
}

function renewalPipelineBucketLabel(value: RenewalPipelineTimingBucketKey) {
  return RENEWAL_PIPELINE_BUCKETS.find((bucket) => bucket.key === value)?.label || "Review timing";
}

function renewalSourceLeaseLabel(lease: LandlordActiveLease) {
  const unit = lease.unitLabel || lease.unitNumber || "Unit not set";
  const tenant = lease.tenantName || "Tenant not linked";
  return `Unit ${unit} · ${tenant}`;
}

function renewalSourceContextItem(lease: LandlordActiveLease): RenewalPipelineItem | null {
  return deriveRenewalPipelineItems([lease])[0] || null;
}

function looksLikeWorkflowRawIdentifier(value: string) {
  const raw = value.trim();
  if (raw.length < 12 || /\s/.test(raw)) return false;
  return /^[A-Za-z0-9_-]+$/.test(raw) && /[A-Za-z]/.test(raw) && /\d/.test(raw);
}

function workflowDisplayLabel(value: string | null | undefined, genericPattern?: RegExp) {
  const label = String(value || "").trim();
  if (!label) return null;
  if (genericPattern?.test(label)) return null;
  if (looksLikeWorkflowRawIdentifier(label)) return null;
  return label;
}

function workflowUnitLabel(lease: LandlordActiveLease) {
  const unitNumber = workflowDisplayLabel(lease.unitNumber, /^unit$/i);
  if (unitNumber) return /^unit\b/i.test(unitNumber) ? unitNumber : `Unit ${unitNumber}`;
  const unitLabel = workflowDisplayLabel(lease.unitLabel, /^unit$/i);
  if (!unitLabel) return null;
  return /^unit\b/i.test(unitLabel) ? unitLabel : `Unit ${unitLabel}`;
}

function workflowPropertyLabel(lease: LandlordActiveLease) {
  return (
    workflowDisplayLabel(lease.propertyName, /^property$/i) ||
    workflowDisplayLabel(lease.propertyLabel, /^property$/i) ||
    workflowDisplayLabel(lease.propertyAddress, /^property$/i)
  );
}

function renewalProjectionWithLeaseContext(
  projectedLease: LandlordLeaseRenewalLease,
  sourceLease: LandlordActiveLease
): LandlordLeaseRenewalLease {
  return {
    ...projectedLease,
    tenantName: workflowDisplayLabel(projectedLease.tenantName, /^tenant$/i) || workflowDisplayLabel(sourceLease.tenantName, /^tenant$/i),
    propertyAddress:
      workflowDisplayLabel(projectedLease.propertyAddress, /^property$/i) ||
      workflowDisplayLabel(sourceLease.propertyAddress, /^property$/i) ||
      null,
    propertyLabel:
      workflowDisplayLabel(projectedLease.propertyLabel, /^property$/i) ||
      workflowPropertyLabel(sourceLease) ||
      null,
    unitLabel:
      workflowDisplayLabel(projectedLease.unitLabel, /^unit$/i) ||
      workflowUnitLabel(sourceLease) ||
      null,
  };
}

function renewalProjectionFallbackFromLease(lease: LandlordActiveLease): LandlordLeaseRenewalLease {
  const projectedLease = lease as LandlordActiveLease & Partial<LandlordLeaseRenewalLease>;
  return {
    id: lease.id,
    tenantId: lease.tenantId || lease.primaryTenantId || "",
    propertyId: lease.propertyId || null,
    propertyAddress: workflowDisplayLabel(lease.propertyAddress, /^property$/i),
    unitId: lease.unitId || null,
    status: lease.status,
    leaseType: projectedLease.leaseType || "fixed_term",
    province: lease.jurisdictionProvince || projectedLease.province || "UNKNOWN",
    leaseStartDate: lease.startDate || null,
    leaseEndDate: lease.endDate || null,
    currentRent: typeof lease.monthlyRent === "number" ? lease.monthlyRent : null,
    currency: projectedLease.currency || "CAD",
    nextNoticeDueAt: projectedLease.nextNoticeDueAt || null,
    latestNoticeId: projectedLease.latestNoticeId || null,
    tenantName: workflowDisplayLabel(lease.tenantName, /^tenant$/i),
    unitLabel: workflowUnitLabel(lease),
    propertyLabel: workflowPropertyLabel(lease),
    renewalRentChangeMode: projectedLease.renewalRentChangeMode || null,
    renewalOfferedRent: typeof projectedLease.renewalOfferedRent === "number" ? projectedLease.renewalOfferedRent : null,
    renewalDecisionDeadlineAt: projectedLease.renewalDecisionDeadlineAt || null,
    renewalNewTermType: projectedLease.renewalNewTermType || null,
    renewalNewLeaseStartDate: projectedLease.renewalNewLeaseStartDate || null,
    renewalNewLeaseEndDate: projectedLease.renewalNewLeaseEndDate || null,
    renewalUpdatedAt: projectedLease.renewalUpdatedAt || null,
    updatedAt: lease.updatedAt,
    leaseLifecycleSummary: lease.leaseLifecycleSummary,
  };
}

function useRenewalLeaseProjection(lease: LandlordActiveLease) {
  const propertyId = String(lease.propertyId || "").trim();
  const [renewalLease, setRenewalLease] = React.useState<LandlordLeaseRenewalLease | null>(null);
  const [loadingRenewalInputs, setLoadingRenewalInputs] = React.useState(false);
  const [renewalInputsError, setRenewalInputsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!propertyId) {
      setRenewalLease(null);
      setLoadingRenewalInputs(false);
      setRenewalInputsError(null);
      return;
    }

    let active = true;
    (async () => {
      try {
        setLoadingRenewalInputs(true);
        setRenewalInputsError(null);
        const response = await fetchExpiringLeaseRenewals({ propertyId });
        if (!active) return;
        const renewalItems = response.items?.length ? response.items : response.data || [];
        const projectedLease = renewalItems.find((item) => item.id === lease.id);
        setRenewalLease(
          projectedLease
            ? renewalProjectionWithLeaseContext(projectedLease, lease)
            : renewalProjectionFallbackFromLease(lease)
        );
      } catch (err: unknown) {
        if (!active) return;
        setRenewalLease(null);
        setRenewalInputsError(errorMessage(err, "Failed to load renewal operator inputs."));
      } finally {
        if (active) setLoadingRenewalInputs(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [lease, propertyId]);

  return { propertyId, renewalLease, setRenewalLease, loadingRenewalInputs, renewalInputsError };
}

function RenewalWorkflowStatusPanel({ lease }: { lease: LandlordLeaseRenewalLease }) {
  const readiness = getRenewalNoticeDraftReadiness(lease);
  const saved = hasSavedRenewalInputs(lease);
  return (
    <div style={sourceContextStyle} aria-label="Renewal workflow status">
      <div style={sourceContextTitleStyle}>Renewal workflow status</div>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, margin: 0 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Operator inputs</dt>
          <dd style={sourceValueStyle}>{saved ? "Operator inputs saved" : "Operator inputs pending"}</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Tenant notice draft</dt>
          <dd style={sourceValueStyle}>{readiness.ready ? "Tenant notice draft ready" : "Review inputs before draft"}</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Notice review</dt>
          <dd style={sourceValueStyle}>Notice review pending</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Email delivery</dt>
          <dd style={sourceValueStyle}>Email delivery deferred</dd>
        </div>
      </dl>
    </div>
  );
}

function RenewalOperatorInputsWorkspace({ lease }: { lease: LandlordActiveLease }) {
  const { propertyId, renewalLease, setRenewalLease, loadingRenewalInputs, renewalInputsError } = useRenewalLeaseProjection(lease);
  const inputsRef = React.useRef<HTMLDivElement | null>(null);

  if (!propertyId) {
    return (
      <>
        <div style={sourceContextStyle} aria-label="Renewal source context">
          <div style={sourceContextTitleStyle}>Renewal source context</div>
          <div style={{ color: workflowTheme.muted, lineHeight: 1.55 }}>
            Portfolio renewal context is not available because this lease is not linked to a property.
          </div>
        </div>
        <div style={{ color: "#b91c1c", lineHeight: 1.55 }}>
          Renewal operator inputs cannot be loaded until this lease is linked to a property.
        </div>
      </>
    );
  }

  const contextItem = renewalSourceContextItem(lease);
  const sourcePath = portfolioRenewalInputsPath(lease);
  const timing = contextItem
    ? `${renewalPipelineBucketLabel(contextItem.timingBucket)} · ${contextItem.timingLabel}`
    : "Review timing unavailable";
  const status = contextItem?.statusLabel || lifecycleStatusLabel(lease);
  const explanation =
    contextItem?.detail ||
    "Review renewal planning and source context before preparing next steps. Check jurisdiction requirements before acting.";

  return (
    <>
      <div style={sourceContextStyle} aria-label="Renewal source context">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={sourceContextTitleStyle}>Renewal source context</div>
            <div style={{ color: workflowTheme.muted, lineHeight: 1.55 }}>
              Portfolio renewal context for this lease, scoped to the property source view.
            </div>
          </div>
          <Link to={sourcePath} style={{ ...buttonLinkStyle, width: "fit-content" }}>
            Open portfolio renewal view
          </Link>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, margin: 0 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <dt style={termStyle}>Property</dt>
            <dd style={sourceValueStyle}>{lease.propertyName || lease.propertyLabel || lease.propertyAddress || "Property"}</dd>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <dt style={termStyle}>Lease</dt>
            <dd style={sourceValueStyle}>{renewalSourceLeaseLabel(lease)}</dd>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <dt style={termStyle}>Lease end</dt>
            <dd style={sourceValueStyle}>{formatDate(lease.endDate)}</dd>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <dt style={termStyle}>Review timing</dt>
            <dd style={sourceValueStyle}>{timing}</dd>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <dt style={termStyle}>Renewal status</dt>
            <dd style={sourceValueStyle}>{status}</dd>
          </div>
        </dl>
        <div style={{ color: workflowTheme.muted, lineHeight: 1.55 }}>{explanation}</div>
      </div>

      {loadingRenewalInputs ? <div>Loading renewal operator inputs…</div> : null}
      {!loadingRenewalInputs && renewalInputsError ? <div style={{ color: "#b91c1c" }}>{renewalInputsError}</div> : null}
      {!loadingRenewalInputs && !renewalInputsError && renewalLease ? (
        <>
          <RenewalWorkflowStatusPanel lease={renewalLease} />
          <div ref={inputsRef} tabIndex={-1} style={{ outline: "none" }}>
            <LeaseRenewalOperatorInputsCard
              lease={renewalLease}
              onSaved={(updatedLease) => setRenewalLease(updatedLease)}
              showLifecycleSummary={false}
            />
          </div>
          <LeaseRenewalNoticeDraftCard
            lease={renewalLease}
            noticeWorkflowPath={`/leases/${encodeURIComponent(lease.id)}/workflows/notice`}
            onReviewInputs={() => {
              inputsRef.current?.focus();
              inputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </>
      ) : null}
    </>
  );
}

function RenewalNoticeDraftContextWorkspace({ lease }: { lease: LandlordActiveLease }) {
  const { propertyId, renewalLease, loadingRenewalInputs, renewalInputsError } = useRenewalLeaseProjection(lease);
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [savedDraftSnapshot, setSavedDraftSnapshot] = React.useState<RenewalNoticeDraftSnapshot | null>(null);
  const renewalPath = `/leases/${encodeURIComponent(lease.id)}/workflows/renewal`;

  async function copyDraft(draftText: string) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(draftText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = draftText;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("copy_failed");
      }
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  function downloadDraft(draftText: string) {
    const blob = new Blob([draftText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `renewal-notice-review-${lease.id}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  if (!propertyId) {
    return (
      <section style={panelStyle} aria-label="Renewal notice review">
        <ReviewWorkspaceHeader renewalPath={renewalPath} />
        <div style={noticeStatusGridStyle}>
          <NoticeStatus label="Draft readiness" value="Inputs needed" tone="warning" />
          <NoticeStatus label="Email delivery" value="Deferred" tone="deferred" />
          <NoticeStatus label="Evidence capture" value="Deferred" tone="deferred" />
        </div>
        <div style={warningPanelStyle}>
          Renewal notice review cannot load source inputs until this lease is linked to a property.
        </div>
        <TenantCommunicationSendReview
          lease={lease}
          reviewModel={null}
          draftText={null}
          readinessReady={false}
          savedSnapshot={null}
        />
      </section>
    );
  }
  if (loadingRenewalInputs) {
    return (
      <section style={panelStyle} aria-label="Renewal notice review">
        <ReviewWorkspaceHeader renewalPath={renewalPath} />
        <div>Loading renewal notice review…</div>
      </section>
    );
  }
  if (renewalInputsError) {
    return (
      <section style={panelStyle} aria-label="Renewal notice review">
        <ReviewWorkspaceHeader renewalPath={renewalPath} />
        <div style={{ color: "#b91c1c" }}>Renewal notice review could not be loaded.</div>
      </section>
    );
  }
  if (!renewalLease) {
    return (
      <section style={panelStyle} aria-label="Renewal notice review">
        <ReviewWorkspaceHeader renewalPath={renewalPath} />
        <div style={warningPanelStyle}>
          Renewal inputs are not available yet. Return to the renewal workflow before reviewing notice preparation.
        </div>
        <TenantCommunicationSendReview
          lease={lease}
          reviewModel={null}
          draftText={null}
          readinessReady={false}
          savedSnapshot={null}
        />
      </section>
    );
  }

  const readiness = getRenewalNoticeDraftReadiness(renewalLease);
  const draftText = readiness.ready ? buildRenewalNoticeDraftText(renewalLease) : null;
  const reviewModel = buildRenewalNoticeReviewModel(renewalLease);
  const statusLabel = readiness.ready
    ? "Draft ready"
    : readiness.validationMessage
      ? "Invalid renewal term dates"
      : "Inputs needed";

  return (
    <section style={panelStyle} aria-label="Renewal notice review">
      <ReviewWorkspaceHeader renewalPath={renewalPath} />

      <div style={noticeStatusGridStyle}>
        <NoticeStatus label="Draft readiness" value={statusLabel} tone={readiness.ready ? "ready" : "warning"} />
        <NoticeStatus label="Email delivery" value="Deferred" tone="deferred" />
        <NoticeStatus label="Evidence capture" value={readiness.ready ? "Available after snapshot save" : "Inputs needed"} tone={readiness.ready ? "ready" : "warning"} />
        <NoticeStatus label="Audit capture" value={readiness.ready ? "Available after snapshot save" : "Inputs needed"} tone={readiness.ready ? "ready" : "warning"} />
      </div>

      {!hasSavedRenewalInputs(renewalLease) ? (
        <div style={warningPanelStyle}>
          Save renewal operator inputs before reviewing tenant-facing notice preparation.
        </div>
      ) : null}

      {readiness.validationMessage ? <div style={warningPanelStyle}>{readiness.validationMessage}</div> : null}
      {!readiness.ready && readiness.missing.length > 0 ? (
        <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>Missing: {readiness.missing.join(", ")}.</div>
      ) : null}

      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, margin: 0 }}>
        <ReviewFact label="Tenant" value={reviewModel.tenantLabel} />
        <ReviewFact label="Unit/property" value={reviewModel.propertyUnitLabel} />
        <ReviewFact label="Current rent" value={reviewModel.currentRentLabel} />
        <ReviewFact label="Renewal rent" value={reviewModel.renewalRentLabel} />
        <ReviewFact label="Current lease end" value={reviewModel.currentLeaseEndLabel} />
        <ReviewFact label="Proposed term" value={reviewModel.proposedTermLabel} />
        <ReviewFact label="Tenant response target date" value={reviewModel.tenantResponseTargetDateLabel} />
      </dl>

      {draftText ? (
        <label style={{ display: "grid", gap: 6 }}>
          <span style={termStyle}>Tenant notice draft preview</span>
          <textarea readOnly rows={7} value={draftText} style={draftPreviewStyle} />
        </label>
      ) : (
        <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>
          The tenant notice draft is not ready yet. Return to the renewal workflow to complete or correct source inputs.
        </div>
      )}

      <div style={{ color: workflowTheme.subtle, lineHeight: 1.6 }}>
        Renewal operator inputs are the source for this draft. Review official lease documents and current provincial
        requirements before tenant communication. No notice record is created here, and email delivery remains deferred.
      </div>

      {draftText ? (
        <RenewalNoticeDraftSnapshotCapture
          lease={renewalLease}
          draftText={draftText}
          reviewModel={reviewModel}
          onSnapshotSaved={setSavedDraftSnapshot}
        />
      ) : null}

      <TenantCommunicationSendReview
        lease={lease}
        reviewModel={reviewModel}
        draftText={draftText}
        readinessReady={readiness.ready}
        savedSnapshot={savedDraftSnapshot}
      />

      <div style={noticeActionGridStyle}>
        {draftText ? (
          <>
            <button type="button" onClick={() => void copyDraft(draftText)} style={primaryButtonStyle}>
              Copy draft text
            </button>
            <button type="button" onClick={() => downloadDraft(draftText)} style={buttonStyle}>
              Download draft
            </button>
          </>
        ) : null}
        <Link to={renewalPath} style={buttonLinkStyle}>
          Return to renewal inputs
        </Link>
        {!draftText ? (
          <>
            <Link to={reviewModel.leaseEvidencePath} style={buttonLinkStyle}>
              Open lease evidence preview
            </Link>
            <Link to={reviewModel.leaseTimelinePath} style={buttonLinkStyle}>
              Open lease review timeline
            </Link>
          </>
        ) : null}
      </div>

      {copyStatus === "success" ? <div style={successTextStyle}>Draft text copied.</div> : null}
      {copyStatus === "error" ? <div style={warningTextStyle}>Draft text could not be copied. Select the preview text manually.</div> : null}

      <div style={deferredPanelStyle}>
        Notice record creation and email delivery are deferred. Saving a draft snapshot records audit context only.
      </div>
    </section>
  );
}

function TenantCommunicationSendReview({
  lease,
  reviewModel,
  draftText,
  readinessReady,
  savedSnapshot,
}: {
  lease: LandlordActiveLease;
  reviewModel: ReturnType<typeof buildRenewalNoticeReviewModel> | null;
  draftText: string | null;
  readinessReady: boolean;
  savedSnapshot: RenewalNoticeDraftSnapshot | null;
}) {
  const tenantName = reviewModel?.tenantLabel || workflowDisplayLabel(lease.tenantName, /^tenant$/i) || "Tenant name unavailable";
  const recipientEmail = tenantEmailLabel(lease);
  const recipientReady = hasTenantEmail(lease);
  const draftAvailable = Boolean(readinessReady && draftText);
  const subject = reviewModel?.propertyUnitLabel
    ? `Renewal details for ${reviewModel.propertyUnitLabel}`
    : "Renewal details for review";
  const sourceLabel = savedSnapshot
    ? "Prepared from saved renewal notice draft snapshot"
    : draftAvailable
      ? "Prepared from current renewal draft"
      : "Draft unavailable";
  const hasMultipleTenants = Array.isArray(lease.tenantIds) && lease.tenantIds.length > 1;
  const decisionSourceId = `lease:${lease.id}:renewal_notice_send_review`;
  const decisionRoute = `/leases/${encodeURIComponent(lease.id)}/workflows/notice`;
  const [approvalDecision, setApprovalDecision] = React.useState<LandlordDecisionQueueItem | null>(null);
  const [decisionLoading, setDecisionLoading] = React.useState(false);
  const [decisionSubmitting, setDecisionSubmitting] = React.useState(false);
  const [decisionNotice, setDecisionNotice] = React.useState<string | null>(null);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);
  const approvalDecisionApproved = approvalDecision?.status === "approved";

  React.useEffect(() => {
    let active = true;
    async function loadApprovalDecision() {
      if (!savedSnapshot) {
        setApprovalDecision(null);
        setDecisionLoading(false);
        setDecisionError(null);
        setDecisionNotice(null);
        return;
      }
      setDecisionLoading(true);
      setDecisionError(null);
      try {
        const response = await fetchLandlordDecisionQueue({
          limit: 5,
          sourceType: "renewal_notice_send_review",
          sourceId: decisionSourceId,
          sourceRoute: decisionRoute,
        });
        if (!active) return;
        const matchedDecision =
          response.items.find((item) => isPersistedApprovalDecisionItem(item, decisionSourceId, decisionRoute)) || null;
        setApprovalDecision(matchedDecision);
      } catch {
        if (active) setDecisionError("Approval decision could not be loaded.");
      } finally {
        if (active) setDecisionLoading(false);
      }
    }
    void loadApprovalDecision();
    return () => {
      active = false;
    };
  }, [decisionRoute, decisionSourceId, savedSnapshot]);

  async function createApprovalDecision() {
    if (!savedSnapshot || !reviewModel || decisionSubmitting) return;
    setDecisionSubmitting(true);
    setDecisionError(null);
    setDecisionNotice(null);
    try {
      const response = await createLandlordDecisionQueueItem({
        sourceType: "renewal_notice_send_review",
        sourceId: decisionSourceId,
        sourceRoute: decisionRoute,
        workspace: "notices",
        severity: "warning",
        title: "Renewal tenant communication ready for approval",
        description:
          "Saved renewal notice draft is ready for send approval review. Email delivery remains disabled until approved send infrastructure is available.",
        recommendedActionLabel: "Open notice review",
        recommendedActionHref: decisionRoute,
        status: "open",
        leaseId: lease.id,
        propertyId: lease.propertyId || null,
        unitId: lease.unitId || null,
        tenantId: lease.tenantId || (Array.isArray(lease.tenantIds) ? lease.tenantIds[0] : null) || null,
        sourceSnapshot: {
          leaseId: lease.id,
          tenantLabel: reviewModel.tenantLabel,
          propertyUnitLabel: reviewModel.propertyUnitLabel,
          currentRentLabel: reviewModel.currentRentLabel,
          renewalRentLabel: reviewModel.renewalRentLabel,
          currentLeaseEndLabel: reviewModel.currentLeaseEndLabel,
          proposedTermLabel: reviewModel.proposedTermLabel,
          tenantResponseTargetDateLabel: reviewModel.tenantResponseTargetDateLabel,
          draftSnapshotId: savedSnapshot.snapshotId,
          draftSnapshotSavedAt: savedSnapshot.savedAt,
          emailSent: false,
          noticeServed: false,
          tenantNotified: false,
        },
        metadata: {
          approvalPurpose: "future_send_review",
          draftSnapshotId: savedSnapshot.snapshotId,
          noSendBehavior: true,
          noTenantNotification: true,
          noNoticeServed: true,
          noLeaseLifecycleMutation: true,
        },
        dedupeKey: decisionSourceId,
      });
      if (!isPersistedApprovalDecisionItem(response.item, decisionSourceId, decisionRoute)) {
        throw new Error("approval_decision_source_mismatch");
      }
      setApprovalDecision(response.item);
      setDecisionNotice(response.created === false ? "Existing approval decision loaded." : "Approval decision created.");
    } catch {
      setDecisionError("Approval decision could not be created.");
    } finally {
      setDecisionSubmitting(false);
    }
  }

  async function updateApprovalDecision(action: string, successLabel: string) {
    if (!approvalDecision || decisionSubmitting) return;
    if (!isPersistedApprovalDecisionItem(approvalDecision, decisionSourceId, decisionRoute)) {
      setApprovalDecision(null);
      setDecisionError("Approval decision could not be updated. Refresh the decision state or create a new approval decision.");
      return;
    }
    setDecisionSubmitting(true);
    setDecisionError(null);
    setDecisionNotice(null);
    try {
      const response = await updateLandlordDecisionQueueItem(approvalDecision.id, {
        action,
        metadata: {
          approvalPurpose: "future_send_review",
          lastApprovalDecisionAction: action,
          noSendBehavior: true,
          noTenantNotification: true,
          noNoticeServed: true,
          noLeaseLifecycleMutation: true,
        },
      });
      if (!isPersistedApprovalDecisionItem(response.item, decisionSourceId, decisionRoute)) {
        throw new Error("approval_decision_source_mismatch");
      }
      setApprovalDecision(response.item);
      setDecisionNotice(`${successLabel} Send remains disabled.`);
    } catch (error) {
      if (String((error as Error)?.message || error).includes("decision_item_not_found")) {
        setApprovalDecision(null);
      }
      setDecisionError("Approval decision could not be updated. Refresh the decision state or create a new approval decision.");
    } finally {
      setDecisionSubmitting(false);
    }
  }

  return (
    <section style={sendReviewStyle} aria-label="Tenant communication send review">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h3 style={sendReviewHeadingStyle}>Tenant communication send review</h3>
          <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>
            Review the future send model without sending email, notifying the tenant, or creating a notice record.
          </div>
        </div>
        <span style={deferredBadgeStyle}>Send disabled</span>
      </div>

      <div style={sendReviewGridStyle}>
        <div style={sendRecipientPreviewStyle} aria-label="Recipient preview">
          <div style={sendReviewSubheadingStyle}>Recipient preview</div>
          <dl style={{ display: "grid", gap: 8, margin: 0 }}>
            <ReviewFact label="Tenant" value={tenantName} />
            <ReviewFact label="Email" value={recipientEmail} />
          </dl>
          <div style={{ color: workflowTheme.muted, lineHeight: 1.55 }}>
            {hasMultipleTenants
              ? "V1 is using the available tenant contact only. Multi-recipient review remains deferred."
              : "V1 reviews the available tenant contact only."}
          </div>
        </div>

        <div style={sendMessagePreviewStyle} aria-label="Message preview">
          <div style={sendReviewSubheadingStyle}>Message preview</div>
          <dl style={{ display: "grid", gap: 8, margin: 0 }}>
            <ReviewFact label="Subject" value={subject} />
            <ReviewFact label="Source" value={sourceLabel} />
          </dl>
          {draftText ? (
            <div style={sendBodyReferenceStyle} aria-label="Tenant communication body reference">
              Uses the renewal notice draft shown above. Exact body must be reviewed and persisted before any future send.
            </div>
          ) : (
            <div style={warningPanelStyle}>Draft body unavailable. Complete renewal inputs before future tenant communication review.</div>
          )}
          <div style={{ color: workflowTheme.subtle, lineHeight: 1.55 }}>
            The exact message body must be reviewed and persisted before any future send.
          </div>
        </div>
      </div>

      <div style={sendChecklistStyle} aria-label="Send-readiness checklist">
        <SendChecklistItem label="Renewal operator inputs saved" status={readinessReady ? "Ready" : "Needs review"} />
        <SendChecklistItem label="Draft snapshot saved" status={savedSnapshot ? "Ready" : "Needs review"} />
        <SendChecklistItem label="Tenant recipient reviewed" status={recipientReady ? "Ready" : "Needs review"} />
        <SendChecklistItem
          label="Draft body review"
          status={approvalDecisionApproved ? "Approved internally" : draftAvailable ? "Needs review" : "Deferred"}
        />
        <SendChecklistItem label="Evidence/audit capture available" status={savedSnapshot ? "Ready" : "Needs review"} />
        <SendChecklistItem
          label="Delivery status model"
          status={approvalDecisionApproved ? "Still required before live send" : "Deferred"}
        />
        <SendChecklistItem
          label="Legal-service separation"
          status={approvalDecisionApproved ? "Acknowledged for approval" : "Deferred"}
        />
      </div>

      {approvalDecisionApproved ? (
        <div style={{ color: workflowTheme.subtle, lineHeight: 1.55 }}>
          Checklist status reflects internal approval only. Live send confirmation remains deferred until tenant communication
          infrastructure is enabled.
        </div>
      ) : null}

      <fieldset disabled style={confirmationPreviewStyle} aria-label="Future send confirmation model">
        <legend style={sendReviewSubheadingStyle}>Future send confirmation model</legend>
        <div style={{ color: workflowTheme.subtle, lineHeight: 1.55 }}>
          These confirmations will be required before live tenant communication is enabled.
        </div>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" /> I have reviewed the recipient(s).
        </label>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" /> I have reviewed the message body.
        </label>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" /> I understand this would send tenant communication only.
        </label>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" /> I understand this does not establish legal notice service by itself.
        </label>
      </fieldset>

      <div style={noticeStatusGridStyle} aria-label="Delivery and legal status">
        <NoticeStatus label="Email delivery" value="Not enabled" tone="deferred" />
        <NoticeStatus label="Tenant notification" value="Not sent" tone="deferred" />
        <NoticeStatus label="Notice service" value="Not established" tone="deferred" />
        <NoticeStatus label="Legal compliance" value="Not determined by this workflow" tone="deferred" />
        <NoticeStatus label="Audit/evidence" value={savedSnapshot ? "Draft snapshot captured" : "Captured when snapshot is saved"} tone={savedSnapshot ? "ready" : "deferred"} />
      </div>

      <section style={approvalDecisionStyle} aria-label="Send approval decision">
        <div style={{ display: "grid", gap: 4 }}>
          <h4 style={sendReviewSubheadingStyle}>Approval decision</h4>
          <div style={{ color: workflowTheme.muted, lineHeight: 1.55 }}>
            Create an internal decision queue item for future send approval review. This does not send email, notify the tenant,
            serve notice, or change lease lifecycle state.
          </div>
        </div>

        {decisionLoading ? <div style={{ color: workflowTheme.muted }}>Loading approval decision…</div> : null}
        {decisionError ? <div style={warningTextStyle}>{decisionError}</div> : null}
        {decisionNotice ? <div style={successTextStyle}>{decisionNotice}</div> : null}

        {!approvalDecision && !savedSnapshot && !decisionLoading ? (
          <div style={warningPanelStyle}>Save a draft snapshot before creating a send approval decision.</div>
        ) : null}

        {!approvalDecision && savedSnapshot && !decisionLoading ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ color: workflowTheme.muted, lineHeight: 1.55 }}>
              The saved draft snapshot can now be queued for internal send approval review.
            </div>
            <button
              type="button"
              onClick={() => void createApprovalDecision()}
              disabled={decisionSubmitting}
              style={primaryButtonStyle}
            >
              {decisionSubmitting ? "Creating approval decision…" : "Create send approval decision"}
            </button>
          </div>
        ) : null}

        {approvalDecision ? (
          <div style={{ display: "grid", gap: 10 }}>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, margin: 0 }}>
              <ReviewFact label="Decision" value={approvalDecision.title} />
              <ReviewFact label="Status" value={decisionStatusLabel(approvalDecision.status)} />
              <ReviewFact label="Assignment" value={decisionAssignmentLabel(approvalDecision)} />
              <ReviewFact label="Due date" value={approvalDecision.dueAt ? formatDate(approvalDecision.dueAt) : "Not set"} />
              <ReviewFact
                label="Audit capture"
                value={approvalDecision.auditEventIds?.length ? "Decision audit captured" : "Decision queue item recorded"}
              />
            </dl>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link to="/decision-inbox" style={buttonLinkStyle}>
                Open decision inbox
              </Link>
              <Link to="/operations" style={buttonLinkStyle}>
                Open operations
              </Link>
            </div>
            <div style={decisionActionGridStyle}>
              {!approvalDecisionApproved ? (
                <button type="button" onClick={() => void updateApprovalDecision("acknowledge", "Decision acknowledged.")} disabled={decisionSubmitting} style={buttonStyle}>
                  Acknowledge
                </button>
              ) : null}
              <button type="button" onClick={() => void updateApprovalDecision("defer", "Decision deferred.")} disabled={decisionSubmitting} style={buttonStyle}>
                Defer
              </button>
              <button type="button" onClick={() => void updateApprovalDecision("return_to_draft", "Decision returned to draft review.")} disabled={decisionSubmitting} style={buttonStyle}>
                Return to draft
              </button>
              <button type="button" onClick={() => void updateApprovalDecision("mark_not_required", "Decision marked not required.")} disabled={decisionSubmitting} style={buttonStyle}>
                Mark not required
              </button>
              {!approvalDecisionApproved ? (
                <button type="button" onClick={() => void updateApprovalDecision("approve", "Future send review approved internally.")} disabled={decisionSubmitting} style={primaryButtonStyle}>
                  Approve for future send review
                </button>
              ) : null}
            </div>
            <div style={{ color: workflowTheme.subtle, lineHeight: 1.55 }}>
              {approvalDecisionApproved
                ? "Internal approval has been recorded. Send remains disabled and future send infrastructure remains required."
                : "Approved status does not enable tenant communication. Future send infrastructure remains required."}
            </div>
          </div>
        ) : null}
      </section>

      <button type="button" disabled style={sendDisabledButtonStyle}>
        Send tenant communication - not enabled yet
      </button>

      <div style={deferredPanelStyle}>
        Email delivery is not enabled in this workflow yet. Future send will require recipient confirmation, exact body
        persistence, delivery status, audit capture, and legal-service separation.
      </div>
    </section>
  );
}

type SendChecklistStatus =
  | "Ready"
  | "Needs review"
  | "Deferred"
  | "Approved internally"
  | "Acknowledged for approval"
  | "Still required before live send";

function SendChecklistItem({ label, status }: { label: string; status: SendChecklistStatus }) {
  const tone =
    status === "Ready" || status === "Approved internally" || status === "Acknowledged for approval"
      ? "ready"
      : status === "Needs review"
        ? "warning"
        : "deferred";
  return <NoticeStatus label={label} value={status} tone={tone} />;
}

function isPersistedApprovalDecisionItem(
  item: LandlordDecisionQueueItem | null | undefined,
  sourceId: string,
  sourceRoute: string
) {
  if (!item) return false;
  if (item.sourceType !== "renewal_notice_send_review") return false;
  if (item.sourceId !== sourceId) return false;
  if (item.sourceRoute && item.sourceRoute !== sourceRoute) return false;
  if (item.persistence === "derived") return false;
  if (item.id.startsWith("decision_queue:")) return false;
  return true;
}

function decisionStatusLabel(status: LandlordDecisionQueueItem["status"]) {
  const labels: Record<LandlordDecisionQueueItem["status"], string> = {
    open: "Open",
    acknowledged: "Acknowledged",
    in_review: "In review",
    pending: "Pending",
    blocked: "Blocked",
    approved: "Approved",
    returned: "Returned to draft",
    deferred: "Deferred",
    resolved: "Resolved",
    dismissed: "Not required",
  };
  return labels[status] || status;
}

function decisionAssignmentLabel(item: LandlordDecisionQueueItem) {
  const assignment = item.assignment;
  return assignment?.assignmentLabel || assignment?.assignedToEmail || assignment?.assignedToUserId || "Unassigned";
}

function ReviewWorkspaceHeader({ renewalPath }: { renewalPath: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h2 style={sectionHeadingStyle}>Renewal notice review</h2>
        <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>
          Review renewal notice preparation, source values, and safe handoff steps before any tenant communication.
        </div>
      </div>
      <Link to={renewalPath} style={buttonLinkStyle}>
        Back to renewal workflow
      </Link>
    </div>
  );
}

function NoticeStatus({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ready" | "warning" | "deferred";
}) {
  const color = tone === "ready" ? "#166534" : tone === "warning" ? "#92400e" : workflowTheme.subtle;
  return (
    <div style={noticeStatusStyle}>
      <div style={termStyle}>{label}</div>
      <div style={{ ...sourceValueStyle, color }}>{value}</div>
    </div>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <dt style={termStyle}>{label}</dt>
      <dd style={sourceValueStyle}>{value}</dd>
    </div>
  );
}

function matchingPolicy(lease: LandlordActiveLease, config: WorkflowConfig): JurisdictionPolicyGuidance | null {
  const policies = Array.isArray(lease.jurisdictionPolicies) ? lease.jurisdictionPolicies : [];
  return policies.find((policy) => config.policyKeys.includes(policy.policyKey)) || null;
}

export default function LandlordLeaseWorkflowPage() {
  const { leaseId = "", workflowKey } = useParams();
  const workflow = workflowFromParam(workflowKey);
  const [lease, setLease] = React.useState<LandlordActiveLease | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    async function load() {
      if (!leaseId) {
        setError("Missing lease id.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await getLeaseById(leaseId);
        if (!active) return;
        setLease(response.lease || null);
      } catch (err: unknown) {
        if (!active) return;
        setError(errorMessage(err, "Failed to load workflow review."));
        setLease(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [leaseId]);

  const policy = lease ? matchingPolicy(lease, workflow) : null;
  const summaryPath = lease ? `/leases/${encodeURIComponent(lease.id)}/summary` : `/leases/${encodeURIComponent(leaseId)}/summary`;
  const ledgerPath = lease ? `/leases/${encodeURIComponent(lease.id)}/ledger` : `/leases/${encodeURIComponent(leaseId)}/ledger`;

  return (
    <div data-testid="lease-workflow-page" style={workflowPageStyle}>
      <section style={workflowOverviewStyle} aria-label="Workflow overview">
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: workflowTheme.pine, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
            {workflow.eyebrow}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: 0, color: workflowTheme.charcoal }}>{workflow.title}</h1>
          <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>{workflow.purpose}</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/leases" style={buttonLinkStyle}>
            Back to leases
          </Link>
          <Link to={summaryPath} style={buttonLinkStyle}>
            Lease summary
          </Link>
          <Link to={ledgerPath} style={buttonLinkStyle}>
            Payment ledger
          </Link>
        </div>
      </section>

      {loading ? <div>Loading workflow review…</div> : null}
      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {lease ? (
        <>
          <section style={panelStyle} aria-label="Lease facts">
            <h2 style={sectionHeadingStyle}>{propertyLabel(lease)}</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, margin: 0 }}>
              {workflow.facts.map((fact) => (
                <div key={fact.label} style={{ display: "grid", gap: 4 }}>
                  <dt style={termStyle}>{fact.label}</dt>
                  <dd style={{ margin: 0, color: workflowTheme.charcoal }}>{fact.value(lease)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section style={panelStyle} aria-label="Workflow review checklist">
            <h2 style={sectionHeadingStyle}>Review before action</h2>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, color: workflowTheme.muted, lineHeight: 1.55 }}>
              {workflow.reviewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {workflow.key === "notice" ? <RenewalNoticeDraftContextWorkspace lease={lease} /> : null}

          {workflow.key === "renewal" ? (
            <section style={panelStyle} aria-label="Renewal operator inputs">
              <h2 style={sectionHeadingStyle}>Renewal operator inputs</h2>
              <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>
                Review and save unit-specific renewal inputs such as proposed rent, term dates, and tenant response target date
                before preparing tenant-facing notices.
              </div>
              <RenewalOperatorInputsWorkspace lease={lease} />
            </section>
          ) : null}

          <section style={panelStyle} aria-label="Jurisdiction context">
            <h2 style={sectionHeadingStyle}>Jurisdiction context</h2>
            <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>
              {policy ? policy.recommendation : "No specific jurisdiction policy is available for this workflow yet."}
            </div>
            <div style={{ marginTop: 10, color: workflowTheme.subtle, lineHeight: 1.6 }}>
              Workflow guidance is operational only. Verify current provincial requirements and official forms before acting.
              RentChain does not provide legal advice or guarantee enforceability.
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

const buttonLinkStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${workflowTheme.borderStrong}`,
  textDecoration: "none",
  color: workflowTheme.pine,
  background: workflowTheme.card,
  fontWeight: 700,
  boxShadow: "0 6px 16px rgba(59, 44, 28, 0.08)",
};

const buttonStyle: React.CSSProperties = {
  ...buttonLinkStyle,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: `1px solid ${workflowTheme.pine}`,
  background: workflowTheme.pine,
  color: "#fff",
};

const workflowPageStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1040,
  margin: "0 auto",
  padding: "16px",
  boxSizing: "border-box",
  display: "grid",
  gap: 16,
  border: `1px solid ${workflowTheme.border}`,
  borderRadius: 20,
  background: `radial-gradient(circle at top left, rgba(184, 130, 62, 0.14) 0, rgba(247, 241, 231, 0) 34%), linear-gradient(180deg, ${workflowTheme.card} 0%, ${workflowTheme.paper} 100%)`,
  boxShadow: "0 16px 36px rgba(59, 44, 28, 0.12)",
};

const workflowOverviewStyle: React.CSSProperties = {
  border: `1px solid ${workflowTheme.border}`,
  borderRadius: 14,
  background: workflowTheme.cardStrong,
  padding: 18,
  display: "grid",
  gap: 14,
  boxShadow: "0 10px 24px rgba(59, 44, 28, 0.08)",
};

const panelStyle: React.CSSProperties = {
  border: `1px solid ${workflowTheme.border}`,
  borderRadius: 14,
  background: workflowTheme.card,
  padding: 16,
  display: "grid",
  gap: 12,
  boxShadow: "0 8px 18px rgba(59, 44, 28, 0.07)",
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  color: workflowTheme.charcoal,
  fontSize: 18,
  letterSpacing: 0,
};

const sourceContextStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 12,
  border: `1px solid ${workflowTheme.border}`,
  borderRadius: 10,
  background: workflowTheme.cardStrong,
};

const sourceContextTitleStyle: React.CSSProperties = {
  color: workflowTheme.charcoal,
  fontWeight: 900,
};

const sourceValueStyle: React.CSSProperties = {
  margin: 0,
  color: workflowTheme.charcoal,
  fontWeight: 700,
  lineHeight: 1.35,
};

const noticeStatusGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const noticeStatusStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  border: `1px solid ${workflowTheme.border}`,
  borderRadius: 10,
  background: workflowTheme.cardStrong,
  padding: 10,
};

const sendReviewStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  border: `1px solid ${workflowTheme.border}`,
  borderRadius: 12,
  background: workflowTheme.cardStrong,
  padding: 14,
};

const sendReviewHeadingStyle: React.CSSProperties = {
  margin: 0,
  color: workflowTheme.charcoal,
  fontSize: 17,
  letterSpacing: 0,
};

const sendReviewSubheadingStyle: React.CSSProperties = {
  color: workflowTheme.charcoal,
  fontSize: 14,
  fontWeight: 900,
  margin: 0,
  letterSpacing: 0,
};

const sendReviewGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "stretch",
  gap: 12,
};

const sendReviewBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  boxSizing: "border-box",
  border: `1px solid ${workflowTheme.border}`,
  borderRadius: 10,
  background: workflowTheme.card,
  padding: 12,
};

const sendRecipientPreviewStyle: React.CSSProperties = {
  ...sendReviewBlockStyle,
  flex: "1 1 220px",
  minWidth: 220,
};

const sendMessagePreviewStyle: React.CSSProperties = {
  ...sendReviewBlockStyle,
  flex: "2 1 520px",
  minWidth: "min(100%, 420px)",
};

const sendChecklistStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const confirmationPreviewStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  margin: 0,
  border: `1px dashed ${workflowTheme.borderStrong}`,
  borderRadius: 10,
  background: "rgba(255, 250, 241, 0.72)",
  padding: 12,
  color: workflowTheme.muted,
};

const approvalDecisionStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  border: `1px solid ${workflowTheme.border}`,
  borderRadius: 10,
  background: workflowTheme.card,
  padding: 12,
};

const decisionActionGridStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  lineHeight: 1.45,
  fontWeight: 700,
};

const sendBodyReferenceStyle: React.CSSProperties = {
  boxSizing: "border-box",
  border: `1px solid ${workflowTheme.borderStrong}`,
  borderRadius: 10,
  padding: 10,
  color: workflowTheme.charcoal,
  background: "rgba(255, 250, 241, 0.82)",
  lineHeight: 1.55,
  fontWeight: 700,
};

const deferredBadgeStyle: React.CSSProperties = {
  border: `1px solid ${workflowTheme.borderStrong}`,
  borderRadius: 999,
  background: "rgba(91, 70, 48, 0.08)",
  color: workflowTheme.subtle,
  fontSize: 12,
  fontWeight: 900,
  padding: "5px 10px",
  whiteSpace: "nowrap",
};

const sendDisabledButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  width: "fit-content",
  border: `1px solid ${workflowTheme.borderStrong}`,
  background: "rgba(91, 70, 48, 0.12)",
  color: workflowTheme.subtle,
  cursor: "not-allowed",
  boxShadow: "none",
};

const noticeActionGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const warningPanelStyle: React.CSSProperties = {
  color: "#92400e",
  fontWeight: 700,
  lineHeight: 1.55,
  border: "1px solid rgba(146, 64, 14, 0.22)",
  borderRadius: 10,
  background: "rgba(254, 243, 199, 0.7)",
  padding: 10,
};

const deferredPanelStyle: React.CSSProperties = {
  color: workflowTheme.subtle,
  lineHeight: 1.55,
  border: `1px dashed ${workflowTheme.borderStrong}`,
  borderRadius: 10,
  background: "rgba(255, 250, 241, 0.65)",
  padding: 10,
};

const successTextStyle: React.CSSProperties = {
  color: "#166534",
  fontWeight: 700,
};

const warningTextStyle: React.CSSProperties = {
  color: "#92400e",
  fontWeight: 700,
};

const draftPreviewStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 160,
  boxSizing: "border-box",
  resize: "vertical",
  border: `1px solid ${workflowTheme.borderStrong}`,
  borderRadius: 10,
  padding: 10,
  color: workflowTheme.charcoal,
  background: "#fff",
  lineHeight: 1.55,
};

const termStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: workflowTheme.subtle,
  textTransform: "uppercase",
  letterSpacing: 0,
};
