import React, { useEffect, useMemo, useRef, useState } from "react";
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
};

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
  const idempotencyKey = useRef(key());
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContext(null);
    setType("");
    idempotencyKey.current = key();
    getOccupancyResolutionContext(props)
      .then((result) => { if (!cancelled) setContext(result.context); })
      .catch((reason) => { if (!cancelled) setError((reason as ApiError)?.body?.error || "Occupancy review could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [props.open, props.propertyId, props.unitId, props.tenantId]);

  useEffect(() => { if (props.open && !loading) closeRef.current?.focus(); }, [props.open, loading]);
  const canSubmit = useMemo(() => Boolean(context && type && !submitting && (type !== "record_operational_move_out" || effectiveDate) && (type !== "link_existing_lease" || selectedLeaseId)), [context, type, submitting, effectiveDate, selectedLeaseId]);
  if (!props.open) return null;

  const submit = async () => {
    if (!context || !type || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitOccupancyResolution({ context, type, idempotencyKey: idempotencyKey.current, effectiveDate, selectedLeaseId });
      await props.onResolved?.();
      props.onClose();
    } catch (reason) {
      const apiError = reason as ApiError;
      if (apiError?.body?.freshContext) setContext(apiError.body.freshContext);
      setError(apiError?.body?.error === "occupancy_state_stale" ? "Occupancy records changed while this review was open. Review the refreshed state before trying again." : apiError?.body?.error || "Occupancy records were not changed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="presentation" onKeyDown={(event) => { if (event.key === "Escape" && !submitting) props.onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.45)", display: "flex", justifyContent: "flex-end" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="resolve-occupancy-title" style={{ width: "min(100%, 520px)", height: "100%", overflowY: "auto", background: "#fffaf1", padding: 24, boxShadow: "-12px 0 32px rgba(15,23,42,.18)", display: "grid", alignContent: "start", gap: 18 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div><h2 id="resolve-occupancy-title" style={{ margin: 0 }}>Resolve Occupancy</h2><p style={{ margin: "6px 0 0", color: "#63594d" }}>Reconcile operational records without making a legal tenancy determination.</p></div>
          <button ref={closeRef} type="button" onClick={props.onClose} disabled={submitting} aria-label="Close Resolve Occupancy">Close</button>
        </header>
        {loading ? <p>Loading current occupancy records…</p> : null}
        {error ? <div role="alert" style={{ color: "#991b1b", background: "#fef2f2", padding: 12, borderRadius: 10 }}>{error}</div> : null}
        {context ? <>
          <div><strong>{context.propertyLabel} · {context.unitLabel}</strong><div style={{ color: "#92400e", marginTop: 4 }}>Current state: Review needed</div></div>
          <section><h3>Why review is required</h3><ul>{context.canonicalState.reasons.map((reason) => <li key={reason}>{REASON_COPY[reason] || "Current occupancy records require review."}</li>)}</ul></section>
          {context.activeLeaseRequiresEndWorkflow ? <div style={{ padding: 12, background: "#fff7ed", borderRadius: 10 }}>A valid active lease still supports this occupancy. Use the existing End Lease workflow if the operational occupancy has ended.</div> : null}
          {context.eligibleResolutionTypes.length ? <fieldset style={{ border: 0, padding: 0, display: "grid", gap: 10 }}><legend style={{ fontWeight: 800, marginBottom: 8 }}>Choose a reconciliation action</legend>{context.eligibleResolutionTypes.map((option) => <label key={option} style={{ display: "flex", gap: 8 }}><input type="radio" name="occupancy-resolution" checked={type === option} onChange={() => setType(option)} />{LABELS[option]}</label>)}</fieldset> : <p>These records do not have a safe automated resolution. They will remain visible for review.</p>}
          {type === "record_operational_move_out" ? <label>Effective date<input aria-label="Operational move-out effective date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} style={{ display: "block", marginTop: 6 }} /></label> : null}
          {type === "link_existing_lease" ? <label>Existing lease<select aria-label="Existing valid lease" value={selectedLeaseId} onChange={(event) => setSelectedLeaseId(event.target.value)} style={{ display: "block", marginTop: 6, maxWidth: "100%" }}><option value="">Select a lease</option>{context.existingLeaseCandidates.map((lease) => <option key={lease.id} value={lease.id}>{lease.label} · {lease.startDate || "Unknown start"} to {lease.endDate || "No end date"}</option>)}</select></label> : null}
          {type ? <div style={{ padding: 12, background: "#f8fafc", borderRadius: 10 }}>Historical lease and relationship records remain preserved. Confirming changes operational occupancy records only and does not determine legal tenancy rights.</div> : null}
          <footer style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={props.onClose} disabled={submitting}>Review later</button>{type ? <button type="button" onClick={submit} disabled={!canSubmit}>{submitting ? "Reconciling…" : "Confirm operational reconciliation"}</button> : null}</footer>
        </> : null}
      </section>
    </div>
  );
}
