// @ts-nocheck
// rentchain-frontend/src/components/dashboard/AiPortfolioDrawer.tsx
import React, { useState } from "react";
import { usePortfolioSummary } from "../../hooks/usePortfolioSummary";

const tabs = [
  { id: "health", label: "Portfolio Health" },
  { id: "risks", label: "Risk Map" },
  { id: "forecast", label: "Cashflow Forecast" },
  { id: "tenants", label: "Tenant Risk" },
  { id: "opportunities", label: "Opportunities" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const safeInt = (n?: number, fallback = "0") =>
  Number.isFinite(n) ? Math.round(n!).toString() : fallback;

export const AiPortfolioDrawer: React.FC = () => {
  const { data, loading, error } = usePortfolioSummary();
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabId>("health");

  const safeData = {
    summary: data?.summary ?? "",
    healthScore: Number.isFinite(data?.healthScore) ? (data!.healthScore as number) : 0,
    timeframeLabel: data?.timeframeLabel ?? "—",
    kpis: {
      occupancyRate: data?.kpis?.occupancyRate ?? 0,
      monthlyRentRoll: data?.kpis?.monthlyRentRoll ?? 0,
      monthlyCollected: data?.kpis?.monthlyCollected ?? 0,
      monthlyDelinquent: data?.kpis?.monthlyDelinquent ?? 0,
      collectionRatio: data?.kpis?.collectionRatio ?? 0,
      delinquencyRatio: data?.kpis?.delinquencyRatio ?? 0,
    },
    trend: data?.trend ?? { collectionsDirection: "flat", riskDirection: "flat" as const },
    risks: data?.risks ?? [],
    opportunities: data?.opportunities ?? [],
  };

  const toggle = () => setIsOpen((prev) => !prev);

  const healthTone =
    !data || typeof data.healthScore !== "number"
      ? "neutral"
      : safeData.healthScore >= 85
      ? "strong"
      : safeData.healthScore >= 70
      ? "ok"
      : safeData.healthScore >= 50
      ? "watch"
      : "danger";

  const healthLabel =
    healthTone === "strong"
      ? "Strong"
      : healthTone === "ok"
      ? "Healthy"
      : healthTone === "watch"
      ? "Watchlist"
      : healthTone === "danger"
      ? "At Risk"
      : "Snapshot";

  return (
    <div
      style={{
        marginTop: "1rem",
        marginBottom: "1.25rem",
        borderRadius: "0.9rem",
        background:
          "radial-gradient(circle at top left, rgba(56,189,248,0.18), rgba(15,23,42,0.95))",
        border: "1px solid rgba(94,234,212,0.55)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* Header / collapsed view */}
      <button
        type="button"
        onClick={toggle}
        style={{
          display: "flex",
          width: "100%",
          border: "none",
          background: "transparent",
          color: "white",
          padding: "0.85rem 1rem",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              opacity: 0.8,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1.2rem",
                height: "1.2rem",
                borderRadius: "999px",
                backgroundColor: "rgba(241, 241, 241, 0.85)",
                border: "1px solid rgba(94,234,212,0.6)",
                fontSize: "0.75rem",
              }}
            >
              🤖
            </span>
            <span>AI Portfolio Intelligence</span>
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              opacity: 0.95,
            }}
          >
            {loading && "Analyzing portfolio…"}
            {error && `Failed to load AI summary: ${error}`}
            {!loading && !error && data && safeData.summary}
          </div>
          {!loading && !error && data && (
            <div
              style={{
                fontSize: "0.75rem",
                opacity: 0.75,
                marginTop: "0.1rem",
              }}
            >
              {safeData.timeframeLabel ?? "—"} • Health: {healthLabel} (
              {safeInt(safeData.healthScore)}/100)
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {!loading && !error && (
            <HealthPill healthScore={safeData.healthScore ?? 0} />
          )}
          <span
            style={{
              fontSize: "1.2rem",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms ease",
              opacity: 0.65,
            }}
          >
            ⌃
          </span>
        </div>
      </button>

      {/* Expandable body */}
      <div
        style={{
          maxHeight: isOpen ? "460px" : "0px",
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 220ms ease, opacity 220ms ease",
          borderTop: "1px solid rgba(15,23,42,0.7)",
          background:
            "radial-gradient(circle at bottom right, rgba(15,23,42,0.98), rgba(15,23,42,0.92))",
        }}
      >
        <div
          style={{
            padding: "0.75rem 1rem 1rem",
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: "0.35rem",
              marginBottom: "0.6rem",
              flexWrap: "wrap",
            }}
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    borderRadius: "999px",
                    border: isActive
                      ? "1px solid rgba(94,234,212,0.9)"
                      : "1px solid rgba(148,163,184,0.5)",
                    padding: "0.22rem 0.7rem",
                    fontSize: "0.75rem",
                    backgroundColor: isActive
                      ? "rgba(15,23,42,0.95)"
                      : "transparent",
                    color: "white",
                    cursor: "pointer",
                    opacity: isActive ? 1 : 0.7,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div
            style={{
              borderRadius: "0.6rem",
              backgroundColor: "rgba(235, 235, 235, 0.9)",
              border: "1px solid rgba(30,64,175,0.7)",
              padding: "0.75rem 0.9rem",
              fontSize: "0.8rem",
              minHeight: "140px",
            }}
          >
            {loading && (
              <div style={{ opacity: 0.8 }}>Loading portfolio summary…</div>
            )}
            {error && (
              <div
                style={{
                  color: "#fecaca",
                }}
              >
                Failed to load portfolio summary: {error}
              </div>
            )}
            {!loading && !error && data && (
              <TabContent activeTab={activeTab} data={safeData as any} />
            )}
          </div>

          <div
            style={{
              marginTop: "0.5rem",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.7rem",
              opacity: 0.7,
            }}
          >
            <span>Powered by RentChain AI</span>
            <span>
              This panel summarizes your whole portfolio at a glance for owners
              & investors.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const HealthPill: React.FC<{ healthScore: number }> = ({ healthScore }) => {
  let label = "Snapshot";
  let bg = "#ffffff33";
  let border = "1px solid rgba(148,163,184,0.7)";

  if (healthScore >= 85) {
    label = "Strong";
    bg = "rgba(255, 255, 255, 0.2)";
    border = "1px solid rgba(34,197,94,0.8)";
  } else if (healthScore >= 70) {
    label = "Healthy";
    bg = "rgba(56,189,248,0.2)";
    border = "1px solid rgba(56,189,248,0.8)";
  } else if (healthScore >= 50) {
    label = "Watchlist";
    bg = "rgba(234,179,8,0.2)";
    border = "1px solid rgba(234,179,8,0.8)";
  } else {
    label = "At Risk";
    bg = "rgba(239,68,68,0.2)";
    border = "1px solid rgba(239,68,68,0.8)";
  }

  return (
    <div
      style={{
        borderRadius: "999px",
        padding: "0.15rem 0.6rem",
        backgroundColor: bg,
        border,
        fontSize: "0.75rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label} · {safeInt(healthScore)}/100
    </div>
  );
};

const TabContent: React.FC<{
  activeTab: TabId;
  data: PortfolioSummary;
}> = ({ activeTab, data }) => {
  const { kpis, risks, opportunities } = data;
  const fmtMoney = (n?: number) =>
    Number.isFinite(n) ? (n as number).toFixed(2) : "0.00";
  const fmtPct = (n?: number) =>
    Number.isFinite(n) ? (n as number).toFixed(1) + "%" : "—";

  const occPct =
    typeof kpis.occupancyRate === "number"
      ? fmtPct(kpis.occupancyRate * 100)
      : "—";

  const collectedPct =
    typeof kpis.collectionRatio === "number"
      ? fmtPct(kpis.collectionRatio * 100)
      : "—";

  const delinquencyPct =
    typeof kpis.delinquencyRatio === "number"
      ? fmtPct(kpis.delinquencyRatio * 100)
      : "—";

  if (activeTab === "health") {
    return (
      <div>
        <div
          style={{
            marginBottom: "0.4rem",
            fontWeight: 600,
            fontSize: "0.82rem",
          }}
        >
          Portfolio Health Snapshot
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: "1.1rem",
          }}
        >
          <li>Occupancy: {occPct}</li>
          <li>
            Collections vs rent roll: {collectedPct} (delinquency:{" "}
            {delinquencyPct})
          </li>
          {kpis.monthlyRentRoll && (
            <li>
              Rent Roll: $
              {kpis.monthlyRentRoll.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </li>
          )}
          {kpis.monthlyCollected && (
            <li>
              Collected this period: $
              {kpis.monthlyCollected.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </li>
          )}
          {kpis.monthlyDelinquent && (
            <li>
              Delinquent: $
              {kpis.monthlyDelinquent.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </li>
          )}
        </ul>
      </div>
    );
  }

  if (activeTab === "risks") {
    return (
      <div>
        <div
          style={{
            marginBottom: "0.4rem",
            fontWeight: 600,
            fontSize: "0.82rem",
          }}
        >
          Risk Map
        </div>
        {risks.length === 0 ? (
          <div style={{ opacity: 0.8 }}>
            No major risks surfaced at this time, based on current KPIs.
          </div>
        ) : (
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.1rem",
            }}
          >
            {risks.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (activeTab === "forecast") {
    // For now we derive a basic forecast narrative from existing KPIs.
    return (
      <div>
        <div
          style={{
            marginBottom: "0.4rem",
            fontWeight: 600,
            fontSize: "0.82rem",
          }}
        >
          Cashflow Forecast (Prototype)
        </div>
        <div style={{ opacity: 0.9 }}>
          Based on current occupancy ({occPct}) and collections ({collectedPct}),
          your portfolio is{" "}
          {data.healthScore >= 80
            ? "positioned for stable near-term cashflow."
            : data.healthScore >= 60
            ? "showing a mix of strengths and pressure points."
            : "signaling caution; tightening collections and addressing vacancy will materially improve the outlook."}
        </div>
        {kpis.monthlyCollected && (
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "0.78rem",
              opacity: 0.8,
            }}
          >
            If current trends hold, next-period collections should be in the
            same ballpark as the current{" "}
            {`$${kpis.monthlyCollected.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}`}{" "}
            unless risk hotspots worsen.
          </div>
        )}
      </div>
    );
  }

  if (activeTab === "tenants") {
    return (
      <div>
        <div
          style={{
            marginBottom: "0.4rem",
            fontWeight: 600,
            fontSize: "0.82rem",
          }}
        >
          Tenant Risk Breakdown (Prototype)
        </div>
        <div style={{ opacity: 0.9 }}>
          This prototype uses high-level KPIs only. As more tenant-level AI
          signals are wired in (late patterns, income vs rent, payment habits),
          this tab will highlight:
        </div>
        <ul
          style={{
            margin: "0.4rem 0 0",
            paddingLeft: "1.1rem",
          }}
        >
          <li>Top stable tenants by payment reliability.</li>
          <li>Tenants trending toward late payment behavior.</li>
          <li>Early-warning flags based on changes in timing or amount.</li>
        </ul>
      </div>
    );
  }

  // opportunities
  return (
    <div>
      <div
        style={{
          marginBottom: "0.4rem",
          fontWeight: 600,
          fontSize: "0.82rem",
        }}
      >
        Opportunity Engine
      </div>
      {opportunities.length === 0 ? (
        <div style={{ opacity: 0.8 }}>
          As more historical data accumulates, this section will surface
          rent-raise, renewal, and optimization opportunities automatically.
        </div>
      ) : (
        <ul
          style={{
            margin: 0,
            paddingLeft: "1.1rem",
          }}
        >
          {opportunities.map((o, idx) => (
            <li key={idx}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
