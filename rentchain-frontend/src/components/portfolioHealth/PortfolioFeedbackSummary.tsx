import React from "react";
import { Card, Section } from "../ui/Ui";

export default function PortfolioFeedbackSummary({
  summaries,
}: {
  summaries: string[];
}) {
  if (!summaries.length) return null;

  return (
    <Section>
      <Card elevated>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Resident feedback patterns</div>
          <div style={{ color: "#475569" }}>
            These summaries reflect broad feedback patterns only and do not include individual responses.
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {summaries.map((summary) => (
              <div key={summary} style={{ color: "#0f172a" }}>
                {summary}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </Section>
  );
}
