import React from "react";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { useToast } from "../../components/ui/ToastProvider";
import { fetchAdminTriageQueue, type AdminTriageItemV1 } from "../../api/adminTriageApi";
import TriageFilterBar from "../../components/adminTriage/TriageFilterBar";
import TriageQueueTable from "../../components/adminTriage/TriageQueueTable";

export default function AdminTriageQueuePage() {
  const { showToast } = useToast();
  const [items, setItems] = React.useState<AdminTriageItemV1[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [resourceType, setResourceType] = React.useState("");
  const [includeLow, setIncludeLow] = React.useState(false);
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
        const response = await fetchAdminTriageQueue({
          category: category || null,
          severity: severity || null,
          resourceType: resourceType || null,
          includeLow,
          limit: 20,
          cursor: cursor || null,
        });
        setItems((current) => (isLoadMore ? [...current, ...(response.items || [])] : response.items || []));
        setNextCursor(response.nextCursor || null);
      } catch (err: any) {
        const message = err?.message || "Failed to load admin triage queue";
        setError(message);
        showToast({
          message: "Failed to load triage queue",
          description: message,
          variant: "error",
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, includeLow, resourceType, severity, showToast]
  );

  React.useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <MacShell title="Admin · Triage Queue">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Admin Triage Queue</h1>
                <Pill tone="accent">Operations</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 820 }}>
                Read-only queue of resources that need operator attention across monetization, policy, automation, and workflow friction signals.
              </div>
            </div>
            <Button variant="secondary" onClick={() => void load(null)} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Section>

        <TriageFilterBar
          category={category}
          severity={severity}
          resourceType={resourceType}
          includeLow={includeLow}
          loading={loading}
          onCategoryChange={setCategory}
          onSeverityChange={setSeverity}
          onResourceTypeChange={setResourceType}
          onIncludeLowChange={setIncludeLow}
          onRefresh={() => void load(null)}
        />

        {loading ? <Card>Loading triage queue…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>Failed to load triage queue: {error}</Card> : null}
        {!loading && !error ? (
          <Card>
            <TriageQueueTable items={items} />
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

