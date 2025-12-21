// src/components/dashboard/DashboardAiInsights.tsx
import React, { useEffect, useState } from "react";
import {
  AiInsight,
  AiSeverity,
  DashboardAiInsightsResponse,
  fetchDashboardAiInsights,
} from "../../services/aiInsightsApi";
import { useSubscription } from "../../context/SubscriptionContext";

function severityLabel(severity: AiSeverity) {
  switch (severity) {
    case "critical":
      return "High priority";
    case "warning":
      return "Watch";
    case "info":
    default:
      return "FYI";
  }
}

function severityChipStyle(severity: AiSeverity): React.CSSProperties {
  switch (severity) {
    case "critical":
      return {
        background: "rgba(248,113,113,0.15)",
        color: "rgb(248,113,113)",
        borderColor: "rgba(248,113,113,0.4)",
      };
    case "warning":
      return {
        background: "rgba(250,204,21,0.12)",
        color: "rgb(250,204,21)",
        borderColor: "rgba(250,204,21,0.4)",
      };
    case "info":
    default:
      return {
        background: "rgba(56,189,248,0.12)",
        color: "rgb(56,189,248)",
        borderColor: "rgba(56,189,248,0.4)",
      };
  }
}

export const DashboardAiInsights: React.FC = () => {
  const [data, setData] = useState<DashboardAiInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { features } = useSubscription();
  const canUsePortfolioAi = features.hasPortfolioAI;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchDashboardAiInsights();
        if (!cancelled) {
          setData(result);
        }
      } catch (err: any) {
        console.error("[DashboardAiInsights] Failed to load AI insights", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load AI insights");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (canUsePortfolioAi) {
      load();
    } else {
      setData(null);
      setLoading(false);
      setError(null);
    }

    return () => {
      cancelled = true;
    };
  }, [canUsePortfolioAi]);

  if (!canUsePortfolioAi) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(55,65,81,1)",
          padding: 12,
          backgroundColor: "rgba(15,23,42,1)",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "#ffffffff",
            marginBottom: 4,
            fontWeight: 500,
          }}
        >
          Portfolio AI insights are available on Pro plans
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#ffffffff",
          }}
        >
          Upgrade to <span style={{ fontWeight: 500 }}>Pro</span> or{" "}
          <span style={{ fontWeight: 500 }}>Elite</span> to see automated insights
          about occupancy risks, delinquency trends, and cash flow anomalies for
          your portfolio.
        </div>
      </div>
    );
  }

  // Basic layout container – you can tweak styles to match other cards
  return (
    <div
      style={{
        borderRadius: "1rem",
        border: "1px solid rgba(51,65,85,0.9)",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 55%) rgba(15,23,42,0.96)",
        padding: "1rem 1.2rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "rgb(226,232,240)",
            }}
          >
            Portfolio AI insights
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "rgba(255, 255, 255, 0.9)",
              marginTop: "0.15rem",
            }}
          >
            Early-warning signals based on your ledger and payments activity.
          </div>
        </div>

        {data?.generatedAt && (
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            Updated{" "}
            {new Date(data.generatedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      {/* Summary pill / loading / error */}
      <div>
        {loading && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgba(255, 255, 255, 0.9)",
              fontStyle: "italic",
            }}
          >
            Thinking through portfolio behaviour…
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgb(248,113,113)",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && data && data.summary && (
          <div
            style={{
              padding: "0.55rem 0.7rem",
              borderRadius: "999px",
              border: "1px solid rgba(59,130,246,0.5)",
              background: "rgba(15,23,42,0.9)",
              fontSize: "0.8rem",
              color: "rgba(226,232,240,0.95)",
            }}
          >
            {data.summary}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!loading && !error && data && data.insights && data.insights.length === 0 && (
        <div
          style={{
            padding: "0.75rem 0.85rem",
            borderRadius: "0.9rem",
            border: "1px solid rgba(51,65,85,0.8)",
            background: "rgba(15,23,42,0.9)",
            color: "rgba(226,232,240,0.95)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
            AI Insights (Coming soon)
          </div>
          <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", opacity: 0.85 }}>
            We’ll surface automated portfolio signals here as soon as they’re available.
          </div>
        </div>
      )}

      {/* Insights list */}
      {!loading && !error && data && data.insights && data.insights.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            marginTop: "0.3rem",
          }}
        >
          {data.insights.map((insight: AiInsight) => (
            <div
              key={insight.id}
              style={{
                padding: "0.55rem 0.7rem",
                borderRadius: "0.9rem",
                border: "1px solid rgba(30,64,175,0.7)",
                background: "rgba(15,23,42,0.9)",
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "rgb(226,232,240)",
                  }}
                >
                  {insight.title}
                </div>
                <div
                  style={{
                    ...severityChipStyle(insight.severity),
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderRadius: "999px",
                    padding: "0.1rem 0.45rem",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {severityLabel(insight.severity)}
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "rgba(255, 255, 255, 0.95)",
                  lineHeight: 1.4,
                }}
              >
                {insight.body}
              </div>

              {insight.tags && insight.tags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.3rem",
                    marginTop: "0.1rem",
                  }}
                >
                  {insight.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: "0.65rem",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "999px",
                        border: "1px solid rgba(51,65,85,0.9)",
                        color: "rgba(148,163,184,0.9)",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
