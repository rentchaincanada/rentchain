import React from "react";
import { Link, useParams } from "react-router-dom";
import { getLeaseById, type JurisdictionPolicyGuidance, type LandlordActiveLease } from "@/api/leasesApi";
import {
  fetchExpiringLeaseRenewals,
  type LandlordLeaseRenewalLease,
} from "@/api/landlordLeaseRenewalApi";
import {
  formatRenewalCurrency,
  hasSavedRenewalInputs,
  LeaseRenewalOperatorInputsCard,
} from "@/components/leases/LeaseRenewalOperatorInputsCard";
import {
  buildRenewalNoticeDraftText,
  getRenewalNoticeDraftReadiness,
  LeaseRenewalNoticeDraftCard,
} from "@/components/leases/LeaseRenewalNoticeDraftCard";
import {
  RENEWAL_PIPELINE_BUCKETS,
  deriveRenewalPipelineItems,
  type RenewalPipelineItem,
  type RenewalPipelineTimingBucketKey,
} from "@/lib/leases/renewalPipeline";

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

function formatRenewalWorkflowDate(value: string | null | undefined) {
  return formatDate(value);
}

function formatRenewalTargetDate(value: string | number | null | undefined) {
  if (!value) return "Not set";
  if (typeof value === "string") return formatRenewalWorkflowDate(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function renewalProjectionLocationLabel(lease: LandlordLeaseRenewalLease) {
  const property =
    workflowDisplayLabel(lease.propertyAddress, /^property$/i) ||
    workflowDisplayLabel(lease.propertyLabel, /^property$/i);
  const unitRaw = workflowDisplayLabel(lease.unitLabel, /^unit$/i);
  const unit = unitRaw ? (/^unit\b/i.test(unitRaw) ? unitRaw : `Unit ${unitRaw}`) : null;
  if (property && unit) return `${property} · ${unit}`;
  if (property) return property;
  if (unit) return unit;
  return "Property/unit unavailable";
}

function renewalProjectionTenantLabel(lease: LandlordLeaseRenewalLease) {
  return workflowDisplayLabel(lease.tenantName, /^tenant$/i) || "Tenant name unavailable";
}

function renewalProjectionRentLabel(lease: LandlordLeaseRenewalLease) {
  const requiresRent = lease.renewalRentChangeMode === "increase" || lease.renewalRentChangeMode === "decrease";
  if (!requiresRent) return "No rent change currently proposed";
  return formatRenewalCurrency(lease.renewalOfferedRent, lease.currency) || "Renewal rent not set";
}

function renewalProjectionTermLabel(lease: LandlordLeaseRenewalLease) {
  const start = formatRenewalWorkflowDate(lease.renewalNewLeaseStartDate);
  const end = lease.renewalNewLeaseEndDate ? formatRenewalWorkflowDate(lease.renewalNewLeaseEndDate) : "open-ended";
  return `${start} to ${end}`;
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
  const renewalPath = `/leases/${encodeURIComponent(lease.id)}/workflows/renewal`;

  if (!propertyId) return null;
  if (loadingRenewalInputs) return <div>Loading renewal notice draft context…</div>;
  if (renewalInputsError) {
    return <div style={{ color: "#b91c1c" }}>Renewal notice draft context could not be loaded.</div>;
  }
  if (!renewalLease || !hasSavedRenewalInputs(renewalLease)) return null;

  const readiness = getRenewalNoticeDraftReadiness(renewalLease);
  const draftText = readiness.ready ? buildRenewalNoticeDraftText(renewalLease) : null;

  return (
    <section style={panelStyle} aria-label="Renewal notice draft context">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={sectionHeadingStyle}>Renewal notice draft context</h2>
          <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>
            Renewal operator inputs are available for this lease. Review this context before preparing tenant-facing notice steps.
          </div>
        </div>
        <Link to={renewalPath} style={buttonLinkStyle}>
          Back to renewal workflow
        </Link>
      </div>

      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, margin: 0 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Tenant</dt>
          <dd style={sourceValueStyle}>{renewalProjectionTenantLabel(renewalLease)}</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Unit/property</dt>
          <dd style={sourceValueStyle}>{renewalProjectionLocationLabel(renewalLease)}</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Current rent</dt>
          <dd style={sourceValueStyle}>{formatRenewalCurrency(renewalLease.currentRent, renewalLease.currency) || "Current rent unavailable"}</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Renewal rent entered for review</dt>
          <dd style={sourceValueStyle}>{renewalProjectionRentLabel(renewalLease)}</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Current lease end</dt>
          <dd style={sourceValueStyle}>{formatRenewalWorkflowDate(renewalLease.leaseEndDate)}</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Proposed term</dt>
          <dd style={sourceValueStyle}>{renewalProjectionTermLabel(renewalLease)}</dd>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <dt style={termStyle}>Tenant response target date</dt>
          <dd style={sourceValueStyle}>{formatRenewalTargetDate(renewalLease.renewalDecisionDeadlineAt)}</dd>
        </div>
      </dl>

      {draftText ? (
        <label style={{ display: "grid", gap: 6 }}>
          <span style={termStyle}>Draft preview from renewal workflow</span>
          <textarea readOnly rows={7} value={draftText} style={draftPreviewStyle} />
        </label>
      ) : (
        <div style={{ color: workflowTheme.muted, lineHeight: 1.6 }}>
          Renewal operator inputs are present, but the tenant notice draft still needs review in the renewal workflow before
          tenant-facing notice steps are prepared.
        </div>
      )}

      <div style={{ color: workflowTheme.subtle, lineHeight: 1.6 }}>
        This is review context only. No notice record is created here, and email delivery remains deferred.
      </div>
    </section>
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
