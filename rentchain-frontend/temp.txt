import React from "react";
import { getMyTenantEvents, type TenantEvent } from "../../api/tenantEvents";

function formatMoney(amountCents?: number, currency?: string) {
  if (!amountCents) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "CAD",
    }).format(amountCents / 100);
  } catch {
    return `$${(amountCents / 100).toFixed(2)} ${currency || ""}`.trim();
  }
}

function formatDate(ts: any) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function badgeText(e: TenantEvent) {
  if (e.type === "RENT_LATE" && typeof e.daysLate === "number") return `${e.daysLate} days late`;
  if (e.type === "RENT_PAID") return formatMoney(e.amountCents, e.currency);
  return null;
}

function severityClass(sev: TenantEvent["severity"]) {
  if (sev === "positive") return "sev-positive";
  if (sev === "negative") return "sev-negative";
  return "sev-neutral";
}

export function TenantReputationTimeline() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<TenantEvent[]>([]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getMyTenantEvents(100);
        if (!mounted) return;
        setItems(res.items || []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load timeline");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="card">{children}</div>
  );

  const Header = () => (
    <div className="cardHeader">
      <div className="cardTitle">Reputation timeline</div>
      <div className="cardSubtitle">Verified record of tenancy events</div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <Header />
        <div className="cardBody">Loading…</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Header />
        <div className="cardBody">
          <div className="emptyState">
            <div className="emptyTitle">Couldn’t load timeline</div>
            <div className="emptySubtitle">{error}</div>
          </div>
        </div>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card>
        <Header />
        <div className="cardBody">
          <div className="emptyState">
            <div className="emptyTitle">No events yet</div>
            <div className="emptySubtitle">
              Your landlord hasn’t recorded any tenancy events for this account.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Header />
      <div className="cardBody">
        <div className="timeline">
          {items.map((e) => {
            const badge = badgeText(e);
            return (
              <div key={e.id} className="timelineRow">
                <div className={`timelineDot ${severityClass(e.severity)}`} />
                <div className="timelineMain">
                  <div className="timelineTop">
                    <div className="timelineTitle">{e.title}</div>
                    <div className="timelineDate">{formatDate(e.occurredAt)}</div>
                  </div>
                  {e.description ? <div className="timelineDesc">{e.description}</div> : null}
                  <div className="timelineMeta">
                    {badge ? <span className="pill">{badge}</span> : null}
                    {e.anchorStatus && e.anchorStatus !== "none" ? (
                      <span className="pill">{`Anchor: ${e.anchorStatus}`}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
