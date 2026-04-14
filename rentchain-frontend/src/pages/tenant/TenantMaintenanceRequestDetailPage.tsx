import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getTenantMaintenance,
  updateTenantMaintenanceConfirmation,
  updateTenantMaintenanceReworkAccess,
  updateTenantMaintenanceSignoff,
  type MaintenanceWorkflowItem,
} from "../../api/maintenanceWorkflowApi";
import { Button, Card, Section } from "../../components/ui/Ui";
import { clearTenantToken, getTenantToken } from "../../lib/tenantAuth";
import { colors, radius, spacing, text as textTokens } from "../../styles/tokens";
import { TenantSurfaceShell, prettyStatus } from "./TenantWorkspaceShared";
import { buildMaintenanceLifecycleView } from "../maintenanceWorkspaceState";
import { buildMaintenanceAssignmentRoutingView } from "../maintenanceAssignmentRoutingState";
import { buildMaintenanceConfirmationAccessView } from "../maintenanceConfirmationAccessState";
import { buildMaintenanceSchedulingAccessView } from "../maintenanceSchedulingAccessState";

function fmtDate(ts?: number | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function resolutionStatusLabel(value?: MaintenanceWorkflowItem["resolutionStatus"]) {
  switch (value) {
    case "completed_pending_review":
      return "Completed and waiting for landlord review.";
    case "landlord_approved":
      return "Landlord approved the completed work.";
    case "tenant_pending_signoff":
      return "Your review is needed before this request is fully resolved.";
    case "resolved":
      return "This request has been marked resolved.";
    case "follow_up_required":
      return "This request needs follow-up before it can be fully resolved.";
    default:
      return "No resolution decision has been recorded yet.";
  }
}

export default function TenantMaintenanceRequestDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<MaintenanceWorkflowItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const [signoffReason, setSignoffReason] = useState("");
  const [reworkAccessNote, setReworkAccessNote] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hasToken, setHasToken] = useState<boolean>(() =>
    typeof window === "undefined" ? true : !!getTenantToken()
  );
  const lifecycleView = data ? buildMaintenanceLifecycleView(data, "tenant") : null;
  const assignmentView = data ? buildMaintenanceAssignmentRoutingView(data, "tenant") : null;
  const schedulingView = data ? buildMaintenanceSchedulingAccessView(data, "tenant") : null;
  const confirmationView = data ? buildMaintenanceConfirmationAccessView(data, "tenant") : null;

  useEffect(() => {
    const token = getTenantToken();
    if (!token && typeof window !== "undefined") {
      setHasToken(false);
      setSessionExpired(true);
      setData(null);
      setError(null);
      return;
    }
    setHasToken(true);
    const load = async () => {
      setLoading(true);
      setError(null);
      setSessionExpired(false);
      try {
        const res = await getTenantMaintenance(id || "");
        setData((res as any)?.item || (res as any)?.data || null);
      } catch (err: any) {
        if (err?.payload?.error === "UNAUTHORIZED" || err?.status === 401) {
          setSessionExpired(true);
          setData(null);
          setError(null);
        } else {
          const msg = err?.payload?.error || err?.message || "Unable to load request";
          setError(String(msg));
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (!hasToken || sessionExpired) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.bgAmbient,
          padding: "clamp(12px, 3vw, 24px)",
          boxSizing: "border-box",
        }}
      >
        <Section style={{ maxWidth: 900, margin: "0 auto" }}>
          <Card elevated style={{ borderColor: colors.borderStrong, background: "#fff7ed", color: "#9a3412" }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Your tenant session has expired</div>
            <div style={{ fontSize: "0.95rem", marginBottom: spacing.sm }}>
              Please sign in again to continue to your RentChain tenant portal.
            </div>
            <div style={{ marginTop: spacing.sm }}>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/tenant/login";
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.borderStrong}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Go to tenant login
              </button>
            </div>
          </Card>
        </Section>
      </div>
    );
  }

  const applyConfirmationUpdate = async (payload: {
    confirmationStatus?: "confirmed" | "needs_schedule_change";
    acknowledgeAccess?: boolean;
  }) => {
    if (!id) return;
    setSavingAction(true);
    setError(null);
    try {
      const res = await updateTenantMaintenanceConfirmation(id, payload);
      setData((res as any)?.item || (res as any)?.data || null);
    } catch (err: any) {
      const msg = err?.payload?.error || err?.message || "Unable to update the maintenance confirmation.";
      setError(String(msg));
    } finally {
      setSavingAction(false);
    }
  };

  const applyResolutionSignoff = async (decision: "resolved" | "not_resolved") => {
    if (!id) return;
    if (decision === "not_resolved" && !signoffReason.trim()) {
      setError("Add a reason before requesting follow-up.");
      return;
    }
    setSavingAction(true);
    setError(null);
    try {
      const res = await updateTenantMaintenanceSignoff(id, {
        decision,
        reason: decision === "not_resolved" ? signoffReason.trim() : undefined,
      });
      setData((res as any)?.item || (res as any)?.data || null);
      if (decision === "resolved") {
        setSignoffReason("");
      }
    } catch (err: any) {
      const msg = err?.payload?.error || err?.message || "Unable to update the maintenance resolution.";
      setError(String(msg));
    } finally {
      setSavingAction(false);
    }
  };

  const applyReworkAccessDecision = async (decision: "confirm" | "deny") => {
    if (!id) return;
    setSavingAction(true);
    setError(null);
    try {
      const res = await updateTenantMaintenanceReworkAccess(id, {
        decision,
        note: reworkAccessNote.trim() || undefined,
      });
      setData((res as any)?.item || (res as any)?.data || null);
      if (decision === "confirm") setReworkAccessNote("");
    } catch (err: any) {
      const msg = err?.payload?.error || err?.message || "Unable to update the rework access confirmation.";
      setError(String(msg));
    } finally {
      setSavingAction(false);
    }
  };

  return (
    <TenantSurfaceShell
      title="Maintenance Request"
      subtitle="Review the tenant-safe details and current status of this maintenance request."
    >
      <Section style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: textTokens.primary }}>Maintenance request</div>
            <div style={{ color: textTokens.muted }}>View details of your request</div>
          </div>
          <a
            href="/tenant/maintenance"
            style={{
              padding: "8px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              textDecoration: "none",
              color: textTokens.primary,
              fontWeight: 700,
            }}
          >
            Back to dashboard
          </a>
        </div>

        {error ? (
          <Card elevated style={{ borderColor: colors.borderStrong, color: colors.danger }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Unable to load request</div>
            <div style={{ fontSize: "0.95rem" }}>{error}</div>
            <div style={{ marginTop: spacing.sm }}>
              <button
                type="button"
                onClick={() => {
                  clearTenantToken();
                  if (typeof window !== "undefined") window.location.href = "/tenant/login";
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.borderStrong}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Return to login
              </button>
            </div>
          </Card>
        ) : loading ? (
          <Card elevated>
            <div style={{ height: 16, background: colors.accentSoft, borderRadius: 6, width: "50%", marginBottom: 10 }} />
            <div style={{ height: 12, background: colors.accentSoft, borderRadius: 6, width: "30%", marginBottom: 8 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "100%", marginBottom: 6 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "90%", marginBottom: 6 }} />
            <div style={{ height: 10, background: colors.accentSoft, borderRadius: 6, width: "80%" }} />
          </Card>
        ) : data ? (
          <Card elevated>
            <div style={{ display: "grid", gap: spacing.sm }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: textTokens.primary }}>{data.title}</div>
              <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", color: textTokens.muted, fontSize: "0.95rem" }}>
                <span>Status: {prettyStatus(data.status)}</span>
                <span>Priority: {prettyStatus(data.priority)}</span>
                <span>Category: {prettyStatus(data.category)}</span>
                {assignmentView ? <span>Handling: {assignmentView.tenantVisibleLabel}</span> : null}
              </div>
              <div style={{ color: textTokens.muted, fontSize: "0.95rem" }}>
                Created {fmtDate(data.createdAt)} • Updated {fmtDate(data.updatedAt)}
              </div>
              <div style={{ color: textTokens.primary, fontSize: "1rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {data.description}
              </div>
              {lifecycleView ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: "12px 14px",
                    background: colors.panel,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>What this status means</div>
                  <div style={{ color: textTokens.secondary }}>{lifecycleView.summary}</div>
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>What happens next</div>
                  {lifecycleView.nextSteps.map((step) => (
                    <div key={step} style={{ color: textTokens.secondary }}>
                      {step}
                    </div>
                  ))}
                </div>
              ) : null}
              {assignmentView ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: "12px 14px",
                    background: colors.panel,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>Handling status</div>
                  <div style={{ color: textTokens.secondary }}>{assignmentView.summary}</div>
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>What happens next</div>
                  {assignmentView.nextActions.map((step) => (
                    <div key={step} style={{ color: textTokens.secondary }}>
                      {step}
                    </div>
                  ))}
                  {assignmentView.blockers.length ? (
                    <>
                      <div style={{ color: textTokens.primary, fontWeight: 700 }}>Needs attention</div>
                      {assignmentView.blockers.map((item) => (
                        <div key={item} style={{ color: textTokens.secondary }}>
                          {item}
                        </div>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}
              {schedulingView ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: "12px 14px",
                    background: colors.panel,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>Scheduling / access</div>
                  <div style={{ color: textTokens.secondary }}>{schedulingView.summary}</div>
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>Upcoming service window</div>
                  <div style={{ color: textTokens.secondary }}>{schedulingView.serviceWindowSummary}</div>
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>Access</div>
                  <div style={{ color: textTokens.secondary }}>{schedulingView.accessLabel}</div>
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>What happens next</div>
                  {schedulingView.nextActions.map((step) => (
                    <div key={step} style={{ color: textTokens.secondary }}>
                      {step}
                    </div>
                  ))}
                </div>
              ) : null}
              {confirmationView ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: "12px 14px",
                    background: colors.panel,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>Confirmation / access</div>
                  <div style={{ color: textTokens.secondary }}>{confirmationView.summary}</div>
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>Service readiness</div>
                  <div style={{ color: textTokens.secondary }}>{confirmationView.readinessLabel}</div>
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>Access</div>
                  <div style={{ color: textTokens.secondary }}>{confirmationView.accessLabel}</div>
                  {confirmationView.blockers.length ? (
                    <>
                      <div style={{ color: textTokens.primary, fontWeight: 700 }}>Needs attention</div>
                      {confirmationView.blockers.map((item) => (
                        <div key={item} style={{ color: textTokens.secondary }}>
                          {item}
                        </div>
                      ))}
                    </>
                  ) : null}
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>Next step</div>
                  {confirmationView.nextActions.map((step) => (
                    <div key={step} style={{ color: textTokens.secondary }}>
                      {step}
                    </div>
                  ))}
                  {data?.status === "scheduled" && schedulingView?.serviceWindowSummary !== "No service window has been confirmed yet." ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      <Button
                        variant="secondary"
                        onClick={() => void applyConfirmationUpdate({ confirmationStatus: "confirmed" })}
                        disabled={savingAction || confirmationView.confirmationState === "confirmed"}
                      >
                        {savingAction ? "Saving..." : "Confirm service window"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void applyConfirmationUpdate({ confirmationStatus: "needs_schedule_change" })}
                        disabled={savingAction || confirmationView.confirmationState === "needs_schedule_change"}
                      >
                        {savingAction ? "Saving..." : "Request schedule change"}
                      </Button>
                      {data.accessRequired === true ? (
                        <Button
                          variant="secondary"
                          onClick={() => void applyConfirmationUpdate({ acknowledgeAccess: true })}
                          disabled={savingAction || confirmationView.accessState === "access_acknowledged"}
                        >
                          {savingAction ? "Saving..." : "Acknowledge access"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {data.reworkCycle || data.reworkHistory?.length ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: "12px 14px",
                    background: colors.panel,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>Follow-up / rework</div>
                  <div style={{ color: textTokens.secondary }}>
                    {data.reworkCycle
                      ? `Rework #${data.reworkCycle.cycleNumber} is ${data.reworkCycle.status.replaceAll("_", " ")}.`
                      : "A follow-up cycle has been recorded for this request."}
                  </div>
                  {data.reworkCycle?.completionSummary ? (
                    <>
                      <div style={{ color: textTokens.primary, fontWeight: 700 }}>Latest rework completion summary</div>
                      <div style={{ color: textTokens.secondary }}>{data.reworkCycle.completionSummary}</div>
                    </>
                  ) : null}
                  <div style={{ color: textTokens.primary, fontWeight: 700 }}>What happens next</div>
                  <div style={{ color: textTokens.secondary }}>
                    {data.reworkCycle?.status === "completed"
                      ? "The updated work is back with your landlord for review before final signoff."
                      : data.reworkCycle
                      ? "Your maintenance request is in an active follow-up cycle. RentChain will keep the original history while this second pass is completed."
                      : "Previous follow-up cycles stay attached to this request for a full maintenance record."}
                  </div>
                  {data.reworkHistory?.length ? (
                    <>
                      <div style={{ color: textTokens.primary, fontWeight: 700 }}>Previous rework cycles</div>
                      {data.reworkHistory.map((entry) => (
                        <div key={entry.cycleNumber} style={{ color: textTokens.secondary }}>
                          Rework #{entry.cycleNumber}: {entry.outcome || "recorded"} on {fmtDate(entry.completedAt)}
                          {entry.notes ? ` — ${entry.notes}` : ""}
                        </div>
                      ))}
                    </>
                  ) : null}
                  {data.reworkCycle?.schedule ? (
                    <>
                      <div style={{ color: textTokens.primary, fontWeight: 700 }}>Return visit coordination</div>
                      <div style={{ color: textTokens.secondary }}>
                        Status: {String(data.reworkCycle.schedule.status || "not_scheduled").replaceAll("_", " ")}
                      </div>
                      <div style={{ color: textTokens.secondary }}>
                        Visit time: {fmtDate(data.reworkCycle.schedule.scheduledFor || data.reworkCycle.schedule.timeWindowStart)}
                        {data.reworkCycle.schedule.timeWindowEnd
                          ? ` to ${fmtDate(data.reworkCycle.schedule.timeWindowEnd)}`
                          : ""}
                      </div>
                      <div style={{ color: textTokens.secondary }}>
                        Access: {data.reworkCycle.schedule.requiresTenantAccess ? "required" : "not required"} • Your status:{" "}
                        {String(data.reworkCycle.schedule.tenantAccessStatus || "pending").replaceAll("_", " ")}
                      </div>
                      {data.reworkCycle.schedule.tenantAccessNote ? (
                        <div style={{ color: textTokens.secondary }}>{data.reworkCycle.schedule.tenantAccessNote}</div>
                      ) : null}
                      {data.reworkCycle.schedule.requiresTenantAccess &&
                      data.reworkCycle.schedule.tenantAccessStatus !== "confirmed" &&
                      data.reworkCycle.schedule.status !== "confirmed" ? (
                        <>
                          <textarea
                            value={reworkAccessNote}
                            onChange={(e) => setReworkAccessNote(e.target.value)}
                            placeholder="Add an optional note about access for the return visit"
                            rows={3}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: radius.md,
                              border: `1px solid ${colors.border}`,
                              background: colors.panel,
                              color: textTokens.primary,
                              resize: "vertical",
                            }}
                          />
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button variant="secondary" onClick={() => void applyReworkAccessDecision("confirm")} disabled={savingAction}>
                              {savingAction ? "Saving..." : "Confirm return visit access"}
                            </Button>
                            <Button variant="secondary" onClick={() => void applyReworkAccessDecision("deny")} disabled={savingAction}>
                              {savingAction ? "Saving..." : "Deny access / request reschedule"}
                            </Button>
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  padding: "12px 14px",
                  background: colors.panel,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 800, color: textTokens.primary }}>Resolution approval</div>
                <div style={{ color: textTokens.secondary }}>{resolutionStatusLabel(data.resolutionStatus)}</div>
                {data.landlordApprovedAt ? (
                  <div style={{ color: textTokens.secondary }}>Landlord approved the completed work on {fmtDate(data.landlordApprovedAt)}.</div>
                ) : null}
                {data.finalResolvedAt ? (
                  <div style={{ color: textTokens.secondary }}>Final resolution recorded on {fmtDate(data.finalResolvedAt)}.</div>
                ) : null}
                {data.followUpReason ? (
                  <>
                    <div style={{ color: textTokens.primary, fontWeight: 700 }}>Follow-up reason</div>
                    <div style={{ color: textTokens.secondary }}>{data.followUpReason}</div>
                  </>
                ) : null}
                {data.tenantDeclineReason ? (
                  <>
                    <div style={{ color: textTokens.primary, fontWeight: 700 }}>Your latest note</div>
                    <div style={{ color: textTokens.secondary }}>{data.tenantDeclineReason}</div>
                  </>
                ) : null}
                {data.status === "completed" && data.resolutionStatus === "tenant_pending_signoff" ? (
                  <>
                    <div style={{ color: textTokens.primary, fontWeight: 700 }}>Next step</div>
                    <div style={{ color: textTokens.secondary }}>
                      Review the completed work and let your landlord know whether the issue is fully resolved.
                    </div>
                    <textarea
                      value={signoffReason}
                      onChange={(e) => setSignoffReason(e.target.value)}
                      placeholder="If follow-up is still needed, explain what is incomplete or still not working"
                      rows={3}
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        padding: 10,
                        resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button variant="secondary" disabled={savingAction} onClick={() => void applyResolutionSignoff("resolved")}>
                        {savingAction ? "Saving..." : "Mark resolved"}
                      </Button>
                      <Button variant="ghost" disabled={savingAction} onClick={() => void applyResolutionSignoff("not_resolved")}>
                        {savingAction ? "Saving..." : "Request follow-up"}
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
              {Array.isArray(data.evidence) && data.evidence.length ? (
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: "12px 14px",
                    background: colors.panel,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, color: textTokens.primary }}>Completion photos</div>
                  <div style={{ color: textTokens.secondary }}>
                    These are the tenant-safe photos shared with this maintenance update.
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {data.evidence.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          border: `1px solid ${colors.border}`,
                          borderRadius: radius.md,
                          padding: "10px",
                          background: "#fff",
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.caption || "Maintenance evidence photo"}
                            style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: radius.md }}
                          />
                        ) : null}
                        <div style={{ color: textTokens.primary, fontWeight: 700 }}>
                          {String(item.evidenceType || "completion").replace(/_/g, " ")}
                        </div>
                        <div style={{ color: textTokens.muted, fontSize: "0.85rem" }}>
                          Shared {fmtDate(item.uploadedAt)}
                        </div>
                        {item.caption ? <div style={{ color: textTokens.secondary }}>{item.caption}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: 8, marginTop: spacing.xs }}>
                <div style={{ fontWeight: 700, color: textTokens.primary }}>Status timeline</div>
                {Array.isArray(data.statusHistory) && data.statusHistory.length > 0 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {[...data.statusHistory]
                      .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))
                      .map((entry, idx) => (
                        <div
                          key={`${entry.status}-${entry.createdAt}-${idx}`}
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: radius.md,
                            padding: "8px 10px",
                            background: colors.panel,
                          }}
                        >
                          <div style={{ color: textTokens.primary, fontWeight: 700, fontSize: "0.95rem" }}>
                            {entry.status}
                          </div>
                          <div style={{ color: textTokens.muted, fontSize: "0.85rem", marginTop: 2 }}>
                            {entry.actorRole || "system"} • {fmtDate(entry.createdAt)}
                          </div>
                          {entry.message ? (
                            <div style={{ color: textTokens.secondary, fontSize: "0.9rem", marginTop: 4 }}>
                              {entry.message}
                            </div>
                          ) : null}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={{ color: textTokens.muted }}>No timeline updates yet.</div>
                )}
              </div>
            </div>
          </Card>
        ) : null}
      </Section>
    </TenantSurfaceShell>
  );
}
