import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { fetchTimeline, type TimelineItem } from "../../api/timelineApi";
import { Timeline } from "../../components/timeline/Timeline";

const DOMAIN_OPTIONS = [
  { label: "All domains", value: "" },
  { label: "Application", value: "application" },
  { label: "Screening", value: "screening" },
  { label: "Lease", value: "lease" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Expense", value: "expense" },
  { label: "Policy", value: "policy" },
  { label: "System", value: "system" },
];

function filterByDate(items: TimelineItem[], fromDate: string) {
  if (!fromDate) return items;
  const fromTs = Date.parse(`${fromDate}T00:00:00.000Z`);
  if (!Number.isFinite(fromTs)) return items;
  return items.filter((item) => {
    const ts = Date.parse(item.timestamp);
    return Number.isFinite(ts) ? ts >= fromTs : true;
  });
}

export default function AutomationTimelineV1Page() {
  const { showToast } = useToast();
  const [events, setEvents] = React.useState<TimelineItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [domain, setDomain] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (cursor?: string | null) => {
      const isLoadMore = Boolean(cursor);
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }
        const response = await fetchTimeline({
          domain: domain || null,
          limit: 20,
          cursor: cursor || null,
        });
        setEvents((current) => (isLoadMore ? [...current, ...(response.events || [])] : response.events || []));
        setNextCursor(response.nextCursor || null);
      } catch (err: any) {
        const message = err?.message || "Failed to load timeline";
        setError(message);
        showToast({
          message: "Failed to load timeline",
          description: message,
          variant: "error",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [domain, showToast]
  );

  React.useEffect(() => {
    void load(null);
  }, [load]);

  const visibleEvents = React.useMemo(() => filterByDate(events, fromDate), [events, fromDate]);

  return (
    <MacShell title="Admin · Automation Timeline">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Automation Timeline</h1>
                <Pill tone="accent">Canonical events</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 760 }}>
                Read-only chronological activity across applications, screening, maintenance, leases, expenses, and policy decisions.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void load(null)} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        <Card style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>Domain</span>
              <select value={domain} onChange={(event) => setDomain(event.target.value)}>
                {DOMAIN_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>From date</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
          </div>
        </Card>

        {loading ? <Card>Loading timeline…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load timeline: {error}</Card> : null}
        {!loading && !error ? (
          <Card>
            <Timeline
              items={visibleEvents}
              emptyMessage="No canonical timeline activity is available yet."
              defaultExpandedBuckets={{ earlier: true }}
            />
          </Card>
        ) : null}

        {!loading && !error && nextCursor ? (
          <div>
            <Button variant="secondary" onClick={() => void load(nextCursor)} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>
    </MacShell>
  );
}
