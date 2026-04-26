import React from "react";
import { useSearchParams } from "react-router-dom";
import { fetchSupportConsoleResource, type SupportConsoleResourceResponse } from "../../api/supportConsoleApi";
import { Timeline } from "../../components/timeline/Timeline";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import SupportConsoleHeader from "../../components/supportConsole/SupportConsoleHeader";
import SupportConsoleSection from "../../components/supportConsole/SupportConsoleSection";
import PolicyDecisionList from "../../components/supportConsole/PolicyDecisionList";
import AutomationHistoryList from "../../components/supportConsole/AutomationHistoryList";
import ResolutionPanel from "../../components/adminResolution/ResolutionPanel";
import AssignmentPanel from "../../components/adminAssignment/AssignmentPanel";
import SlaSummaryPanel from "../../components/adminSla/SlaSummaryPanel";

const RESOURCE_OPTIONS = [
  { label: "Application", value: "application" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Lease", value: "lease" },
];

function renderKeyValueList(value: Record<string, unknown> | null | undefined) {
  const entries = Object.entries(value || {}).filter(([, entry]) => entry != null && entry !== "");
  if (!entries.length) return <div style={{ color: "#64748b" }}>No derived data available.</div>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {entries.map(([key, entry]) => (
        <div key={key}>
          <strong>{key}</strong>: {typeof entry === "object" ? JSON.stringify(entry) : String(entry)}
        </div>
      ))}
    </div>
  );
}

export default function SupportDebugConsolePage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resourceType, setResourceType] = React.useState(searchParams.get("resourceType") || "application");
  const [resourceId, setResourceId] = React.useState(searchParams.get("resourceId") || "");
  const [payload, setPayload] = React.useState<SupportConsoleResourceResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (nextType: string, nextId: string) => {
      const safeId = String(nextId || "").trim();
      if (!safeId) {
        setPayload(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetchSupportConsoleResource(nextType, safeId);
        setPayload(response);
        setSearchParams({ resourceType: nextType, resourceId: safeId });
      } catch (err: any) {
        const message = err?.message || "Failed to load support console";
        setPayload(null);
        setError(message);
        showToast({
          message: "Failed to load support console",
          description: message,
          variant: "error",
        });
      } finally {
        setLoading(false);
      }
    },
    [setSearchParams, showToast]
  );

  React.useEffect(() => {
    const initialType = searchParams.get("resourceType") || "application";
    const initialId = searchParams.get("resourceId") || "";
    if (initialId) {
      setResourceType(initialType);
      setResourceId(initialId);
      void load(initialType, initialId);
    }
  }, [load, searchParams]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void load(resourceType, resourceId);
  };

  return (
    <MacShell title="Admin · Support / Debug Console">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Support / Debug Console</h1>
            <div style={{ color: "#475569", maxWidth: 820 }}>
              Inspect one resource and see its timeline, derived state, policy history, automation behavior, and screening reconciliation in a single admin-only view.
            </div>
          </div>
        </Section>

        <Card>
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>Resource type</span>
                <select value={resourceType} onChange={(event) => setResourceType(event.target.value)}>
                  {RESOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>Resource ID</span>
                <input
                  aria-label="Resource ID"
                  value={resourceId}
                  onChange={(event) => setResourceId(event.target.value)}
                  placeholder="app-123"
                />
              </label>
            </div>
            <div>
              <Button type="submit" disabled={loading}>
                {loading ? "Loading..." : "Inspect resource"}
              </Button>
            </div>
          </form>
        </Card>

        {loading ? <Card>Loading support console…</Card> : null}
        {!loading && !error && !payload ? (
          <Card>Enter a resource type and ID to inspect timeline, policy, automation, and reconciliation state.</Card>
        ) : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load support console: {error}</Card> : null}

        {!loading && !error && payload ? (
          <>
            <SupportConsoleHeader resource={payload.resource} />

            <SupportConsoleSection title="Derived insight">
              {renderKeyValueList(payload.insight || null)}
            </SupportConsoleSection>

            {payload.reconciliation ? (
              <SupportConsoleSection title="Reconciliation">
                {renderKeyValueList(payload.reconciliation)}
              </SupportConsoleSection>
            ) : null}

            <SupportConsoleSection title="SLA">
              <SlaSummaryPanel sla={payload.sla || null} />
            </SupportConsoleSection>

            <SupportConsoleSection title="Watchlist">
              {payload.watch ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div><strong>Status</strong>: {payload.watch.isActive ? "Watched" : "Inactive"}</div>
                  <div><strong>Watch ID</strong>: {payload.watch.id}</div>
                  {payload.watch.notes ? <div><strong>Notes</strong>: {payload.watch.notes}</div> : null}
                </div>
              ) : (
                <div style={{ color: "#64748b" }}>This resource is not currently on the watchlist.</div>
              )}
            </SupportConsoleSection>

            <SupportConsoleSection title="Assignment">
              <AssignmentPanel
                resourceType={payload.resource.type}
                resourceId={payload.resource.id}
                assignment={payload.assignment || null}
                onChange={(assignment) => setPayload((current) => (current ? { ...current, assignment } : current))}
              />
            </SupportConsoleSection>

            <SupportConsoleSection title="Resolution">
              <ResolutionPanel
                resourceType={payload.resource.type}
                resourceId={payload.resource.id}
                triageCategory={searchParams.get("triageCategory")}
                triageSeverity={searchParams.get("triageSeverity")}
                reasonCode={searchParams.get("reasonCode")}
                resolution={payload.resolution || null}
                onChange={(resolution) => setPayload((current) => (current ? { ...current, resolution } : current))}
              />
            </SupportConsoleSection>

            <SupportConsoleSection title="Policy decisions">
              <PolicyDecisionList items={payload.policyDecisions} />
            </SupportConsoleSection>

            <SupportConsoleSection title="Automation history">
              <AutomationHistoryList items={payload.automation} />
            </SupportConsoleSection>

            <SupportConsoleSection title="Timeline">
              <Timeline
                items={payload.timeline}
                emptyMessage="No canonical timeline activity is available for this resource."
                defaultExpandedBuckets={{ earlier: true }}
              />
            </SupportConsoleSection>

            <SupportConsoleSection title="Debug metadata">
              {renderKeyValueList({
                canonicalEventCount: payload.debug.canonicalEventCount,
                domainsPresent: payload.debug.domainsPresent.join(", "),
                ...(payload.debug.identifiers || {}),
              })}
            </SupportConsoleSection>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
