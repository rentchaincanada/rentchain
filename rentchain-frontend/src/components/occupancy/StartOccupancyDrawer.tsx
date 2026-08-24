import { useEffect, useRef, useState } from "react";
import { getOccupancyStartContext, startOccupancy, type OccupancyStartContext } from "@/api/occupancyStartApi";
import "./StartOccupancyDrawer.css";

export function StartOccupancyDrawer({ leaseId, propertyLabel, unitLabel, onClose, onStarted }: { leaseId: string; propertyLabel?: string | null; unitLabel?: string | null; onClose: () => void; onStarted: () => void }) {
  const [context, setContext] = useState<OccupancyStartContext | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const key = useRef(`occupancy-start:${leaseId}:${crypto.randomUUID()}`);
  useEffect(() => { getOccupancyStartContext(leaseId).then((result) => setContext(result.context)).catch(() => setError("Start Occupancy context is unavailable. No occupancy changes were made.")); }, [leaseId]);
  const submit = async () => {
    if (!context?.eligible || !confirmed || submitting) return;
    setSubmitting(true); setError(null);
    try { await startOccupancy(leaseId, { expectedStateToken: context.expectedStateToken, evaluationInstant: context.evaluationInstant, idempotencyKey: key.current }); onStarted(); }
    catch { setError("Occupancy could not be started. Refresh the authoritative context and try again."); }
    finally { setSubmitting(false); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="start-occupancy-title" className="start-occupancy-drawer"><div className="start-occupancy-panel">
    <h2 id="start-occupancy-title">Start Occupancy</h2>
    {!context && !error ? <p>Loading server-authoritative occupancy context…</p> : null}
    {context ? <><dl><div><dt>Tenant</dt><dd>{context.participants.map((participant) => participant.displayName).join(", ")}</dd></div><div><dt>Property / Unit</dt><dd>{[propertyLabel, unitLabel].filter(Boolean).join(" / ") || "Unavailable"}</dd></div><div><dt>Lease dates</dt><dd>{context.leaseStartDate || "Unavailable"} – {context.leaseEndDate || "Unavailable"}</dd></div><div><dt>Lease execution</dt><dd>{context.executionStatus || "Unavailable"}</dd></div><div><dt>Lease term</dt><dd>{context.termStatus}</dd></div><div><dt>Current occupancy</dt><dd>{context.currentOccupancyState.replaceAll("_", " ")}</dd></div></dl>{context.eligible ? <label className="start-occupancy-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Confirm that the tenant has taken possession of this unit and that occupancy should begin under this lease.</label> : <p role="alert">Start Occupancy is unavailable: {context.canonicalBlocker || "authoritative context is ineligible"}.</p>}</> : null}
    {error ? <p role="alert">{error}</p> : null}
    <div className="start-occupancy-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={!context?.eligible || !confirmed || submitting} onClick={() => void submit()}>Confirm and Start Occupancy</button></div>
  </div></div>;
}
