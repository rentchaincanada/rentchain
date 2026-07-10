import React from "react";
import { useLocation } from "react-router-dom";
import { fetchLandlordPortfolioHealth, type LandlordPortfolioHealthSummaryV1 } from "../../api/landlordPortfolioHealthApi";
import {
  fetchExpiringLeaseRenewals,
  type LandlordLeaseRenewalLease,
} from "../../api/landlordLeaseRenewalApi";
import {
  createLeaseRenewalFormState,
  formatLeaseRenewalLocation,
  formatLifecycleNextAction,
  formatRenewalOutcome,
  LeaseRenewalOperatorInputsCard,
  type LeaseRenewalFormState,
} from "@/components/leases/LeaseRenewalOperatorInputsCard";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FeatureTeaser } from "@/components/billing/FeatureTeaser";
import { resolveRequiredPlanLabel } from "@/lib/upgradePrompt";
import { printSummaryDocument } from "../../utils/printSummary";
import PortfolioHealthStatusCard from "../../components/portfolioHealth/PortfolioHealthStatusCard";
import PortfolioHealthDimensionList from "../../components/portfolioHealth/PortfolioHealthDimensionList";
import PortfolioHealthNextFocusList from "../../components/portfolioHealth/PortfolioHealthNextFocusList";
import PortfolioFeedbackSummary from "../../components/portfolioHealth/PortfolioFeedbackSummary";

type LeaseRenewalStatusScope = "expiring" | "pending-response" | "no-response";

