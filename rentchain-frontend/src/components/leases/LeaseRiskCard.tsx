import React from "react";
import type { LeaseRiskSnapshot } from "@/types/leaseRisk";
import { RiskScoreBadge } from "./RiskScoreBadge";

function formatConfidence(value?: number | null) {
  if (typeof value !== "number") return null;
  return `${Math.round(value * 100)}% confidence based on available data`;
}

function formatGeneratedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

interface LeaseRiskCardProps {
  risk?: LeaseRiskSnapshot | null;
  title?: string;
  compact?: boolean;
}

export const LeaseRiskCard: React.FC<LeaseRiskCardProps> = ({
  risk,
  title = "Lease Risk Snapshot",
  compact = false,
}) => {
  if (!risk) {
    return (
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(148,163,184,0.2)",
          background: "rgba(255,255,255,0.03)",
          padding: compact ? 12 : 14,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 700, color: "#e5e7eb" }}>{title}</div>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>
          Risk insights will appear when enough lease or applicant data is available.
        </div>
      </div>
    );
  }

  const visibleFlags = risk.flags.slice(0, compact ? 2 : 4);
  const visibleRecommendations = risk.recommendations.slice(0, compact ? 2 : 4);
  const confidenceLine = formatConfidence(risk.confidence);
  const generatedAt = formatGeneratedAt(risk.generatedAt);

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(96,165,250,0.18)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(15,23,42,0.06))",
        padding: compact ? 12 : 16,
        display: "grid",
        gap: compact ? 10 : 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, color: "#e5e7eb", fontSize: compact ? 15 : 16 }}>{title}</div>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            RentChain reviewed the available lease and tenant data to surface potential risk signals.
          </div>
        </div>
        <RiskScoreBadge grade={risk.grade} score={risk.score} compact={compact} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Metric label="Risk Score" value={String(risk.score)} />
        <Metric label="Grade" value={risk.grade} />
        <Metric label="Confidence" value={confidenceLine || "--"} />
        {generatedAt ? <Metric label="Generated" value={generatedAt} /> : null}
      </div>

      <div style={{ color: "#cbd5e1", fontSize: 13 }}>
        This score helps identify payment and stability risk using available lease data. It is decision support, not an approval or denial outcome.
      </div>

      {visibleFlags.length > 0 ? (
        <Section title="Signals">
          <ChipList items={visibleFlags} />
        </Section>
      ) : null}

      {visibleRecommendations.length > 0 ? (
        <Section title="Suggested Actions">
          <ul style={{ margin: 0, paddingLeft: 18, color: "#e2e8f0", fontSize: 13, display: "grid", gap: 4 }}>
            {visibleRecommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      borderRadius: 12,
      border: "1px solid rgba(148,163,184,0.16)",
      padding: "10px 12px",
      background: "rgba(15,23,42,0.18)",
    }}
  >
    <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
    <div style={{ color: "#f8fafc", fontSize: 14, fontWeight: 700, marginTop: 3 }}>{value}</div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ display: "grid", gap: 8 }}>
    <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{title}</div>
    {children}
  </div>
);

const ChipList: React.FC<{ items: string[] }> = ({ items }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    {items.map((item) => (
      <span
        key={item}
        style={{
          borderRadius: 999,
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(255,255,255,0.04)",
          color: "#e2e8f0",
          fontSize: 12,
          padding: "6px 10px",
        }}
      >
        {item}
      </span>
    ))}
  </div>
);
