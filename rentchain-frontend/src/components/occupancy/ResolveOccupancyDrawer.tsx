import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getOccupancyResolutionContext,
  submitOccupancyResolution,
  type OccupancyResolutionContext,
  type OccupancyResolutionType,
} from "@/api/occupancyResolutionApi";
import type { ApiError } from "@/api/http";

const REASON_COPY: Record<string, string> = {
  MULTIPLE_CURRENT_LEASES: "More than one lease could support current occupancy. RentChain will not select one automatically.",
  INVALID_LEASE_DATE_RANGE: "A lease has contradictory start and end dates.",
  CURRENT_LEASE_CONTEXT_MISMATCH: "A lease or pointer does not match this property, unit, or tenant.",
  DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY: "A draft lease cannot support current occupancy.",
  UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY: "An upcoming lease does not yet support current occupancy.",
  PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY: "A past lease does not by itself establish current occupancy or vacancy.",
  ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY: "An ended lease cannot support current occupancy.",
  LEASE_EXECUTION_INCOMPLETE: "Lease execution is incomplete.",
  OCCUPIED_WITHOUT_CURRENT_LEASE: "Current records show occupancy without a lease that can support it.",
  VACANT_WITH_CURRENT_LEASE: "Current records show vacancy while a valid current lease exists.",
  STALE_CURRENT_LEASE_POINTER: "A current lease pointer no longer matches the canonical lease state.",
  TENANT_CURRENT_WITHOUT_CURRENT_LEASE: "The tenant is marked current without a current supporting lease.",
};

const LABELS: Record<OccupancyResolutionType, string> = {
  record_operational_move_out: "Record operational move-out",
  clear_stale_occupancy_record: "Correct stale occupancy records",
  link_existing_lease: "Link an existing valid lease",
  resolve_multiple_current_leases: "Select the lease that supports current occupancy",
};

const OCCUPANCY_ERROR_COPY: Record<string, string> = {
  occupancy_state_stale: "Occupancy records changed while this review was open. Review the refreshed state before trying again.",
  embedded_unit_ambiguous: "The occupancy records for this unit do not match cleanly. Review the unit and lease records before trying again.",
  unit_context_ambiguous: "The unit records do not identify one safe occupancy context. Review the unit and lease records before trying again.",
  end_lease_workflow_required: "A valid active lease still supports this occupancy. Use the existing End Lease workflow if the operational occupancy has ended.",
  resolution_not_applicable: "This reconciliation action no longer applies to the current occupancy records. Review the latest state before trying again.",
  selected_lease_not_eligible: "The selected lease can no longer support this reconciliation. Review the available lease records before trying again.",
  multiple_current_no_longer_present: "The multiple-lease conflict changed while this review was open. Review the refreshed state before trying again.",
  candidate_participant_context_ambiguous: "The conflicting lease participants cannot be verified safely. Review the tenant and lease records before trying again.",
  occupancy_projection_context_ambiguous: "The current unit pointers do not match the conflicting leases safely. Review the occupancy records before trying again.",
  selected_tenancy_context_ambiguous: "The selected lease has ambiguous active tenancy records. Review those records before trying again.",
  unsafe_canonical_postcondition: "RentChain could not verify a safe occupancy result, so no records were changed. Review the current records before trying again.",
  idempotency_key_reused: "This request changed after an earlier attempt. Review the latest state, then start a new reconciliation.",
  confirmation_required: "Confirm the operational reconciliation before submitting it.",
  effective_date_required: "Enter an effective date before recording an operational move-out.",
  tenant_required_for_move_out: "A tenant record is required to record an operational move-out. Review the current occupancy records.",
  property_not_found: "This property is no longer available. Close this review and refresh the workspace.",
  unit_not_found: "This unit is no longer available. Close this review and refresh the workspace.",
  tenant_not_found: "The tenant record is no longer available. Close this review and refresh the workspace.",
  forbidden: "You do not have access to review this occupancy.",
  "upgrade required": "Your current plan does not include this occupancy workflow.",
};

const OCCUPANCY_ERROR_FALLBACK = "We couldn't complete this occupancy reconciliation. Review the current records and try again.";

function occupancyErrorMessage(error: unknown, fallback = OCCUPANCY_ERROR_FALLBACK): string {
  const code = String((error as ApiError | null)?.body?.error || "").trim().toLowerCase();
  return OCCUPANCY_ERROR_COPY[code] || fallback;
}

