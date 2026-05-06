import React from "react";
import { Link } from "react-router-dom";
import type { SettlementReadiness, SettlementReference } from "@/api/settlementReadinessApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "partially_ready" || status === "partially_verified" || status === "missing" || status === "unavailable") {
    return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  }
  if (status === "ready_for_review" || status === "verified" || status === "available") {
    return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  }
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ children, status }: { children: React.ReactNode; status: string }) {
  const next = tone(status);
  return (
    <span
      style={{
        border: `1px solid ${next.border}`,
        borderRadius: 999,
        background: next.background,
        color: next.color,
        padding: "3px 9px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ReferenceList({ title, references }: { title: string; references: SettlementReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {references.length ? (
        references.slice(0, 10).map((reference) => (
          <Card key={reference.settlementReferenceId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{reference.label || "Context unavailable"}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(reference.referenceType)}</div>
              </div>
              <Badge status={reference.status}>{label(reference.status)}</Badge>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>{reference.description}</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
              Amount: {reference.amountSummary.amount ? `${reference.amountSummary.currency} ${reference.amountSummary.amount}` : "summary unavailable"}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <Badge status={reference.traceability.ledgerLinked ? "verified" : "unavailable"}>Ledger traceability</Badge>
              <Badge status={reference.traceability.reviewLinked ? "verified" : "unavailable"}>Review lineage</Badge>
              <Badge status={reference.traceability.evidenceLinked ? "verified" : "unavailable"}>Evidence lineage</Badge>
            </div>
            {reference.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {reference.blockedReason}</div> : null}
            {reference.redacted ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>{reference.redactionReason}</div> : null}
            {reference.destination ? (
              <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>
                View context
              </Link>
            ) : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

export function SettlementReadinessPanel({ readiness }: { readiness: SettlementReadiness }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View settlement readiness</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>{readiness.settlementReadinessId}</h2>
          </div>
          <Badge status={readiness.status}>{label(readiness.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Settlement readiness references are operational and review scoped. No payment execution or banking integration is enabled. Manual
          review remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="partially_ready">Manual review required</Badge>
          <Badge status={readiness.paymentExecutionEnabled ? "blocked" : "verified"}>Payment execution disabled</Badge>
          <Badge status={readiness.bankingIntegrationEnabled ? "blocked" : "verified"}>Banking integration disabled</Badge>
          <Badge status={readiness.tokenizationEnabled ? "blocked" : "verified"}>Tokenization disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Settlement summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[
            ["References", readiness.summary.totalReferences],
            ["Verified", readiness.summary.verifiedReferences],
            ["Partial", readiness.summary.partiallyVerifiedReferences],
            ["Blocked", readiness.summary.blockedReferences],
            ["Ledger amount", `CAD ${readiness.summary.totalLedgerAmount}`],
            ["Reconciled", `CAD ${readiness.summary.totalReconciledAmount}`],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Workflow dependencies</div>
        {readiness.workflowDependencies.map((dependency) => (
          <Card key={dependency.dependencyId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <strong>{dependency.label}</strong>
              <Badge status={dependency.status}>{label(dependency.status)}</Badge>
            </div>
            {dependency.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {dependency.blockedReason}</div> : null}
          </Card>
        ))}
      </Section>

      <ReferenceList title="View reconciliation lineage" references={readiness.reconciliationReferences} />
      <ReferenceList title="Ledger traceability" references={readiness.ledgerReferences} />
      <ReferenceList title="View evidence lineage" references={readiness.evidenceReferences} />
      <ReferenceList title="View review lineage" references={readiness.reviewReferences} />

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {readiness.redactions.map((redaction) => (
          <Card key={redaction} style={{ borderRadius: 8, padding: 12, color: "#475569" }}>
            {redaction}
          </Card>
        ))}
      </Section>
    </div>
  );
}
