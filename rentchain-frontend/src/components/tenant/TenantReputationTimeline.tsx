import React from "react";
import { getTenantEvents, type TenantEvent } from "../../api/tenantEventsTenantApi";
import { TenantScorePill } from "./TenantScorePill";

function toMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  return null;
}

function formatWhen(ms: number | null) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(cents?: number | null, currency?: string | null) {
  if (typeof cents !== "number") return null;
  const amount = (cents / 100).toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
}

type Severity = "positive" | "neutral" | "negative";

function inferSeverityFallback(ev: TenantEvent): Severity {
  const s = (ev as any)?.severity as Severity | undefined;
  if (s === "positive" || s === "neutral" || s === "negative") return s;
  switch (ev.type) {
    case "RENT_PAID":
    case "LEASE_STARTED":
      return "positive";
    case "RENT_LATE":
    case "NOTICE_SERVED":
      return "negative";
    case "LEASE_ENDED":
    default:
      return "neutral";
  }
}

function severityBadge(sev: Severity) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    background: "#F9FAFB",
    fontSize: 12,
    lineHeight: "18px",
    fontWeight: 600,
    userSelect: "none",
    whiteSpace: "nowrap",
  };
  const dot: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: sev === "positive" ? "#16A34A" : sev === "negative" ? "#DC2626" : "#6B7280",
  };
  const label = sev === "positive" ? "Good" : sev === "negative" ? "Risk" : "Neutral";
  return (
    <span style={base} title={`Severity: ${sev}`}>
      <span style={dot} />
      {label}
    </span>
  );
}

function typePill(type: string) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #E5E7EB",
        background: "#FFFFFF",
        fontSize: 12,
        lineHeight: "18px",
        fontWeight: 600,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
      title={type}
    >
      {type.replaceAll("_", " ")}
    </span>
  );
}

