import React, { memo, useCallback, useMemo } from "react";
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

type FilterButtonProps = {
  value: DecisionExecutionFilter;
  label: string;
  count: number;
  active: boolean;
  onSelect: (filter: DecisionExecutionFilter) => void;
  tone?: {
    bg: string;
    border: string;
    text: string;
  };
};

const DecisionQueueFilterButton = memo(function DecisionQueueFilterButton({
  value,
  label,
  count,
  active,
  onSelect,
  tone,
}: FilterButtonProps) {
  const handleClick = useCallback(() => onSelect(value), [onSelect, value]);
  const activeBorder = tone?.border || "#0f172a";
  const activeBackground = tone?.bg || "#0f172a";
  const activeColor = tone?.text || "#fff";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      style={{
        borderRadius: 999,
        border: active ? `1px solid ${activeBorder}` : "1px solid #cbd5e1",
        background: active ? activeBackground : "#fff",
        color: active ? activeColor : "#334155",
        fontWeight: 700,
        padding: "7px 12px",
        cursor: "pointer",
      }}
    >
      {label} · {count}
    </button>
  );
});

const DecisionQueueSummary = memo(function DecisionQueueSummary(props: Props) {
  const { decisions, filter, onFilterChange } = props;
  const summary = useMemo(() => aggregateDecisionStates(decisions), [decisions]);
  const stateFilters = useMemo(
    () =>
      ORDERED_STATES.map((state) => ({
        state,
        display: executionStateDisplay[state],
        count: summary.counts[state],
      })),
    [summary]
  );
  const handleFilterChange = useCallback((nextFilter: DecisionExecutionFilter) => onFilterChange(nextFilter), [onFilterChange]);

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
        <DecisionQueueFilterButton
          value="all"
          label="All decisions"
          count={summary.total}
          active={filter === "all"}
          onSelect={handleFilterChange}
        />
        {stateFilters.map(({ state, display, count }) => (
          <DecisionQueueFilterButton
            key={state}
            value={state}
            label={display.label}
            count={count}
            active={filter === state}
            onSelect={handleFilterChange}
            tone={display.badgeTone}
          />
        ))}
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {stateFilters.map(({ state, display, count }) => (
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
              {count}
            </div>
            <div style={{ fontSize: "0.84rem", color: "#475569" }}>{countLabel(count)}</div>
          </div>
        ))}
      </div>
    </section>
  );
});

export default DecisionQueueSummary;
