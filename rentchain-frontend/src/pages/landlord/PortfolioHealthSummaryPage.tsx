import React from "react";
import { useLocation } from "react-router-dom";
import { fetchLandlordPortfolioHealth, type LandlordPortfolioHealthSummaryV1 } from "../../api/landlordPortfolioHealthApi";
import {
  fetchExpiringLeaseRenewals,
  saveLeaseRenewalInputs,
  type LandlordLeaseRenewalLease,
} from "../../api/landlordLeaseRenewalApi";
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

type LeaseRenewalFormState = {
  rentChangeMode: "" | "no_change" | "increase" | "decrease" | "undecided";
  proposedRent: string;
  newTermType: "" | "fixed_term" | "year_to_year" | "month_to_month";
  newLeaseStartDate: string;
  newLeaseEndDate: string;
  responseDeadlineAt: string;
};

function toDatetimeLocalInput(value: number | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDatetimeLocalInput(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function createLeaseRenewalFormState(lease: LandlordLeaseRenewalLease): LeaseRenewalFormState {
  return {
    rentChangeMode: lease.renewalRentChangeMode || "",
    proposedRent: typeof lease.renewalOfferedRent === "number" ? String(lease.renewalOfferedRent) : "",
    newTermType: lease.renewalNewTermType || "",
    newLeaseStartDate: lease.renewalNewLeaseStartDate || "",
    newLeaseEndDate: lease.renewalNewLeaseEndDate || "",
    responseDeadlineAt: toDatetimeLocalInput(lease.renewalDecisionDeadlineAt),
  };
}

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
  const [savingLeaseId, setSavingLeaseId] = React.useState<string | null>(null);
  const entryParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const entry = entryParams.get("entry");
  const entryPropertyId = entryParams.get("propertyId");
  const entryMessage =
    entry === "lease-renewals"
      ? entryPropertyId
        ? "Opened from decisions to review lease-renewal pressure for a specific property."
        : "Opened from decisions to review lease-renewal pressure."
      : null;

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
  }, [canViewPortfolioHealthSummary, entitlementLoading, entry, entryPropertyId, showToast]);

  const scorePlanLabel = resolveRequiredPlanLabel("portfolio_score") || "Pro";
  const recommendationsPlanLabel =
    resolveRequiredPlanLabel("portfolio_action_recommendations") || "Elite";

  const handleRenewalFieldChange = React.useCallback(
    (leaseId: string, field: keyof LeaseRenewalFormState, value: string) => {
      setRenewalForms((current) => ({
        ...current,
        [leaseId]: {
          ...(current[leaseId] || {
            rentChangeMode: "",
            proposedRent: "",
            newTermType: "",
            newLeaseStartDate: "",
            newLeaseEndDate: "",
            responseDeadlineAt: "",
          }),
          [field]: value,
        },
      }));
    },
    []
  );

  const handleSaveRenewalInputs = React.useCallback(
    async (leaseId: string) => {
      const form = renewalForms[leaseId];
      if (!form) return;

      try {
        setSavingLeaseId(leaseId);
        const response = await saveLeaseRenewalInputs(leaseId, {
          rentChangeMode: form.rentChangeMode || null,
          proposedRent: form.proposedRent.trim() ? Number(form.proposedRent) : null,
          newTermType: form.newTermType || null,
          newLeaseStartDate: form.newLeaseStartDate || null,
          newLeaseEndDate: form.newLeaseEndDate || null,
          responseDeadlineAt: fromDatetimeLocalInput(form.responseDeadlineAt),
        });
        setRenewalItems((current) => current.map((item) => (item.id === leaseId ? response.lease : item)));
        setRenewalForms((current) => ({
          ...current,
          [leaseId]: createLeaseRenewalFormState(response.lease),
        }));
        showToast({
          message: "Lease renewal inputs saved",
          description: "Saved values will be picked up by lease notice readiness checks.",
          variant: "success",
        });
      } catch (err: unknown) {
        const message = err instanceof Error && err.message ? err.message : "Failed to save lease renewal inputs";
        showToast({
          message: "Failed to save lease renewal inputs",
          description: message,
          variant: "error",
        });
      } finally {
        setSavingLeaseId(null);
      }
    },
    [renewalForms, showToast]
  );

  return (
    <MacShell title="Portfolio health" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Portfolio health</h1>
              <div style={{ color: "#475569", maxWidth: 820 }}>
                A high-level view of overall portfolio health, recent direction, and where follow-through may help most.
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
              <div style={{ fontWeight: 700 }}>Lease renewal operator inputs</div>
              <div style={{ color: "#475569" }}>
                Save renewal term and deadline choices on the lease record so readiness checks can observe them canonically.
              </div>
            </div>

            {renewalLoading ? <div>Loading lease renewal inputs…</div> : null}
            {!renewalLoading && renewalError ? <div style={{ color: "#b91c1c" }}>{renewalError}</div> : null}
            {!renewalLoading && !renewalError && renewalItems.length === 0 ? (
              <div style={{ color: "#475569" }}>No expiring leases are currently visible for this scope.</div>
            ) : null}

            {!renewalLoading && !renewalError
              ? renewalItems.map((lease) => {
                  const form = renewalForms[lease.id] || createLeaseRenewalFormState(lease);
                  const isSaving = savingLeaseId === lease.id;
                  return (
                    <div
                      key={lease.id}
                      style={{
                        display: "grid",
                        gap: 12,
                        padding: 16,
                        border: "1px solid #dbe4ee",
                        borderRadius: 12,
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={{ fontWeight: 700 }}>
                          {lease.propertyLabel || "Property"} {lease.unitLabel ? `• ${lease.unitLabel}` : ""}
                        </div>
                        <div style={{ color: "#475569", fontSize: 14 }}>
                          Lease ends {lease.leaseEndDate || "unknown"}{lease.tenantName ? ` • ${lease.tenantName}` : ""}
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Rent change mode</span>
                          <select
                            value={form.rentChangeMode}
                            onChange={(event) => handleRenewalFieldChange(lease.id, "rentChangeMode", event.target.value)}
                          >
                            <option value="">Unset</option>
                            <option value="no_change">No change</option>
                            <option value="increase">Increase</option>
                            <option value="decrease">Decrease</option>
                            <option value="undecided">Undecided</option>
                          </select>
                        </label>

                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Proposed rent</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.proposedRent}
                            onChange={(event) => handleRenewalFieldChange(lease.id, "proposedRent", event.target.value)}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 4 }}>
                          <span>New term type</span>
                          <select
                            value={form.newTermType}
                            onChange={(event) => handleRenewalFieldChange(lease.id, "newTermType", event.target.value)}
                          >
                            <option value="">Unset</option>
                            <option value="fixed_term">Fixed term</option>
                            <option value="year_to_year">Year to year</option>
                            <option value="month_to_month">Month to month</option>
                          </select>
                        </label>

                        <label style={{ display: "grid", gap: 4 }}>
                          <span>New lease start date</span>
                          <input
                            type="date"
                            value={form.newLeaseStartDate}
                            onChange={(event) => handleRenewalFieldChange(lease.id, "newLeaseStartDate", event.target.value)}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 4 }}>
                          <span>New lease end date</span>
                          <input
                            type="date"
                            value={form.newLeaseEndDate}
                            onChange={(event) => handleRenewalFieldChange(lease.id, "newLeaseEndDate", event.target.value)}
                          />
                        </label>

                        <label style={{ display: "grid", gap: 4 }}>
                          <span>Response deadline</span>
                          <input
                            type="datetime-local"
                            value={form.responseDeadlineAt}
                            onChange={(event) => handleRenewalFieldChange(lease.id, "responseDeadlineAt", event.target.value)}
                          />
                        </label>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => void handleSaveRenewalInputs(lease.id)} disabled={isSaving}>
                          {isSaving ? "Saving…" : "Save renewal inputs"}
                        </button>
                      </div>
                    </div>
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
