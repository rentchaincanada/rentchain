import React, { useEffect, useState } from "react";
import { Card, Button } from "../ui/Ui";
import { fetchPortfolioAiSummary } from "@/api/dashboardApi";
import type { PortfolioAiResponse } from "@/api/dashboardApi";
import { text, colors, spacing, radius } from "../../styles/tokens";

const CACHE_KEY = "portfolio_ai_summary";

export const PortfolioAiSummaryCard: React.FC = () => {
  const [data, setData] = useState<PortfolioAiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (skipCache?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      if (!skipCache) {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          setData(JSON.parse(cached));
          setLoading(false);
          return;
        }
      }
      const resp = await fetchPortfolioAiSummary();
      setData(resp);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(resp));
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      const isForbidden =
        err?.status === 403 ||
        msg.includes("403") ||
        err?.body?.error === "forbidden" ||
        err?.payload?.error === "forbidden";
      if (isForbidden) {
        // Feature locked for current plan — silently treat as unavailable
        setData(null);
        setError(null);
      } else {
        console.warn("[PortfolioAiSummaryCard] AI summary failed", err);
        setError(err?.message || "Unable to load AI summary");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRefresh = () => {
    sessionStorage.removeItem(CACHE_KEY);
    void load(true);
  };

  const rawSummary =
    data && typeof data === "object" && "aiSummary" in data
      ? (data as any).aiSummary
      : undefined;

  const aiSummary = rawSummary ?? {
    healthLabel: "Snapshot",
    summaryText: "AI summary not available yet.",
    risks: [] as string[],
    opportunities: [] as string[],
    suggestedActions: [] as string[],
  };

  const badgeColor =
    aiSummary.healthLabel === "Excellent"
      ? "#22c55e"
      : aiSummary.healthLabel === "At Risk"
      ? colors.danger
      : "#f59e0b";

  return (
    <Card elevated>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.sm,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
            Portfolio AI Summary
          </div>
          <div style={{ color: text.muted, fontSize: "0.9rem" }}>
            Snapshot of occupancy, collections, and risks.
          </div>
        </div>
        <Button variant="secondary" onClick={handleRefresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: colors.danger,
            borderRadius: radius.md,
            padding: spacing.sm,
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {loading && !data ? (
        <div style={{ color: text.muted, fontSize: "0.9rem" }}>
          Generating summary…
        </div>
      ) : data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <div
            style={{
              alignSelf: "flex-start",
              padding: "4px 10px",
              borderRadius: radius.pill,
              border: `1px solid ${badgeColor}`,
              color: badgeColor,
              background: "rgba(59,130,246,0.05)",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {aiSummary.healthLabel}
          </div>
          <div style={{ fontSize: "0.95rem", color: text.primary }}>
            {aiSummary.summaryText}
          </div>
          <SummaryList title="Risks" items={aiSummary.risks} />
          <SummaryList title="Opportunities" items={aiSummary.opportunities} />
          <SummaryList title="Suggested actions" items={aiSummary.suggestedActions} />
        </div>
      ) : null}
    </Card>
  );
};

const SummaryList: React.FC<{ title: string; items: string[] }> = ({
  title,
  items,
}) => {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: 4 }}>
        {title}
      </div>
      {items && items.length > 0 ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: "1rem",
            color: text.muted,
            fontSize: "0.9rem",
            lineHeight: 1.5,
          }}
        >
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <div style={{ color: text.subtle, fontSize: "0.9rem" }}>No items</div>
      )}
    </div>
  );
};