function key() {
  return globalThis.crypto?.randomUUID?.() || `occupancy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ResolveOccupancyDrawer(props: {
  open: boolean;
  propertyId: string;
  unitId: string;
  tenantId?: string | null;
  onClose: () => void;
  onResolved?: () => void | Promise<void>;
}) {
  const [context, setContext] = useState<OccupancyResolutionContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<OccupancyResolutionType | "">("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [multipleCurrentAcknowledged, setMultipleCurrentAcknowledged] = useState(false);
  const idempotencyKey = useRef(key());
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContext(null);
    setType("");
    setSelectedLeaseId("");
    setMultipleCurrentAcknowledged(false);
    idempotencyKey.current = key();
    getOccupancyResolutionContext(props)
      .then((result) => { if (!cancelled) setContext(result.context); })
      .catch((reason) => { if (!cancelled) setError(occupancyErrorMessage(reason, "Occupancy review could not be loaded. Close this review and try again.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [props.open, props.propertyId, props.unitId, props.tenantId]);

  useEffect(() => {
    if (!props.open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [props.open]);

  useEffect(() => { if (props.open && !loading) closeRef.current?.focus(); }, [props.open, loading]);
  const canSubmit = useMemo(() => Boolean(
    context
    && type
    && !submitting
    && (type !== "record_operational_move_out" || effectiveDate)
    && (type !== "link_existing_lease" || selectedLeaseId)
    && (type !== "resolve_multiple_current_leases" || (selectedLeaseId && multipleCurrentAcknowledged))
  ), [context, type, submitting, effectiveDate, selectedLeaseId, multipleCurrentAcknowledged]);
  if (!props.open) return null;

  const restoreFocus = () => {
    window.setTimeout(() => {
      const opener = openerRef.current;
      if (opener?.isConnected && !opener.hasAttribute("disabled")) {
        opener.focus();
        return;
      }
      const fallback = document.querySelector<HTMLElement>(
        "[data-occupancy-focus-fallback], main, [role=main], h1"
      );
      if (fallback) {
        if (!fallback.hasAttribute("tabindex")) fallback.setAttribute("tabindex", "-1");
        fallback.focus();
      }
    }, 0);
  };

  const close = () => {
    props.onClose();
    restoreFocus();
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !submitting) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1
      : activeIndex < 0 || activeIndex === focusable.length - 1 ? 0 : activeIndex + 1;
    event.preventDefault();
    focusable[nextIndex].focus();
  };

  const submit = async () => {
    if (!context || !type || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitOccupancyResolution({ context, type, idempotencyKey: idempotencyKey.current, effectiveDate, selectedLeaseId });
      await props.onResolved?.();
      close();
    } catch (reason) {
      const apiError = reason as ApiError;
      if (apiError?.body?.freshContext) {
        setContext(apiError.body.freshContext);
        setType("");
        setSelectedLeaseId("");
        setMultipleCurrentAcknowledged(false);
        idempotencyKey.current = key();
      }
      setError(occupancyErrorMessage(apiError));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal((
    <div role="presentation" style={{ position: "fixed", inset: 0, zIndex: 4030, background: "rgba(15,23,42,.45)", display: "flex", justifyContent: "flex-end" }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="resolve-occupancy-title" tabIndex={-1} onKeyDown={handleDialogKeyDown} style={{ width: "min(100%, 520px)", maxWidth: "100vw", height: "100dvh", maxHeight: "100dvh", boxSizing: "border-box", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", background: "#fffaf1", padding: 24, boxShadow: "-12px 0 32px rgba(15,23,42,.18)", display: "grid", alignContent: "start", gap: 18 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div><h2 id="resolve-occupancy-title" style={{ margin: 0 }}>Resolve Occupancy</h2><p style={{ margin: "6px 0 0", color: "#63594d" }}>Reconcile operational records without making a legal tenancy determination.</p></div>
          <button ref={closeRef} type="button" onClick={close} disabled={submitting} aria-label="Close Resolve Occupancy">Close</button>
        </header>
        {loading ? <p>Loading current occupancy records…</p> : null}
        {error ? <div role="alert" style={{ color: "#991b1b", background: "#fef2f2", padding: 12, borderRadius: 10 }}>{error}</div> : null}
        {context ? <>
          <div><strong>{context.propertyLabel} · {context.unitLabel}</strong><div style={{ color: "#92400e", marginTop: 4 }}>Current state: Review needed</div></div>
          <section><h3>Why review is required</h3><ul>{context.canonicalState.reasons.map((reason) => <li key={reason}>{REASON_COPY[reason] || "Current occupancy records require review."}</li>)}</ul></section>
          {context.activeLeaseRequiresEndWorkflow ? <div style={{ padding: 12, background: "#fff7ed", borderRadius: 10 }}>A valid active lease still supports this occupancy. Use the existing End Lease workflow if the operational occupancy has ended.</div> : null}
          {context.eligibleResolutionTypes.length ? <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 10 }}><legend style={{ fontWeight: 800, marginBottom: 8 }}>Choose a reconciliation action</legend>{context.eligibleResolutionTypes.map((option) => <label key={option} style={{ display: "flex", gap: 8 }}><input type="radio" name="occupancy-resolution" checked={type === option} onChange={() => { setType(option); setSelectedLeaseId(""); setMultipleCurrentAcknowledged(false); }} />{LABELS[option]}</label>)}</fieldset> : <p>These records do not have a safe automated resolution. They will remain visible for review.</p>}
          {type === "record_operational_move_out" ? <label>Effective date<input aria-label="Operational move-out effective date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} style={{ display: "block", marginTop: 6 }} /></label> : null}
          {type === "link_existing_lease" ? <label>Existing lease<select aria-label="Existing valid lease" value={selectedLeaseId} onChange={(event) => setSelectedLeaseId(event.target.value)} style={{ display: "block", marginTop: 6, maxWidth: "100%" }}><option value="">Select a lease</option>{context.existingLeaseCandidates.map((lease) => <option key={lease.id} value={lease.id}>{lease.label} · {lease.startDate || "Unknown start"} to {lease.endDate || "No end date"}</option>)}</select></label> : null}
          {type === "resolve_multiple_current_leases" ? <section aria-labelledby="multiple-current-heading" style={{ display: "grid", gap: 12 }}>
            <div><h3 id="multiple-current-heading" style={{ marginBottom: 6 }}>Multiple current leases found</h3><p style={{ margin: 0 }}>RentChain cannot determine which agreement should represent current occupancy. Review every candidate and explicitly select the occupancy-supporting lease.</p></div>
            <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 10 }}><legend style={{ fontWeight: 800, marginBottom: 8 }}>Occupancy-supporting lease</legend>{context.existingLeaseCandidates.map((lease, index) => <label key={lease.id} style={{ display: "grid", gap: 5, padding: 12, border: "1px solid #d6c9b8", borderRadius: 10, background: selectedLeaseId === lease.id ? "#f0fdf4" : "#fff" }}><span style={{ display: "flex", gap: 8, fontWeight: 800 }}><input type="radio" name="multiple-current-lease" checked={selectedLeaseId === lease.id} onChange={() => setSelectedLeaseId(lease.id)} />Lease option {index + 1} · {lease.reference}</span><span>{lease.participantNames.join(", ") || "Tenant record"}</span><span>{lease.startDate || "Unknown start"} to {lease.endDate || "No end date"} · {lease.executionStatus || "Execution state unavailable"}</span><span>{lease.activeTenancyCount} active occupancy {lease.activeTenancyCount === 1 ? "record" : "records"}</span></label>)}</fieldset>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" checked={multipleCurrentAcknowledged} onChange={(event) => setMultipleCurrentAcknowledged(event.target.checked)} />I understand this selection changes RentChain&apos;s occupancy record and does not by itself determine the legal validity or termination of another lease.</label>
          </section> : null}
          {type ? <div style={{ padding: 12, background: "#f8fafc", borderRadius: 10 }}>Historical lease and relationship records remain preserved. Confirming changes operational occupancy records only and does not determine legal tenancy rights.</div> : null}
          <footer style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={close} disabled={submitting}>Review later</button>{type ? <button type="button" onClick={submit} disabled={!canSubmit}>{submitting ? "Reconciling…" : "Confirm operational reconciliation"}</button> : null}</footer>
        </> : null}
      </section>
    </div>
  ), document.body);
}
