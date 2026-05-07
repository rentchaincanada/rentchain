import React from "react";
import { Link } from "react-router-dom";
import type { OperationalRiskProfile, OperationalRiskReference } from "@/api/operationalRiskApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked" || status === "critical") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "elevated" || status === "attention_required" || status === "partially_verified" || status === "unavailable" || status === "moderate") {
    return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  }
  if (status === "stable" || status === "verified" || status === "low") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
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

function ReferenceList({ title, references }: { title: string; references: OperationalRiskReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {references.length ? (
        references.slice(0, 12).map((reference) => (
          <Card key={reference.riskReferenceId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{reference.label}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(reference.riskType)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge status={reference.status}>{label(reference.status)}</Badge>
                <Badge status={reference.severity}>{label(reference.severity)}</Badge>
              </div>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>{reference.description}</div>
            {reference.lineageReferences.length ? <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>Lineage references: {reference.lineageReferences.length}</div> : null}
            {reference.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {reference.blockedReason}</div> : null}
            {reference.redacted ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>{reference.redactionReason || "Redacted operational risk reference"}</div> : null}
            {reference.destination ? <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

export function OperationalRiskPanel({ profile }: { profile: OperationalRiskProfile }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View operational risk</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>{label(profile.riskScope)}</h2>
          </div>
          <Badge status={profile.status}>{label(profile.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Operational risk visibility is operationally scoped and review controlled. No underwriting, autonomous enforcement, or public risk exposure is enabled.
          Manual review remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="attention_required">Manual review required</Badge>
          <Badge status={profile.autonomousRiskActionsEnabled ? "blocked" : "verified"}>Risk actions disabled</Badge>
          <Badge status={profile.publicRiskExposureEnabled ? "blocked" : "verified"}>Public risk visibility disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Risk summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["References", profile.summary.totalReferences],
            ["Verified", profile.summary.verifiedReferences],
            ["Partial", profile.summary.partiallyVerifiedReferences],
            ["Blocked", profile.summary.blockedReferences],
            ["Unavailable", profile.summary.unavailableReferences],
            ["Critical", profile.summary.criticalSeverityReferences],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <ReferenceList title="View restrictions" references={profile.riskReferences.filter((reference) => reference.status !== "verified")} />
      <ReferenceList title="View evidence lineage" references={profile.evidenceReferences} />
      <ReferenceList title="View review lineage" references={profile.reviewReferences} />
      <ReferenceList title="Settlement restrictions" references={profile.settlementReferences} />
      <ReferenceList title="Regulatory restrictions" references={profile.regulatoryReferences} />
      <ReferenceList title="Onboarding restrictions" references={profile.onboardingReferences} />
      <ReferenceList title="Trust restrictions" references={profile.trustReferences} />
      <ReferenceList title="Workflow instability" references={profile.workflowReferences} />
      <ReferenceList title="Delinquency exposure" references={profile.delinquencyReferences} />
      <ReferenceList title="Audit references" references={profile.auditReferences} />

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {profile.redactions.map((redaction) => (
          <Card key={redaction} style={{ borderRadius: 8, padding: 12, color: "#475569" }}>{redaction}</Card>
        ))}
      </Section>
    </div>
  );
}
