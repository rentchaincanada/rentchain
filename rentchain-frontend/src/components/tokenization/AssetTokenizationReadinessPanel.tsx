import React from "react";
import { Link } from "react-router-dom";
import type { AssetTokenizationReadiness, AssetTokenizationReference } from "@/api/assetTokenizationReadinessApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "partially_ready" || status === "partially_verified" || status === "unavailable") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "eligible_for_review" || status === "verified") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ children, status }: { children: React.ReactNode; status: string }) {
  const next = tone(status);
  return (
    <span style={{ border: `1px solid ${next.border}`, borderRadius: 999, background: next.background, color: next.color, padding: "3px 9px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function ReferenceList({ title, references }: { title: string; references: AssetTokenizationReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {references.length ? (
        references.slice(0, 10).map((reference) => (
          <Card key={reference.assetReferenceId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{reference.label}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(reference.referenceType)}</div>
              </div>
              <Badge status={reference.status}>{label(reference.status)}</Badge>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>{reference.description}</div>
            {reference.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {reference.blockedReason}</div> : null}
            {reference.redactionReason ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>{reference.redactionReason}</div> : null}
            {reference.destination ? <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

export function AssetTokenizationReadinessPanel({ readiness }: { readiness: AssetTokenizationReadiness }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View readiness</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>{label(readiness.assetType)}</h2>
          </div>
          <Badge status={readiness.status}>{label(readiness.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Asset tokenization readiness is operational and review scoped. No token issuance, blockchain integration, or public marketplace is enabled.
          Manual review remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="partially_ready">Manual review required</Badge>
          <Badge status={readiness.tokenIssuanceEnabled ? "blocked" : "verified"}>Token issuance disabled</Badge>
          <Badge status={readiness.blockchainIntegrationEnabled ? "blocked" : "verified"}>Blockchain integration disabled</Badge>
          <Badge status={readiness.publicMarketplaceEnabled ? "blocked" : "verified"}>Marketplace disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Readiness summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["References", readiness.summary.totalReferences],
            ["Verified", readiness.summary.verifiedReferences],
            ["Partial", readiness.summary.partiallyVerifiedReferences],
            ["Blocked", readiness.summary.blockedReferences],
            ["Unavailable", readiness.summary.unavailableReferences],
            ["Eligible", readiness.summary.tokenizationEligibleReferences],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <ReferenceList title="Canonical asset references" references={readiness.assetReferences} />
      <ReferenceList title="Lease cashflow and occupancy" references={[...readiness.cashflowReferences, ...readiness.occupancyReferences]} />
      <ReferenceList title="Maintenance and performance" references={readiness.maintenancePerformanceReferences} />
      <ReferenceList title="View settlement lineage" references={readiness.settlementReadinessReferences} />
      <ReferenceList title="View regulatory lineage" references={readiness.regulatoryProfileReferences} />
      <ReferenceList title="View evidence lineage" references={readiness.evidenceReferences} />
      <ReferenceList title="Review lineage" references={readiness.reviewReferences} />

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {readiness.redactions.map((redaction) => (
          <Card key={redaction} style={{ borderRadius: 8, padding: 12, color: "#475569" }}>{redaction}</Card>
        ))}
      </Section>
    </div>
  );
}