export default function PortfolioHealthSummaryPage() {
  const location = useLocation();
  const { showToast } = useToast();
  const {
    loading: entitlementLoading,
    canViewPortfolioHealthSummary,
    canViewPortfolioScore,
    canViewActionRecommendations,
  } = useEntitlements();
  const [summary, setSummary] = React.useState<LandlordPortfolioHealthSummaryV1 | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [renewalItems, setRenewalItems] = React.useState<LandlordLeaseRenewalLease[]>([]);
  const [renewalForms, setRenewalForms] = React.useState<Record<string, LeaseRenewalFormState>>({});
  const [renewalLoading, setRenewalLoading] = React.useState(false);
  const [renewalError, setRenewalError] = React.useState<string | null>(null);
  const entryParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const entry = entryParams.get("entry");
  const entryPropertyId = entryParams.get("propertyId");
  const entryStatus = (() => {
    const raw = String(entryParams.get("status") || "").trim().toLowerCase();
    if (raw === "expiring" || raw === "pending-response" || raw === "no-response") return raw as LeaseRenewalStatusScope;
    return null;
  })();
  const entryMessage =
    entry === "lease-renewals"
      ? entryPropertyId
        ? "Opened from decisions to review lease-renewal pressure for a specific property."
        : "Opened from decisions to review lease-renewal pressure."
      : null;
  const scopedRenewalHeading =
    entryStatus === "expiring"
      ? "Expiring soon leases"
      : entryStatus === "pending-response"
      ? "Pending response leases"
      : entryStatus === "no-response"
      ? "No response leases"
      : "Lease renewal operator inputs";
  const scopedRenewalHelper =
    entryStatus === "expiring"
      ? "Showing leases approaching notice timing so renewal inputs can be prepared before the notice window closes."
      : entryStatus === "pending-response"
      ? "Showing leases with a sent notice that are still awaiting a tenant response."
      : entryStatus === "no-response"
      ? "Showing leases where the tenant response window has elapsed without a reply."
      : "Save renewal term and deadline choices on the lease record so readiness checks can observe them canonically.";
  const renewalDisplayItems = React.useMemo(() => renewalItems, [renewalItems]);

  React.useEffect(() => {
    if (entitlementLoading || !canViewPortfolioHealthSummary) return;

    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchLandlordPortfolioHealth();
        if (!mounted) return;
        setSummary(response.portfolioHealth);
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error && err.message ? err.message : "Failed to load portfolio health summary";
        setError(message);
        showToast({
          message: "Failed to load portfolio health summary",
          description: message,
          variant: "error",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [canViewPortfolioHealthSummary, entitlementLoading, showToast]);

  React.useEffect(() => {
    if (entitlementLoading || !canViewPortfolioHealthSummary || entry !== "lease-renewals") return;

    let mounted = true;
    (async () => {
      try {
        setRenewalLoading(true);
        setRenewalError(null);
        const response = await fetchExpiringLeaseRenewals({
          propertyId: entryPropertyId,
          status: entryStatus,
        });
        if (!mounted) return;
        const items = response.items || [];
        setRenewalItems(items);
        setRenewalForms(
          items.reduce<Record<string, LeaseRenewalFormState>>((acc, item) => {
            acc[item.id] = createLeaseRenewalFormState(item);
            return acc;
          }, {})
        );
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error && err.message ? err.message : "Failed to load lease renewal inputs";
        setRenewalError(message);
        showToast({
          message: "Failed to load lease renewal inputs",
          description: message,
          variant: "error",
        });
      } finally {
        if (mounted) setRenewalLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [canViewPortfolioHealthSummary, entitlementLoading, entry, entryPropertyId, entryStatus, showToast]);

  const scorePlanLabel = resolveRequiredPlanLabel("portfolio_score") || "Pro";
  const recommendationsPlanLabel =
    resolveRequiredPlanLabel("portfolio_action_recommendations") || "Elite";

  return (
    <MacShell title="Portfolio health" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Portfolio health</h1>
              <div style={{ color: "#475569", maxWidth: 820 }}>
                Review portfolio health and open the workspace that owns each follow-through area.
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
        </Section>

        {summary ? (
          <div className="print-only print-only-summary">
            <div className="printHeader">
              <div className="printTitle">Portfolio health summary</div>
              <div className="printMeta">
                <div>Generated: {summary.generatedAt || "Current view"}</div>
                <div>Status: {summary.overall?.status || "unknown"}</div>
              </div>
            </div>
            <div className="printH3">Overview</div>
            <div>{summary.overall?.headline || summary.overall?.summary || "Portfolio health summary is not available."}</div>
            {summary.dimensions?.length ? (
              <>
                <div className="printH3">Dimensions</div>
                <table className="printTable">
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Status</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.dimensions.map((dimension) => (
                      <tr key={dimension.key}>
                        <td>{dimension.label}</td>
                        <td>{dimension.status}</td>
                        <td>{dimension.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        ) : null}

        {entryMessage ? (
          <Card style={{ borderColor: "#99f6e4", background: "#f0fdfa", color: "#115e59" }}>{entryMessage}</Card>
        ) : null}

        {entry === "lease-renewals" ? (
          <Card style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 700 }}>{scopedRenewalHeading}</div>
              <div style={{ color: "#475569" }}>{scopedRenewalHelper}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="no-print"
                onClick={() => void printSummaryDocument("lease-renewals")}
                style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #E5E7EB", background: "#FFFFFF", fontWeight: 900, cursor: "pointer" }}
              >
                Print / Save renewal view
              </button>
            </div>

            <div className="print-only print-only-lease-renewals">
              <div className="printHeader">
                <div className="printTitle">{scopedRenewalHeading}</div>
                <div className="printMeta">
                  <div>Scope: Lease renewals</div>
                  <div>Visible leases: {renewalDisplayItems.length}</div>
                </div>
              </div>
              <div>{scopedRenewalHelper}</div>
              <table className="printTable">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Tenant</th>
                    <th>Lease end</th>
                    <th>Lifecycle</th>
                    <th>Outcome</th>
                    <th>Next step</th>
                    <th>Renewal inputs</th>
                  </tr>
                </thead>
                <tbody>
                  {renewalDisplayItems.map((lease) => {
                    const form = renewalForms[lease.id] || createLeaseRenewalFormState(lease);
                    const renewalSummary = [
                      form.rentChangeMode ? `Mode: ${form.rentChangeMode.replace(/_/g, " ")}` : null,
                      form.proposedRent.trim() ? `Proposed rent: ${form.proposedRent}` : null,
                      form.newTermType ? `Term: ${form.newTermType.replace(/_/g, " ")}` : null,
                      form.responseDeadlineAt ? `Deadline: ${form.responseDeadlineAt}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <tr key={lease.id}>
                        <td>{formatLeaseRenewalLocation(lease)}</td>
                        <td>{lease.tenantName || "—"}</td>
                        <td>{lease.leaseEndDate || "unknown"}</td>
                        <td>{lease.leaseLifecycleSummary?.lifecycleLabel || "—"}</td>
                        <td>{formatRenewalOutcome(lease.leaseLifecycleSummary?.renewalOutcome)}</td>
                        <td>{formatLifecycleNextAction(lease.leaseLifecycleSummary?.requiredNextAction)}</td>
                        <td>{renewalSummary || "No renewal inputs saved"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {renewalLoading ? <div>Loading lease renewal inputs…</div> : null}
            {!renewalLoading && renewalError ? <div style={{ color: "#b91c1c" }}>{renewalError}</div> : null}
            {!renewalLoading && !renewalError && renewalDisplayItems.length === 0 ? (
              <div style={{ color: "#475569" }}>No expiring leases are currently visible for this scope.</div>
            ) : null}

            {!renewalLoading && !renewalError
              ? renewalDisplayItems.map((lease) => {
                  return (
                    <LeaseRenewalOperatorInputsCard
                      key={lease.id}
                      lease={lease}
                      formState={renewalForms[lease.id] || createLeaseRenewalFormState(lease)}
                      onFormStateChange={(leaseId, form) => {
                        setRenewalForms((current) => ({
                          ...current,
                          [leaseId]: form,
                        }));
                      }}
                      onSaved={(updatedLease) => {
                        setRenewalItems((current) => current.map((item) => (item.id === updatedLease.id ? updatedLease : item)));
                        setRenewalForms((current) => ({
                          ...current,
                          [updatedLease.id]: createLeaseRenewalFormState(updatedLease),
                        }));
                      }}
                      notify={showToast}
                    />
                  );
                })
              : null}
          </Card>
        ) : null}

        {entitlementLoading ? <Card>Loading portfolio health…</Card> : null}
        {!entitlementLoading && !canViewPortfolioHealthSummary ? (
          <Card style={{ color: "#b91c1c" }}>Portfolio health is currently unavailable for this account.</Card>
        ) : null}
        {!entitlementLoading && canViewPortfolioHealthSummary && loading ? <Card>Loading portfolio health…</Card> : null}
        {!entitlementLoading && canViewPortfolioHealthSummary && !loading && error ? (
          <Card style={{ color: "#b91c1c" }}>Failed to load portfolio health: {error}</Card>
        ) : null}

        {!entitlementLoading && canViewPortfolioHealthSummary && !loading && !error && summary ? (
          <>
            <PortfolioHealthStatusCard summary={summary} />
            <PortfolioHealthDimensionList dimensions={summary.dimensions} />
            <PortfolioFeedbackSummary summaries={summary.feedback?.summaries || []} />
            <PortfolioHealthNextFocusList nextFocus={summary.nextFocus} />
            {!canViewPortfolioScore ? (
              <FeatureTeaser
                featureKey="portfolio_score"
                eyebrow={`${scorePlanLabel} intelligence`}
                title={`Unlock Portfolio Score™ on ${scorePlanLabel}`}
                description="Move from a high-level health view into a structured portfolio score with grade, trend, and component-level context."
                ctaLabel={`Upgrade to ${scorePlanLabel}`}
              />
            ) : null}
            {canViewPortfolioScore && !canViewActionRecommendations ? (
              <FeatureTeaser
                featureKey="portfolio_action_recommendations"
                eyebrow={`${recommendationsPlanLabel} intelligence`}
                title={`Unlock recommended actions on ${recommendationsPlanLabel}`}
                description="Add prioritized landlord-safe next steps so your portfolio health and score turn into clearer daily follow-through."
                ctaLabel={`Upgrade to ${recommendationsPlanLabel}`}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
