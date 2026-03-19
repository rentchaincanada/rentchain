import React, { useEffect, useMemo, useState } from "react";
import {
  endLease,
  getLeaseAutomationTasks,
  getLeasesForTenant,
  Lease,
  LeaseAutomationTask,
  regenerateLeaseAutomationTasks,
  updateLease,
} from "../../api/leasesApi";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useUpgrade } from "@/context/UpgradeContext";
import { upgradeStarterButtonStyle } from "@/lib/upgradeButtonStyles";
import { LeaseRiskCard } from "@/components/leases/LeaseRiskCard";

function isNotFound(err: any): boolean {
  return (
    err?.status === 404 ||
    err?.payload?.error === "NOT_FOUND" ||
    String(err?.message || "").includes("(404)")
  );
}

interface TenantLeasePanelProps {
  tenantId: string | null;
}

type TaskErrorState =
  | "tasks_unavailable"
  | "tasks_load_failed"
  | "tasks_refresh_failed"
  | "automation_update_failed";

const panelSurface: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.28)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
  boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
};

const insetPanelSurface: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(248,250,252,0.9)",
};

const automationTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 700,
};

const automationMetaStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 12,
  lineHeight: 1.5,
};

function getAutomationErrorCopy(error: TaskErrorState) {
  switch (error) {
    case "tasks_unavailable":
      return {
        title: "Automation tasks unavailable",
        body: "We couldn’t load upcoming automation tasks right now.",
        hint: "This may be temporary. Please refresh or try again shortly.",
      };
    case "tasks_refresh_failed":
      return {
        title: "Unable to refresh automation tasks",
        body: "We couldn’t refresh the upcoming automation schedule right now.",
        hint: "Please try again in a moment.",
      };
    case "automation_update_failed":
      return {
        title: "Automation update unavailable",
        body: "We couldn’t update lifecycle automation right now.",
        hint: "Your current settings were left unchanged.",
      };
    default:
      return {
        title: "Automation tasks unavailable",
        body: "We couldn’t load upcoming automation tasks right now.",
        hint: "Please refresh or try again shortly.",
      };
  }
}

const AutomationMessageCard: React.FC<{
  title: string;
  description: string;
  hint?: string | null;
}> = ({ title, description, hint = null }) => (
  <div
    style={{
      ...insetPanelSurface,
      padding: 12,
      display: "grid",
      gap: 4,
      marginTop: 10,
    }}
  >
    <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 700 }}>{title}</div>
    <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.5 }}>{description}</div>
    {hint ? <div style={{ color: "#64748b", fontSize: 12 }}>{hint}</div> : null}
  </div>
);

