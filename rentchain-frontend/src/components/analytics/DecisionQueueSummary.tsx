import React from "react";
import type { LandlordAgentDecision } from "@/api/landlordAnalyticsApi";
import { aggregateDecisionStates, type DecisionExecutionFilter } from "./decisionExecutionAggregation";
import { executionStateDisplay } from "./decisionExecutionDisplay";

type Props = {
  decisions: LandlordAgentDecision[];
  filter: DecisionExecutionFilter;
  onFilterChange: (filter: DecisionExecutionFilter) => void;
};

const ORDERED_STATES = [
  "executable",
  "blocked",
  "already_executed",
  "unsafe_duplicate",
] as const;

function countLabel(value: number) {
  return value === 1 ? "1 decision" : `${value} decisions`;
}

export default function DecisionQueueSummary(props: Props) {
  const { decisions, filter, onFilterChange } = props;
  const summary = aggregateDecisionStates(decisions);

  return (
    <section
      aria-label="Operator queue"
      style={{
        display: "grid",
        gap: 12,
        padding: 16,
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        background: "#fff",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b" }}>
          Operator queue
        </div>
        <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
          Portfolio-level execution state summary
        </div>
        <div style={{ color: "#475569", fontSize: "0.92rem" }}>
          Scan what is ready now, what still needs attention, and what has already been handled.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          aria-pressed={filter === "all"}
          style={{
            borderRadius: 999,
            border: filter === "all" ? "1px solid #0f172a" : "1px solid #cbd5e1",
            background: filter === "all" ? "#0f172a" : "#fff",
            color: filter === "all" ? "#fff" : "#334155",
            fontWeight: 700,
            padding: "7px 12px",
            cursor: "pointer",
          }}
        >
          All decisions · {summary.total}
        </button>
        {ORDERED_STATES.map((state) => {
          const display = executionStateDisplay[state];
          const isActive = filter === state;
          return (
            <button
              key={state}
              type="button"
              onClick={() => onFilterChange(state)}
              aria-pressed={isActive}
              style={{
                borderRadius: 999,
                border: `1px solid ${isActive ? display.badgeTone.border : "#cbd5e1"}`,
                background: isActive ? display.badgeTone.bg : "#fff",
                color: isActive ? display.badgeTone.text : "#334155",
                fontWeight: 700,
                padding: "7px 12px",
                cursor: "pointer",
              }}
            >
              {display.label} · {summary.counts[state]}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {ORDERED_STATES.map((state) => {
          const display = executionStateDisplay[state];
          return (
            <div
              key={state}
              style={{
                display: "grid",
                gap: 4,
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${display.badgeTone.border}`,
                background: display.badgeTone.bg,
              }}
            >
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: display.badgeTone.text }}>
                {display.label}
              </div>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a" }}>
                {summary.counts[state]}
              </div>
              <div style={{ fontSize: "0.84rem", color: "#475569" }}>{countLabel(summary.counts[state])}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
