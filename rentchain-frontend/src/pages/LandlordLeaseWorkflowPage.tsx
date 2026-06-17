import React from "react";
import { Link, useParams } from "react-router-dom";
import { getLeaseById, type JurisdictionPolicyGuidance, type LandlordActiveLease } from "@/api/leasesApi";

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
      { label: "Lifecycle", value: (lease) => lease.leaseLifecycleSummary?.lifecycleLabel || "Lifecycle status unavailable" },
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
      { label: "Lifecycle", value: (lease) => lease.leaseLifecycleSummary?.lifecycleLabel || "Lifecycle status unavailable" },
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
      { label: "Lifecycle", value: (lease) => lease.leaseLifecycleSummary?.lifecycleLabel || "Lifecycle status unavailable" },
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

function daysUntilEndLabel(lease: LandlordActiveLease) {
  const days = lease.leaseLifecycleSummary?.daysUntilExpiry;
  if (typeof days !== "number") return "Not available";
  if (days < 0) return "Lease end has passed";
  if (days === 0) return "Lease ends today";
  return `${days} days`;
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
    <div style={{ display: "grid", gap: 16, maxWidth: 920 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
          {workflow.eyebrow}
        </div>
        <h1 style={{ margin: 0, fontSize: 26, letterSpacing: 0, color: "#0f172a" }}>{workflow.title}</h1>
        <div style={{ color: "#475569", lineHeight: 1.6 }}>{workflow.purpose}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link to="/leases" style={buttonLinkStyle}>
          Back to leases
        </Link>
        <Link to={summaryPath} style={buttonLinkStyle}>
          Lease summary
        </Link>
        <Link to={ledgerPath} style={buttonLinkStyle}>
          Ledger
        </Link>
      </div>

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
                  <dd style={{ margin: 0, color: "#0f172a" }}>{fact.value(lease)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section style={panelStyle} aria-label="Workflow review checklist">
            <h2 style={sectionHeadingStyle}>Review before action</h2>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, color: "#334155", lineHeight: 1.55 }}>
              {workflow.reviewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section style={panelStyle} aria-label="Jurisdiction context">
            <h2 style={sectionHeadingStyle}>Jurisdiction context</h2>
            <div style={{ color: "#334155", lineHeight: 1.6 }}>
              {policy ? policy.recommendation : "No specific jurisdiction policy is available for this workflow yet."}
            </div>
            <div style={{ marginTop: 10, color: "#475569", lineHeight: 1.6 }}>
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
  border: "1px solid #cbd5e1",
  textDecoration: "none",
  color: "#0f172a",
  background: "#fff",
  fontWeight: 700,
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #dbe4ee",
  borderRadius: 8,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 12,
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
  letterSpacing: 0,
};

const termStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0,
};
