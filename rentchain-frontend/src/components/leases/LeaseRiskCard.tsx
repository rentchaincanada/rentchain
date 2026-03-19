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

const cardSurface: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.28)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
  boxShadow: "0 14px 32px rgba(15,23,42,0.06)",
};

const titleColor = "#0f172a";
const bodyColor = "#334155";
const metaColor = "#475569";
const subtleColor = "#64748b";

export const LeaseRiskCard: React.FC<LeaseRiskCardProps> = ({
  risk,
  title = "Lease Risk Snapshot",
  compact = false,
}) => {
  if (!risk) {
    return (
      <div
        style={{
          ...cardSurface,
          padding: compact ? 12 : 16,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, color: titleColor, fontSize: compact ? 15 : 16 }}>{title}</div>
        <div style={{ color: metaColor, fontSize: 13, lineHeight: 1.5 }}>
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
        ...cardSurface,
        padding: compact ? 12 : 16,
        display: "grid",
        gap: compact ? 10 : 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 800, color: titleColor, fontSize: compact ? 15 : 16 }}>{title}</div>
          <div style={{ color: metaColor, fontSize: 13, lineHeight: 1.5 }}>
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

      <div style={{ color: bodyColor, fontSize: 13, lineHeight: 1.55 }}>
        This score helps identify payment and stability risk using available lease data. It is decision support, not an approval or denial outcome.
      </div>

      {visibleFlags.length > 0 ? (
        <Section title="Signals">
          <ChipList items={visibleFlags} />
        </Section>
      ) : null}

      {visibleRecommendations.length > 0 ? (
        <Section title="Suggested Actions">
          <ul style={{ margin: 0, paddingLeft: 18, color: bodyColor, fontSize: 13, lineHeight: 1.5, display: "grid", gap: 4 }}>
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
      border: "1px solid rgba(148,163,184,0.22)",
      padding: "10px 12px",
      background: "rgba(248,250,252,0.92)",
    }}
  >
    <div style={{ color: subtleColor, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>{label}</div>
    <div style={{ color: titleColor, fontSize: 14, fontWeight: 800, marginTop: 4, lineHeight: 1.4 }}>{value}</div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ display: "grid", gap: 8 }}>
    <div style={{ color: subtleColor, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>{title}</div>
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
          border: "1px solid rgba(148,163,184,0.24)",
          background: "rgba(248,250,252,0.96)",
          color: bodyColor,
          fontSize: 12,
          fontWeight: 600,
          padding: "6px 10px",
        }}
      >
        {item}
      </span>
    ))}
  </div>
);
