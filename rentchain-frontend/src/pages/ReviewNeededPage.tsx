import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { getOccupancyReviewWorkspace, type OccupancyReviewItem, type OccupancyReviewReason, type OccupancyReviewWorkspace } from "@/api/occupancyReviewApi";
import { getOccupancyStartContext } from "@/api/occupancyStartApi";
import { submitStaleTenantRelationshipResolution } from "@/api/occupancyResolutionApi";
import { ResolveOccupancyDrawer } from "@/components/occupancy/ResolveOccupancyDrawer";
import { StartOccupancyDrawer } from "@/components/occupancy/StartOccupancyDrawer";
import "./ReviewNeededPage.css";

type Filter = "all" | OccupancyReviewItem["category"];
const REASON_COPY: Record<OccupancyReviewReason, { title: string; explanation: string }> = {
  MULTIPLE_CURRENT_LEASES: { title: "Multiple current leases", explanation: "More than one lease currently claims this occupancy context. Choose the operationally supporting lease in Resolve Occupancy." },
  INVALID_LEASE_DATE_RANGE: { title: "Lease dates need review", explanation: "The recorded lease date range is invalid and must be reviewed without automatic correction." },
  CURRENT_LEASE_CONTEXT_MISMATCH: { title: "Lease and occupancy links don't match", explanation: "The current lease record does not match this tenant or unit context. Resolve Occupancy will explain whether only stale operational links can be corrected safely." },
  DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY: { title: "Draft lease conflicts with occupancy", explanation: "A draft lease cannot establish current occupancy." },
  UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY: { title: "Upcoming lease conflicts with occupancy", explanation: "A future lease cannot yet establish current occupancy." },
  PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY: { title: "Past lease conflicts with occupancy", explanation: "An expired lease cannot establish current occupancy." },
  ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY: { title: "Ended lease conflicts with occupancy", explanation: "An ended lease cannot establish current occupancy." },
  LEASE_EXECUTION_INCOMPLETE: { title: "Lease signing is incomplete", explanation: "The lease does not yet contain the execution evidence required to support occupancy." },
  OCCUPIED_WITHOUT_CURRENT_LEASE: { title: "Occupied without a current lease", explanation: "The occupancy record says occupied, but no current supporting lease was found." },
  VACANT_WITH_CURRENT_LEASE: { title: "Vacancy conflicts with a current lease", explanation: "The unit is recorded as vacant while a current supporting lease exists." },
  STALE_CURRENT_LEASE_POINTER: { title: "Current lease link needs review", explanation: "A stored current-lease link does not match the canonical supporting lease." },
  TENANT_CURRENT_WITHOUT_CURRENT_LEASE: { title: "Tenant relationship needs review", explanation: "The tenant is marked current without a canonical current lease." },
};

export function reasonPresentation(reason: string) {
  return REASON_COPY[reason as OccupancyReviewReason] || { title: "Occupancy record needs review", explanation: "The current record needs review before RentChain can treat its occupancy state as resolved." };
}

const ACTION_COPY: Record<OccupancyReviewItem["action"], string> = {
  resolve_multiple_current: "Resolve occupancy", resolve_occupancy: "Resolve occupancy", continue_signing: "Continue signing",
  review_lease_dates: "Review lease dates", review_lease: "Review lease", review_tenant_relationship: "Review tenant", review_only: "Review guidance",
};

