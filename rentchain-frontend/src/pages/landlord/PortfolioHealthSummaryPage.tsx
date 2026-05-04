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

type LeaseRenewalValidationState = {
  proposedRent?: string | null;
};

type LeaseRenewalStatusScope = "expiring" | "pending-response" | "no-response";

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

function formatLifecycleNextAction(
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

function formatRenewalOutcome(
  value:
    | "not_started"
    | "pending_response"
    | "renewed"
    | "tenant_quitting"
    | "no_response"
    | "not_applicable"
    | undefined
) {
  switch (value) {
    case "pending_response":
      return "Pending response";
    case "renewed":
      return "Renewed";
    case "tenant_quitting":
      return "Tenant ending lease";
    case "no_response":
      return "No response";
    case "not_started":
      return "Not started";
    default:
      return "Not applicable";
  }
}

function canSetProposedRent(rentChangeMode: LeaseRenewalFormState["rentChangeMode"]) {
  return rentChangeMode === "increase" || rentChangeMode === "decrease";
}

function formatLeaseRenewalLocation(lease: LandlordLeaseRenewalLease) {
  const propertyLabel = lease.propertyAddress || lease.propertyLabel || "Property";
  return lease.unitLabel ? `${propertyLabel} • ${lease.unitLabel}` : propertyLabel;
}

function formatLeaseExpiryBadge(lease: LandlordLeaseRenewalLease) {
  return lease.leaseEndDate ? `Expires ${lease.leaseEndDate}` : "Expiry date unavailable";
}

function hasSavedRenewalInputs(lease: LandlordLeaseRenewalLease) {
  return Boolean(
    lease.renewalRentChangeMode ||
      lease.renewalOfferedRent != null ||
      lease.renewalDecisionDeadlineAt ||
      lease.renewalNewTermType ||
      lease.renewalNewLeaseStartDate ||
      lease.renewalNewLeaseEndDate
  );
}

function formatShortUpdateDate(value: string | number | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRenewalUpdatedBadge(lease: LandlordLeaseRenewalLease) {
  if (!hasSavedRenewalInputs(lease)) return null;
  const updatedAt = formatShortUpdateDate(lease.renewalUpdatedAt || lease.updatedAt);
  return updatedAt ? `Updated • ${updatedAt}` : "Updated";
}

function mapRenewalValidationMessage(errorCode: string | null | undefined) {
  switch (String(errorCode || "").trim()) {
    case "RENT_CHANGE_MODE_REQUIRED_FOR_PROPOSED_RENT":
      return "Choose Increase or Decrease before entering a proposed rent.";
    case "PROPOSED_RENT_NOT_ALLOWED_FOR_RENT_CHANGE_MODE":
      return "Proposed rent is only allowed when rent change mode is Increase or Decrease.";
    case "INVALID_PROPOSED_RENT":
      return "Enter a valid proposed rent amount.";
    case "INVALID_NEW_TERM_TYPE":
      return "Choose a valid renewal term type.";
    case "INVALID_NEW_LEASE_START_DATE":
      return "Enter a valid new lease start date.";
    case "INVALID_NEW_LEASE_END_DATE":
      return "Enter a valid new lease end date.";
    case "INVALID_RESPONSE_DEADLINE":
      return "Enter a valid response deadline.";
    default:
      return null;
  }
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
  const [renewalValidation, setRenewalValidation] = React.useState<Record<string, LeaseRenewalValidationState>>({});
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
        setRenewalValidation({});
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

  const handleRenewalFieldChange = React.useCallback(
    (leaseId: string, field: keyof LeaseRenewalFormState, value: string) => {
      setRenewalForms((current) => {
        const next = {
          ...(current[leaseId] || {
            rentChangeMode: "",
            proposedRent: "",
            newTermType: "",
            newLeaseStartDate: "",
            newLeaseEndDate: "",
            responseDeadlineAt: "",
          }),
          [field]: value,
        };
        if (field === "rentChangeMode" && !canSetProposedRent(value as LeaseRenewalFormState["rentChangeMode"])) {
          next.proposedRent = "";
        }
        return {
          ...current,
          [leaseId]: next,
        };
      });
      setRenewalValidation((current) => ({
        ...current,
        [leaseId]: {
          ...current[leaseId],
          proposedRent:
            field === "rentChangeMode" && !canSetProposedRent(value as LeaseRenewalFormState["rentChangeMode"])
              ? "Choose Increase or Decrease before entering a proposed rent."
              : null,
        },
      }));
    },
    []
  );

  const handleSaveRenewalInputs = React.useCallback(
    async (leaseId: string) => {
      const form = renewalForms[leaseId];
      if (!form) return;
      const nextValidation: LeaseRenewalValidationState = {};
      if (form.proposedRent.trim() && !canSetProposedRent(form.rentChangeMode)) {
        nextValidation.proposedRent = "Choose Increase or Decrease before entering a proposed rent.";
        setRenewalValidation((current) => ({ ...current, [leaseId]: nextValidation }));
        showToast({
          message: "Review renewal inputs",
          description: nextValidation.proposedRent,
          variant: "warning",
        });
        return;
      }

      try {
        setSavingLeaseId(leaseId);
        setRenewalValidation((current) => ({ ...current, [leaseId]: {} }));
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
        setRenewalValidation((current) => ({ ...current, [leaseId]: {} }));
        showToast({
          message: "Lease renewal inputs saved",
          description: "Saved values will be picked up by lease notice readiness checks.",
          variant: "success",
        });
      } catch (err: unknown) {
        const message = err instanceof Error && err.message ? err.message : "Failed to save lease renewal inputs";
        const friendlyMessage = mapRenewalValidationMessage(message) || mapRenewalValidationMessage((err as any)?.payload?.error) || message;
        if (
          friendlyMessage &&
          (message.includes("PROPOSED_RENT") || message.includes("RENT_CHANGE_MODE_REQUIRED_FOR_PROPOSED_RENT"))
        ) {
          setRenewalValidation((current) => ({
            ...current,
            [leaseId]: {
              ...current[leaseId],
              proposedRent: friendlyMessage,
            },
          }));
        }
        showToast({
          message: "Failed to save lease renewal inputs",
          description: friendlyMessage,
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
                  const form = renewalForms[lease.id] || createLeaseRenewalFormState(lease);
                  const validation = renewalValidation[lease.id] || {};
                  const proposedRentAllowed = canSetProposedRent(form.rentChangeMode);
                  const isSaving = savingLeaseId === lease.id;
                  const updatedBadge = formatRenewalUpdatedBadge(lease);
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
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "grid", gap: 2 }}>
                          <div style={{ fontWeight: 700 }}>
                            {formatLeaseRenewalLocation(lease)}
                          </div>
                          <div style={{ color: "#475569", fontSize: 14 }}>
                            Lease ends {lease.leaseEndDate || "unknown"}{lease.tenantName ? ` • ${lease.tenantName}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {updatedBadge ? (
                            <div
                              style={{
                                padding: "5px 10px",
                                borderRadius: 999,
                                border: "1px solid rgba(22,101,52,0.28)",
                                background: "rgba(22,101,52,0.10)",
                                color: "#166534",
                                fontSize: 12,
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {updatedBadge}
                            </div>
                          ) : null}
                          <div
                            style={{
                              padding: "5px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(245,158,11,0.35)",
                              background: "rgba(245,158,11,0.14)",
                              color: "#92400e",
                              fontSize: 12,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatLeaseExpiryBadge(lease)}
                          </div>
                        </div>
                      </div>

                      {lease.leaseLifecycleSummary ? (
                        <div style={{ display: "grid", gap: 6, color: "#334155", fontSize: 14 }}>
                          <div>
                            <strong>Lifecycle:</strong> {lease.leaseLifecycleSummary.lifecycleLabel}
                          </div>
                          <div>
                            <strong>Outcome:</strong> {formatRenewalOutcome(lease.leaseLifecycleSummary.renewalOutcome)}
                          </div>
                          <div>
                            <strong>Next step:</strong> {formatLifecycleNextAction(lease.leaseLifecycleSummary.requiredNextAction)}
                          </div>
                          {lease.leaseLifecycleSummary.history.length > 0 ? (
                            <div>
                              <strong>History:</strong>{" "}
                              {lease.leaseLifecycleSummary.history.map((item) => item.label).join(" • ")}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

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
                            disabled={!proposedRentAllowed}
                            onChange={(event) => handleRenewalFieldChange(lease.id, "proposedRent", event.target.value)}
                          />
                          <span style={{ color: validation.proposedRent ? "#b91c1c" : "#64748b", fontSize: 12 }}>
                            {validation.proposedRent || "Choose Increase or Decrease before entering a proposed rent."}
                          </span>
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
