import React from "react";
import { Link } from "react-router-dom";
import type { LeaseDelinquencySignal, LeaseObligationLedgerRow } from "@/api/leaseLedgerApi";
import { decisionStatusCopy, type DecisionItem } from "@/lib/decisions/decisionDisplay";
import { buildDecisionContextLinks, buildDecisionEvidenceItems } from "@/lib/decisions/decisionContext";

export function DecisionContextPanel({
  decision,
  obligationRows,
  delinquencySignals,
  includeAdminReviewLink = false,
  compact = false,
}: {
  decision: DecisionItem;
  obligationRows?: LeaseObligationLedgerRow[] | null;
  delinquencySignals?: LeaseDelinquencySignal[] | null;
  includeAdminReviewLink?: boolean;
  compact?: boolean;
}) {
  const links = buildDecisionContextLinks(decision, { includeAdminReviewLink });
  const evidenceItems = buildDecisionEvidenceItems(decision, { obligationRows, delinquencySignals });
  const latestAction = decision.latestAction;

  return (
    <div
      data-testid="decision-context-panel"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: compact ? 10 : 12,
        background: "#f8fafc",
        display: "grid",
        gap: compact ? 8 : 10,
      }}
    >
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ color: "#334155", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Context</div>
        {links.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {links.map((link) => (
              <Link
                key={`${link.key}-${link.href}`}
                to={link.href}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 999,
                  padding: "4px 9px",
                  background: "#fff",
                  color: "#0f172a",
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
                title={link.helperText}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ color: "#64748b", fontSize: 12 }}>Context unavailable</div>
        )}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ color: "#334155", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Evidence</div>
        <dl style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, margin: 0 }}>
          {evidenceItems.map((item) => (
            <div key={`${item.label}-${item.value}`} style={{ display: "grid", gap: 2 }}>
              <dt style={{ color: "#64748b", fontSize: 12 }}>{item.label}</dt>
              <dd style={{ color: "#0f172a", fontSize: 13, fontWeight: 700, margin: 0, overflowWrap: "anywhere" }}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ color: "#334155", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Review workflow trail</div>
        <div style={{ color: "#64748b", fontSize: 12 }}>Tracks operational review actions only.</div>
        <div style={{ color: "#475569", fontSize: 12 }}>
          Workflow status: <strong>{decisionStatusCopy[decision.status || "detected"]}</strong>
        </div>
        {latestAction ? (
          <div style={{ color: "#475569", fontSize: 12 }}>
            Last action: <strong>{decisionStatusCopy[latestAction.nextStatus]}</strong>
            {latestAction.actorEmail ? ` by ${latestAction.actorEmail}` : ""}
          </div>
        ) : (
          <div style={{ color: "#64748b", fontSize: 12 }}>No decision action history yet.</div>
        )}
      </div>
    </div>
  );
}

export default DecisionContextPanel;