export default function ReviewNeededPage() {
  const [workspace, setWorkspace] = useState<OccupancyReviewWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [resolving, setResolving] = useState<OccupancyReviewItem | null>(null);
  const [starting, setStarting] = useState<OccupancyReviewItem | null>(null);
  const [startEligibility, setStartEligibility] = useState<Record<string, boolean>>({});
  const [relationshipResolution, setRelationshipResolution] = useState<OccupancyReviewItem | null>(null);
  const [relationshipSubmitting, setRelationshipSubmitting] = useState(false);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await getOccupancyReviewWorkspace();
      setWorkspace({ items: response.items, counts: response.counts });
      const candidates = response.items.filter((item) => item.reasons.length === 1 && item.reasons[0] === "VACANT_WITH_CURRENT_LEASE" && item.supportingLeaseId);
      const eligibility = await Promise.all(candidates.map(async (item) => {
        try { return [item.supportingLeaseId!, (await getOccupancyStartContext(item.supportingLeaseId!)).context.eligible] as const; }
        catch { return [item.supportingLeaseId!, false] as const; }
      }));
      setStartEligibility(Object.fromEntries(eligibility));
    }
    catch { setWorkspace(null); setError("Review Needed is temporarily unavailable. No records have been treated as resolved."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const items = useMemo(() => (workspace?.items || []).filter((item) => filter === "all" || item.category === filter), [filter, workspace]);

  return <main className="review-needed-page">
    <header className="review-needed-header"><div><p className="review-needed-eyebrow">Occupancy operations</p><h1>Review Needed</h1><p>These records need your review before RentChain can treat their occupancy state as resolved.</p></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={18} /> Refresh</button></header>
    {loading ? <section className="review-needed-state">Loading canonical review items…</section> : null}
    {error ? <section className="review-needed-state review-needed-error" role="alert"><strong>Review queue unavailable</strong><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></section> : null}
    {!loading && !error && workspace ? <>
      <section className="review-needed-summary" aria-label="Review summary">
        <div><strong>{workspace.counts.total}</strong><span>Total</span></div><div><strong>{workspace.counts.multipleCurrent}</strong><span>Multiple current</span></div><div><strong>{workspace.counts.occupancy}</strong><span>Occupancy conflicts</span></div><div><strong>{workspace.counts.lease + workspace.counts.signing}</strong><span>Lease and signing</span></div><div><strong>{workspace.counts.tenantRelationship}</strong><span>Tenant relationships</span></div>
      </section>
      <nav className="review-needed-filters" aria-label="Review filters">{(["all", "occupancy", "lease", "signing", "tenant_relationship"] as Filter[]).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "tenant_relationship" ? "Tenant relationship" : value[0].toUpperCase() + value.slice(1)}</button>)}</nav>
      {workspace.items.length === 0 ? <section className="review-needed-state"><strong>No canonical occupancy conflicts need review.</strong><span>This all-clear reflects the latest server-authoritative evaluation.</span></section> : null}
      {workspace.items.length > 0 && items.length === 0 ? <section className="review-needed-state">No items match this filter.</section> : null}
      <section className="review-needed-list" aria-label="Review items">{items.map((item) => {
        const primary = reasonPresentation(item.reasons[0] || "");
        const isExplicitStartCandidate = item.reasons.length === 1 && item.reasons[0] === "VACANT_WITH_CURRENT_LEASE" && Boolean(item.supportingLeaseId);
        const canStart = Boolean(isExplicitStartCandidate && item.supportingLeaseId && startEligibility[item.supportingLeaseId] === true);
        const canResolve = !isExplicitStartCandidate && (item.action === "resolve_multiple_current" || item.action === "resolve_occupancy") && item.propertyId && item.unitId;
        const canReconcileRelationship = item.scope === "tenant" && item.resolutionAvailable && item.resolutionType === "reconcile_stale_tenant_relationship_status" && Boolean(item.tenantId && item.expectedStateToken);
        return <article key={item.id} className={`review-needed-card review-needed-card--${item.severity}`}>
          <div className="review-needed-card-heading"><AlertTriangle size={20} /><div><h2>{primary.title}</h2><p>{[item.propertyName, item.unitLabel, item.tenantName].filter(Boolean).join(" · ") || "Canonical occupancy context"}</p></div><span>{item.canonicalState.occupancyState.replace("_", " ")}</span></div>
          <p>{primary.explanation}</p>
          {item.reasons.length > 1 ? <ul>{item.reasons.slice(1).map((reason) => <li key={reason}><strong>{reasonPresentation(reason).title}:</strong> {reasonPresentation(reason).explanation}</li>)}</ul> : null}
          <div className="review-needed-actions">{canStart ? <button type="button" onClick={() => setStarting(item)}>Start Occupancy</button> : isExplicitStartCandidate ? <span>Start Occupancy is unavailable under the current authoritative context.</span> : canResolve ? <button type="button" onClick={() => setResolving(item)}>{ACTION_COPY[item.action]}</button> : canReconcileRelationship ? <button type="button" onClick={() => { setRelationshipError(null); setRelationshipResolution(item); }}>Reconcile tenant relationship</button> : item.actionTarget ? <Link to={item.actionTarget}>{ACTION_COPY[item.action]}</Link> : <span>Review the linked records before making changes.</span>}</div>
        </article>;
      })}</section>
    </> : null}
    {resolving?.propertyId && resolving.unitId ? <ResolveOccupancyDrawer open propertyId={resolving.propertyId} unitId={resolving.unitId} tenantId={resolving.tenantId} onClose={() => setResolving(null)} onResolved={() => { setResolving(null); void load(); }} /> : null}
    {starting?.supportingLeaseId ? <StartOccupancyDrawer leaseId={starting.supportingLeaseId} propertyLabel={starting.propertyName} unitLabel={starting.unitLabel} onClose={() => setStarting(null)} onStarted={() => { setStarting(null); void load(); }} /> : null}
    {relationshipResolution?.tenantId && relationshipResolution.expectedStateToken ? <div role="dialog" aria-modal="true" aria-labelledby="relationship-resolution-title" className="review-needed-state">
      <h2 id="relationship-resolution-title">Reconcile tenant relationship</h2>
      <p>RentChain found explicit prior move-out or End Lease evidence and no active occupancy relationship. This action updates the stale tenant relationship status to Past. It does not change lease facts or archive the tenant.</p>
      {relationshipResolution.supportingEvidence[0] ? <p>Evidence: {relationshipResolution.supportingEvidence[0].evidenceType.replaceAll("_", " ")} · {new Date(relationshipResolution.supportingEvidence[0].effectiveDate).toLocaleDateString()}</p> : null}
      {relationshipError ? <p role="alert">{relationshipError}</p> : null}
      <div className="review-needed-actions"><button type="button" disabled={relationshipSubmitting} onClick={() => { setRelationshipError(null); setRelationshipResolution(null); }}>Cancel</button><button type="button" disabled={relationshipSubmitting} onClick={async () => {
        setRelationshipSubmitting(true); setRelationshipError(null);
        try { await submitStaleTenantRelationshipResolution({ tenantId: relationshipResolution.tenantId!, expectedStateToken: relationshipResolution.expectedStateToken!, idempotencyKey: crypto.randomUUID() }); setRelationshipResolution(null); await load(); }
        catch { setRelationshipError("The relationship could not be reconciled because the authoritative state changed or is no longer eligible."); }
        finally { setRelationshipSubmitting(false); }
      }}>{relationshipSubmitting ? "Reconciling…" : "Confirm reconciliation"}</button></div>
    </div> : null}
  </main>;
}