export const TenantLeasePanel: React.FC<TenantLeasePanelProps> = ({ tenantId }) => {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endingLeaseId, setEndingLeaseId] = useState<string | null>(null);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskError, setTaskError] = useState<TaskErrorState | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<LeaseAutomationTask[]>([]);
  const { features, loading: capsLoading } = useCapabilities();
  const { openUpgrade } = useUpgrade();
  const leasesEnabled = features?.leases !== false;

  const loadLeases = React.useCallback(async () => {
    if (!tenantId || !leasesEnabled) {
      setLeases([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await getLeasesForTenant(tenantId);
      setLeases(data.leases);
      setError(null);
    } catch (err: any) {
      console.error("[TenantLeasePanel] Failed to load leases", err);
      setLeases([]);
      if (isNotFound(err)) {
        setError(null);
      } else {
        setError("Failed to load leases");
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, leasesEnabled]);

  useEffect(() => {
    void loadLeases();
  }, [loadLeases]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {};
      const activatedTenantId = String(detail?.tenantId || "");
      if (!tenantId || !activatedTenantId || activatedTenantId !== tenantId) return;
      void loadLeases();
    };
    window.addEventListener("lease:activated", handler as EventListener);
    return () => window.removeEventListener("lease:activated", handler as EventListener);
  }, [loadLeases, tenantId]);

  const activeLease = useMemo(
    () => leases.find((l) => l.status === "active") ?? null,
    [leases]
  );

  const endedLeases = useMemo(
    () => leases.filter((l) => l.status === "ended"),
    [leases]
  );

  useEffect(() => {
    let cancelled = false;
    const loadTasks = async () => {
      if (!activeLease?.id) {
        setUpcomingTasks([]);
        setTaskError(null);
        return;
      }
      setTasksLoading(true);
      setTaskError(null);
      try {
        const result = await getLeaseAutomationTasks(activeLease.id);
        if (!cancelled) setUpcomingTasks(Array.isArray(result.tasks) ? result.tasks : []);
      } catch (err: any) {
        if (cancelled) return;
        const msg = String(err?.message || "");
        if (msg.includes("404")) {
          setUpcomingTasks([]);
          setTaskError("tasks_unavailable");
        } else {
          setTaskError("tasks_load_failed");
        }
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    };
    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [activeLease?.id]);

  const formatDate = (value?: string) => {
    if (!value) return "--";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  const handleEndLease = async (leaseId: string) => {
    try {
      setEndingLeaseId(leaseId);
      await endLease(leaseId, new Date().toISOString());
      await loadLeases();
    } catch (err) {
      console.error("[TenantLeasePanel] Failed to end lease", err);
    } finally {
      setEndingLeaseId(null);
    }
  };

  const handleAutomationToggle = async (nextEnabled: boolean) => {
    if (!activeLease?.id) return;
    setAutomationSaving(true);
    setTaskError(null);
    const leaseId = activeLease.id;
    setLeases((prev) =>
      prev.map((lease) =>
        lease.id === leaseId ? { ...lease, automationEnabled: nextEnabled } : lease
      )
    );
    try {
      await updateLease(leaseId, { automationEnabled: nextEnabled });
      if (nextEnabled) {
        const regenerated = await regenerateLeaseAutomationTasks(leaseId);
        setUpcomingTasks(Array.isArray(regenerated.tasks) ? regenerated.tasks : []);
      } else {
        setUpcomingTasks([]);
      }
    } catch (err: any) {
      setLeases((prev) =>
        prev.map((lease) =>
          lease.id === leaseId ? { ...lease, automationEnabled: !nextEnabled } : lease
        )
      );
      setTaskError("automation_update_failed");
    } finally {
      setAutomationSaving(false);
    }
  };

  const handleRegenerateTasks = async () => {
    if (!activeLease?.id) return;
    setTasksLoading(true);
    setTaskError(null);
    try {
      const regenerated = await regenerateLeaseAutomationTasks(activeLease.id);
      setUpcomingTasks(Array.isArray(regenerated.tasks) ? regenerated.tasks : []);
    } catch (_err) {
      setTaskError("tasks_refresh_failed");
    } finally {
      setTasksLoading(false);
    }
  };

  let content: React.ReactNode = null;

  if (!tenantId) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        Select a tenant to view lease information.
      </div>
    );
  } else if (!capsLoading && !leasesEnabled) {
    content = (
      <div
        style={{
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 12,
          padding: 12,
          background: "rgba(15,23,42,0.55)",
          color: "#e2e8f0",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Upgrade to manage your rentals</div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>
          RentChain Screening is free. Rental management starts on Starter.
        </div>
        <button
          type="button"
          onClick={() =>
            openUpgrade({
              reason: "screening",
              plan: "Screening",
              copy: {
                title: "Upgrade to manage your rentals",
                body: "RentChain Screening is free. Rental management starts on Starter.",
              },
              ctaLabel: "Upgrade to Starter",
            })
          }
          style={upgradeStarterButtonStyle}
        >
          Upgrade to Starter
        </button>
      </div>
    );
  } else if (isLoading) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        Loading lease information...
      </div>
    );
  } else if (error) {
    content = (
      <div style={{ color: "#f97316", fontSize: "0.9rem" }}>{error}</div>
    );
  } else if (!leases || leases.length === 0) {
    content = (
      <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
        No leases recorded for this tenant yet.
      </div>
    );
  } else {
    content = (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {activeLease && (
          <div
            style={{
              ...panelSurface,
              padding: 14,
            }}
          >
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Current Lease
            </div>
            <div style={{ color: "#0f172a", fontWeight: 700 }}>
              Property: {activeLease.propertyId} - Unit {activeLease.unitNumber}
            </div>
            <div style={{ color: "#334155", fontSize: 13, marginTop: 4, fontWeight: 600 }}>
              Rent: {formatCurrency(activeLease.monthlyRent)} / month
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              {formatDate(activeLease.startDate)} →{" "}
              {activeLease.endDate ? formatDate(activeLease.endDate) : "Ongoing"}
            </div>
            <div style={{ marginTop: 12 }}>
              <LeaseRiskCard risk={activeLease.risk ?? null} compact />
            </div>
            <div
              style={{
                ...insetPanelSurface,
                marginTop: 12,
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 3 }}>
                <div style={automationTitleStyle}>
                  Lifecycle automation
                </div>
                <div style={automationMetaStyle}>
                  Drafts and reminders only. Legal notices are not auto-sent.
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#334155", fontSize: 12, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={activeLease.automationEnabled !== false}
                  disabled={automationSaving}
                  onChange={(event) => handleAutomationToggle(event.target.checked)}
                />
                {automationSaving ? "Saving..." : activeLease.automationEnabled !== false ? "On" : "Off"}
              </label>
            </div>

            <div
              style={{
                ...insetPanelSurface,
                marginTop: 12,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={automationTitleStyle}>
                  Upcoming automation tasks
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateTasks}
                  disabled={tasksLoading || activeLease.automationEnabled === false}
                  style={{
                    borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "transparent",
                    color: "#334155",
                    padding: "4px 8px",
                    fontSize: 12,
                    cursor: tasksLoading ? "default" : "pointer",
                    opacity: tasksLoading ? 0.7 : 1,
                  }}
                >
                  {tasksLoading ? "Refreshing..." : "Refresh tasks"}
                </button>
              </div>
              {taskError ? (
                <AutomationMessageCard
                  title={getAutomationErrorCopy(taskError).title}
                  description={getAutomationErrorCopy(taskError).body}
                  hint={getAutomationErrorCopy(taskError).hint}
                />
              ) : null}
              {!taskError && upcomingTasks.length === 0 ? (
                <AutomationMessageCard
                  title="No upcoming automation tasks"
                  description="Scheduled tasks will appear here."
                />
              ) : null}
              {upcomingTasks.length > 0 ? (
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {upcomingTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        borderRadius: 10,
                        border: "1px solid rgba(148,163,184,0.18)",
                        background: "rgba(255,255,255,0.72)",
                        padding: "8px 10px",
                        fontSize: 12,
                        color: "#1f2937",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span>{task.reason}</span>
                      <span style={{ color: "#64748b", fontWeight: 600 }}>{formatDate(task.dueDate)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => handleEndLease(activeLease.id)}
              disabled={endingLeaseId === activeLease.id}
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.4)",
                background: "transparent",
                color: "#e5e7eb",
                cursor: endingLeaseId === activeLease.id ? "default" : "pointer",
                opacity: endingLeaseId === activeLease.id ? 0.7 : 1,
                fontSize: 12,
              }}
            >
              {endingLeaseId === activeLease.id ? "Ending..." : "End lease"}
            </button>
          </div>
        )}

        {endedLeases.length > 0 && (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.2)",
              padding: 12,
              background: "rgba(255,255,255,0.01)",
            }}
          >
            <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>
              Lease History
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {endedLeases.map((lease) => (
                <div
                  key={lease.id}
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.15)",
                    padding: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {lease.propertyId} - Unit {lease.unitNumber}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>
                      {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {formatCurrency(lease.monthlyRent)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 600, color: "#e5e7eb", fontSize: "1rem" }}>
        Lease Info
      </div>
      {content}
    </div>
  );
};
