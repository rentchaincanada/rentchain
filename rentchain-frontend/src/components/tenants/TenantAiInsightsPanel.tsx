// src/components/tenants/TenantAiInsightsPanel.tsx
import React, { useEffect, useState } from "react";
import {
  AiInsight,
  AiSeverity,
  TenantAiInsightsResponse,
  fetchTenantAiInsights,
} from "../../services/aiInsightsApi";

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

interface TenantAiInsightsPanelProps {
  tenantId: string | null;
}

export const TenantAiInsightsPanel: React.FC<TenantAiInsightsPanelProps> = ({
  tenantId,
}) => {
  const [data, setData] = useState<TenantAiInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!tenantId) {
        setData(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await fetchTenantAiInsights(tenantId);
        if (!cancelled) {
          setData(result);
        }
      } catch (err: any) {
        console.error("[TenantAiInsightsPanel] Failed to load", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load tenant AI insights");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <div
      style={{
        borderRadius: "1rem",
        border: "1px solid rgba(51,65,85,0.9)",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 55%) rgba(15,23,42,0.96)",
        padding: "0.9rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
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
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "rgb(226,232,240)",
            }}
          >
            Tenant AI insights
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "rgba(148,163,184,0.9)",
              marginTop: "0.15rem",
            }}
          >
            Behaviour, risk and credit-signal hints for this tenant.
          </div>
        </div>

        {data?.generatedAt && (
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(148,163,184,0.9)",
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

      {/* Summary / loading / error */}
      <div>
        {loading && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgba(148,163,184,0.9)",
              fontStyle: "italic",
            }}
          >
            Analyzing tenant history…
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

        {!loading && !error && data && (
          <div
            style={{
              padding: "0.5rem 0.7rem",
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

        {!loading && !error && !data && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgba(148,163,184,0.9)",
            }}
          >
            Select a tenant to see AI insights.
          </div>
        )}
      </div>

      {/* Insights list */}
      {!loading &&
        !error &&
        data &&
        data.insights &&
        data.insights.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              marginTop: "0.25rem",
            }}
          >
            {data.insights.map((insight: AiInsight) => (
              <div
                key={insight.id}
                style={{
                  padding: "0.5rem 0.65rem",
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
                      padding: "0.1rem 0.4rem",
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {insight.severity.toUpperCase()}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(148,163,184,0.95)",
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
