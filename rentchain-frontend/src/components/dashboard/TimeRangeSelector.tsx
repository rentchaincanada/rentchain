import React from "react";

export type TimeRange = "30d" | "90d" | "ytd";

type TimeRangeSelectorProps = {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
};

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const makeButton = (range: TimeRange, label: string) => {
    const isActive = value === range;
    return (
      <button
        type="button"
        className={`time-range-button ${isActive ? "active" : ""}`}
        onClick={() => onChange(range)}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="time-range-selector">
      <span className="time-range-label">Time range:</span>
      <div className="time-range-buttons">
        {makeButton("30d", "Last 30 days")}
        {makeButton("90d", "Last 90 days")}
        {makeButton("ytd", "Year to date")}
      </div>
    </div>
  );
}