function chip(text: string) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 10,
        border: "1px solid #EEF2F7",
        background: "#F8FAFC",
        fontSize: 12,
        lineHeight: "18px",
        fontWeight: 600,
        color: "#374151",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function skeletonRow(key: string) {
  const bar = (w: string) => (
    <div
      style={{
        width: w,
        height: 10,
        borderRadius: 999,
        background: "#EEF2F7",
      }}
    />
  );

  return (
    <div key={key} style={{ display: "flex", gap: 12 }}>
      <div style={{ width: 26, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 10, height: 10, borderRadius: 999, background: "#E5E7EB" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          {bar("40%")}
          {bar("20%")}
        </div>
        {bar("70%")}
        <div style={{ display: "flex", gap: 8 }}>
          {bar("18%")}
          {bar("16%")}
          {bar("22%")}
        </div>
      </div>
    </div>
  );
}

function tierLabel(tier: string) {
  if (tier === "low") return "Low risk";
  if (tier === "medium") return "Medium risk";
  if (tier === "high") return "High risk";
  return "Neutral";
}

function tierDotColor(tier: string) {
  if (tier === "low") return "#16A34A";
  if (tier === "medium") return "#F59E0B";
  if (tier === "high") return "#DC2626";
  return "#6B7280";
}

export function TenantReputationTimeline({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<TenantEvent[]>([]);
  const [nextCursor, setNextCursor] = React.useState<any>(null);

  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<any>(null);

  async function load(initial = false) {
    setError(null);
    setLoading(true);
    try {
      const resp = await getTenantEvents(25);
      const newItems = (resp as any)?.items ?? [];
      setItems(newItems);
      setNextCursor(null);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load timeline");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    if (!tenantId) return;
    setSummaryLoading(true);
    try {
      const resp = await getTenantSummary(tenantId);
      setSummary(resp?.item || null);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  React.useEffect(() => {
    load(true);
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const canLoadMore = !!nextCursor && !loading;
  const score = typeof summary?.scoreV1 === "number" ? summary.scoreV1 : null;
  const tier = summary?.tierV1 || null;
  const sig = summary?.signals || null;
  const lastUpdatedMs = toMillis(summary?.updatedAt);
  const updatedLabel = lastUpdatedMs ? `Updated ${formatWhen(lastUpdatedMs)}` : "";

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 16,
        background: "#FFFFFF",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontWeight: 900, fontSize: 14 }}>Reputation Timeline</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Snapshot-backed  append-only record {updatedLabel ? ` ${updatedLabel}` : ""}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, alignItems: "center" }}>
            <TenantScorePill score={summaryLoading ? null : score} tier={summaryLoading ? null : tier} />

            {summaryLoading ? chip("Loading summary") : null}

            {!summaryLoading && sig ? (
              <>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 800,
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                  title="Risk tier"
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: tierDotColor(sig.riskTier),
                    }}
                  />
                  {tierLabel(sig.riskTier)}
                </span>
                {chip(`On-time streak: ${sig.onTimeStreak}`)}
                {chip(`Late (90d): ${sig.lateCount90d}`)}
                {chip(`Paid (90d): ${sig.rentPaid90d}`)}
                {chip(`Notices (12m): ${sig.notices12m}`)}
              </>
            ) : null}
          </div>

          {!summaryLoading && summary?.reasons?.length ? (
            <div
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 14,
                border: "1px solid #EEF2F7",
                background: "#F8FAFC",
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6, opacity: 0.9 }}>Why this score</div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {summary.reasons.slice(0, 5).map((r: string, idx: number) => (
                  <li key={idx} style={{ opacity: 0.9 }}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              load(true);
              loadSummary();
            }}
            disabled={loading || summaryLoading}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              cursor: loading || summaryLoading ? "default" : "pointer",
              opacity: loading || summaryLoading ? 0.65 : 1,
              fontWeight: 800,
            }}
          >
            Refresh
          </button>
        </div>
      </div>
      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Couldn&apos;t load timeline</div>
          <div style={{ opacity: 0.9 }}>{error}</div>
        </div>
      ) : null}

      {!error && !loading && items.length === 0 ? (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px dashed #E5E7EB",
            background: "#FAFAFA",
            opacity: 0.9,
          }}
        >
          No tenant events recorded yet.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 8,
            bottom: 8,
            width: 2,
            background: "#EEF2F7",
            borderRadius: 999,
          }}
        />

        {loading && items.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {skeletonRow("sk1")}
            {skeletonRow("sk2")}
            {skeletonRow("sk3")}
          </div>
        ) : null}

        {items.map((ev) => {
          const createdMs = toMillis(ev.createdAt);
          const when = formatWhen(createdMs);

          const sev = inferSeverityFallback(ev);
          const money = formatMoney(ev.amountCents, ev.currency);
          const chips: string[] = [];
          if (money) chips.push(money);
          if (typeof ev.daysLate === "number") chips.push(`${ev.daysLate} days late`);
          if (ev.noticeType) chips.push(String(ev.noticeType));

          const title = (ev.title || "").trim() || ev.type.replaceAll("_", " ");

          return (
            <div key={ev.id} style={{ display: "flex", gap: 12, position: "relative" }}>
              <div style={{ width: 26, display: "flex", justifyContent: "center" }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: sev === "positive" ? "#16A34A" : sev === "negative" ? "#DC2626" : "#6B7280",
                    border: "2px solid #FFFFFF",
                    boxShadow: "0 0 0 2px #EEF2F7",
                    marginTop: 6,
                    zIndex: 1,
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  border: "1px solid #EEF2F7",
                  borderRadius: 14,
                  padding: 12,
                  background: "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{title}</div>
                    {ev.description ? (
                      <div style={{ opacity: 0.85, fontSize: 13 }}>{ev.description}</div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>{when}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {severityBadge(sev)}
                      {typePill(ev.type)}
                    </div>
                  </div>
                </div>

                {chips.length > 0 ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{chips.map((c) => chip(c))}</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Showing {items.length} event{items.length === 1 ? "" : "s"}
        </div>
        {canLoadMore ? (
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.65 : 1,
              fontWeight: 800,
            }}
          >
            Load more
          </button>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.65 }}>{items.length > 0 ? "Up to date" : ""}</div>
        )}
      </div>
    </div>
  );
}

export default TenantReputationTimeline;










