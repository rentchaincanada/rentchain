import React from "react";
import {
  saveLeaseRenewalInputs,
  type LandlordLeaseRenewalLease,
} from "@/api/landlordLeaseRenewalApi";

export type LeaseRenewalFormState = {
  rentChangeMode: "" | "no_change" | "increase" | "decrease" | "undecided";
  proposedRent: string;
  newTermType: "" | "fixed_term" | "year_to_year" | "month_to_month";
  newLeaseStartDate: string;
  newLeaseEndDate: string;
  responseDeadlineAt: string;
};

export type LeaseRenewalValidationState = {
  proposedRent?: string | null;
};

export type LeaseRenewalToast = {
  message: string;
  description?: string;
  variant: "success" | "error" | "warning";
};

type LeaseRenewalOperatorInputsCardProps = {
  lease: LandlordLeaseRenewalLease;
  formState?: LeaseRenewalFormState;
  onFormStateChange?: (leaseId: string, form: LeaseRenewalFormState) => void;
  onSaved?: (lease: LandlordLeaseRenewalLease) => void;
  notify?: (toast: LeaseRenewalToast) => void;
};

export function toDatetimeLocalInput(value: number | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromDatetimeLocalInput(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createLeaseRenewalFormState(lease: LandlordLeaseRenewalLease): LeaseRenewalFormState {
  return {
    rentChangeMode: lease.renewalRentChangeMode || "",
    proposedRent: typeof lease.renewalOfferedRent === "number" ? String(lease.renewalOfferedRent) : "",
    newTermType: lease.renewalNewTermType || "",
    newLeaseStartDate: lease.renewalNewLeaseStartDate || "",
    newLeaseEndDate: lease.renewalNewLeaseEndDate || "",
    responseDeadlineAt: toDatetimeLocalInput(lease.renewalDecisionDeadlineAt),
  };
}

export function formatLifecycleNextAction(
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

export function formatRenewalOutcome(
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

export function canSetProposedRent(rentChangeMode: LeaseRenewalFormState["rentChangeMode"]) {
  return rentChangeMode === "increase" || rentChangeMode === "decrease";
}

export function formatLeaseRenewalLocation(lease: LandlordLeaseRenewalLease) {
  const propertyLabel = lease.propertyAddress || lease.propertyLabel || "Property";
  return lease.unitLabel ? `${propertyLabel} • ${lease.unitLabel}` : propertyLabel;
}

export function formatLeaseExpiryBadge(lease: LandlordLeaseRenewalLease) {
  return lease.leaseEndDate ? `Expires ${lease.leaseEndDate}` : "Expiry date unavailable";
}

export function hasSavedRenewalInputs(lease: LandlordLeaseRenewalLease) {
  return Boolean(
    lease.renewalRentChangeMode ||
      lease.renewalOfferedRent != null ||
      lease.renewalDecisionDeadlineAt ||
      lease.renewalNewTermType ||
      lease.renewalNewLeaseStartDate ||
      lease.renewalNewLeaseEndDate
  );
}

export function formatShortUpdateDate(value: string | number | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRenewalUpdatedBadge(lease: LandlordLeaseRenewalLease) {
  if (!hasSavedRenewalInputs(lease)) return null;
  const updatedAt = formatShortUpdateDate(lease.renewalUpdatedAt || lease.updatedAt);
  return updatedAt ? `Updated • ${updatedAt}` : "Updated";
}

export function mapRenewalValidationMessage(errorCode: string | null | undefined) {
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

export function LeaseRenewalOperatorInputsCard({
  lease,
  formState,
  onFormStateChange,
  onSaved,
  notify,
}: LeaseRenewalOperatorInputsCardProps) {
  const [localLease, setLocalLease] = React.useState(lease);
  const [internalForm, setInternalForm] = React.useState(() => createLeaseRenewalFormState(lease));
  const [validation, setValidation] = React.useState<LeaseRenewalValidationState>({});
  const [saving, setSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ variant: "success" | "error" | "warning"; text: string } | null>(null);

  React.useEffect(() => {
    setLocalLease(lease);
    setInternalForm(createLeaseRenewalFormState(lease));
    setValidation({});
  }, [lease]);

  const form = formState || internalForm;
  const proposedRentAllowed = canSetProposedRent(form.rentChangeMode);
  const updatedBadge = formatRenewalUpdatedBadge(localLease);

  function updateForm(field: keyof LeaseRenewalFormState, value: string) {
    const next = {
      ...form,
      [field]: value,
    };
    if (field === "rentChangeMode" && !canSetProposedRent(value as LeaseRenewalFormState["rentChangeMode"])) {
      next.proposedRent = "";
    }
    if (onFormStateChange) {
      onFormStateChange(lease.id, next);
    } else {
      setInternalForm(next);
    }
    setValidation((current) => ({
      ...current,
      proposedRent:
        field === "rentChangeMode" && !canSetProposedRent(value as LeaseRenewalFormState["rentChangeMode"])
          ? "Choose Increase or Decrease before entering a proposed rent."
          : null,
    }));
    setStatusMessage(null);
  }

  async function handleSave() {
    const nextValidation: LeaseRenewalValidationState = {};
    if (form.proposedRent.trim() && !canSetProposedRent(form.rentChangeMode)) {
      nextValidation.proposedRent = "Choose Increase or Decrease before entering a proposed rent.";
      setValidation(nextValidation);
      setStatusMessage({ variant: "warning", text: nextValidation.proposedRent });
      notify?.({
        message: "Review renewal inputs",
        description: nextValidation.proposedRent,
        variant: "warning",
      });
      return;
    }

    try {
      setSaving(true);
      setValidation({});
      setStatusMessage(null);
      const response = await saveLeaseRenewalInputs(lease.id, {
        rentChangeMode: form.rentChangeMode || null,
        proposedRent: form.proposedRent.trim() ? Number(form.proposedRent) : null,
        newTermType: form.newTermType || null,
        newLeaseStartDate: form.newLeaseStartDate || null,
        newLeaseEndDate: form.newLeaseEndDate || null,
        responseDeadlineAt: fromDatetimeLocalInput(form.responseDeadlineAt),
      });
      const savedForm = createLeaseRenewalFormState(response.lease);
      setLocalLease(response.lease);
      if (onFormStateChange) {
        onFormStateChange(lease.id, savedForm);
      } else {
        setInternalForm(savedForm);
      }
      setValidation({});
      onSaved?.(response.lease);
      setStatusMessage({ variant: "success", text: "Lease renewal inputs saved." });
      notify?.({
        message: "Lease renewal inputs saved",
        description: "Saved values will be picked up by lease notice readiness checks.",
        variant: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : "Failed to save lease renewal inputs";
      const payloadError = typeof (err as { payload?: { error?: unknown } })?.payload?.error === "string"
        ? (err as { payload: { error: string } }).payload.error
        : null;
      const friendlyMessage = mapRenewalValidationMessage(message) || mapRenewalValidationMessage(payloadError) || message;
      if (
        friendlyMessage &&
        (message.includes("PROPOSED_RENT") || message.includes("RENT_CHANGE_MODE_REQUIRED_FOR_PROPOSED_RENT"))
      ) {
        setValidation((current) => ({
          ...current,
          proposedRent: friendlyMessage,
        }));
      }
      setStatusMessage({ variant: "error", text: `Failed to save renewal inputs: ${friendlyMessage}` });
      notify?.({
        message: "Failed to save lease renewal inputs",
        description: friendlyMessage,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 700 }}>{formatLeaseRenewalLocation(localLease)}</div>
          <div style={{ color: "#475569", fontSize: 14 }}>
            Lease ends {localLease.leaseEndDate || "unknown"}{localLease.tenantName ? ` • ${localLease.tenantName}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {updatedBadge ? <Badge tone="success">{updatedBadge}</Badge> : null}
          <Badge tone="warning">{formatLeaseExpiryBadge(localLease)}</Badge>
        </div>
      </div>

      {localLease.leaseLifecycleSummary ? (
        <div style={{ display: "grid", gap: 6, color: "#334155", fontSize: 14 }}>
          <div>
            <strong>Lifecycle:</strong> {localLease.leaseLifecycleSummary.lifecycleLabel}
          </div>
          <div>
            <strong>Outcome:</strong> {formatRenewalOutcome(localLease.leaseLifecycleSummary.renewalOutcome)}
          </div>
          <div>
            <strong>Next step:</strong> {formatLifecycleNextAction(localLease.leaseLifecycleSummary.requiredNextAction)}
          </div>
          {localLease.leaseLifecycleSummary.history.length > 0 ? (
            <div>
              <strong>History:</strong>{" "}
              {localLease.leaseLifecycleSummary.history.map((item) => item.label).join(" • ")}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label style={fieldStyle}>
          <span>Rent change mode</span>
          <select value={form.rentChangeMode} onChange={(event) => updateForm("rentChangeMode", event.target.value)}>
            <option value="">Unset</option>
            <option value="no_change">No change</option>
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
            <option value="undecided">Undecided</option>
          </select>
        </label>

        <label style={fieldStyle}>
          <span>Proposed rent</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.proposedRent}
            disabled={!proposedRentAllowed}
            onChange={(event) => updateForm("proposedRent", event.target.value)}
          />
          <span style={{ color: validation.proposedRent ? "#b91c1c" : "#64748b", fontSize: 12 }}>
            {validation.proposedRent || "Choose Increase or Decrease before entering a proposed rent."}
          </span>
        </label>

        <label style={fieldStyle}>
          <span>New term type</span>
          <select value={form.newTermType} onChange={(event) => updateForm("newTermType", event.target.value)}>
            <option value="">Unset</option>
            <option value="fixed_term">Fixed term</option>
            <option value="year_to_year">Year to year</option>
            <option value="month_to_month">Month to month</option>
          </select>
        </label>

        <label style={fieldStyle}>
          <span>New lease start date</span>
          <input type="date" value={form.newLeaseStartDate} onChange={(event) => updateForm("newLeaseStartDate", event.target.value)} />
        </label>

        <label style={fieldStyle}>
          <span>New lease end date</span>
          <input type="date" value={form.newLeaseEndDate} onChange={(event) => updateForm("newLeaseEndDate", event.target.value)} />
        </label>

        <label style={fieldStyle}>
          <span>Response deadline</span>
          <input type="datetime-local" value={form.responseDeadlineAt} onChange={(event) => updateForm("responseDeadlineAt", event.target.value)} />
        </label>
      </div>

      {statusMessage ? (
        <div style={{ color: statusMessage.variant === "error" ? "#b91c1c" : statusMessage.variant === "warning" ? "#92400e" : "#166534" }}>
          {statusMessage.text}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save renewal inputs"}
        </button>
      </div>
    </div>
  );
}

function Badge({ children, tone }: React.PropsWithChildren<{ tone: "success" | "warning" }>) {
  const success = tone === "success";
  return (
    <div
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        border: success ? "1px solid rgba(22,101,52,0.28)" : "1px solid rgba(245,158,11,0.35)",
        background: success ? "rgba(22,101,52,0.10)" : "rgba(245,158,11,0.14)",
        color: success ? "#166534" : "#92400e",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
  border: "1px solid #dbe4ee",
  borderRadius: 12,
  background: "#fff",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};
