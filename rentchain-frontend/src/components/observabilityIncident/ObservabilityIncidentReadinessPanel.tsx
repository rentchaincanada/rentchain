import React from "react";
import { Link } from "react-router-dom";
import type {
  ObservabilityIncidentReadinessProfile,
  ObservabilityIncidentReference,
  ObservabilityIncidentRestriction,
} from "@/api/observabilityIncidentReadinessApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "review_required" || status === "partially_ready" || status === "partially_verified" || status === "unavailable") {
    return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  }
  if (status === "ready_for_review" || status === "verified") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
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

function ReferenceList({ title, references }: { title: string; references: ObservabilityIncidentReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {references.length ? (
        references.slice(0, 12).map((reference) => (
          <Card key={reference.referenceId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{reference.label}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(reference.referenceType)}</div>
              </div>
              <Badge status={reference.status}>{label(reference.status)}</Badge>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>{reference.description}</div>
            {reference.lineageReferences.length ? <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>Lineage references: {reference.lineageReferences.length}</div> : null}
            {reference.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {reference.blockedReason}</div> : null}
            {reference.redacted ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>{reference.redactionReason || "Redacted observability incident reference"}</div> : null}
            {reference.destination?.startsWith("/") ? <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

function RestrictionList({ restrictions }: { restrictions: ObservabilityIncidentRestriction[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>View readiness restrictions</div>
      {restrictions.length ? (
        restrictions.map((restriction) => (
          <Card key={restriction.restrictionId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{restriction.label}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(restriction.restrictionType)}</div>
              </div>
              <Badge status={restriction.status}>{label(restriction.status)}</Badge>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>{restriction.description}</div>
            {restriction.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {restriction.blockedReason}</div> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>No observability incident readiness restrictions detected.</Card>
      )}
    </Section>
  );
}

export function ObservabilityIncidentReadinessPanel({ profile }: { profile: ObservabilityIncidentReadinessProfile }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View incident readiness</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>Observability and incident readiness</h2>
          </div>
          <Badge status={profile.status}>{label(profile.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Observability and incident readiness is operationally scoped and review controlled. No external monitoring integration, alert sending, autonomous remediation, recovery execution, or production mutation is enabled.
          Manual review remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="review_required">Manual review required</Badge>
          <Badge status={profile.externalMonitoringIntegrationEnabled ? "blocked" : "verified"}>External monitoring disabled</Badge>
          <Badge status={profile.autonomousRemediationEnabled ? "blocked" : "verified"}>Autonomous remediation disabled</Badge>
          <Badge status={profile.alertSendingEnabled ? "blocked" : "verified"}>Alert sending disabled</Badge>
          <Badge status={profile.productionMutationEnabled ? "blocked" : "verified"}>Production mutation disabled</Badge>
          <Badge status={profile.sensitiveTelemetryExposed ? "blocked" : "verified"}>Sensitive telemetry excluded</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Readiness summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["References", profile.summary.totalReferences],
            ["Verified", profile.summary.verifiedReferences],
            ["Partial", profile.summary.partiallyVerifiedReferences],
            ["Blocked", profile.summary.blockedReferences],
            ["Unavailable", profile.summary.unavailableReferences],
            ["Restrictions", profile.summary.restrictions],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <RestrictionList restrictions={profile.observabilityIncidentRestrictions} />
      <ReferenceList title="View observability health" references={profile.observabilityReferences} />
      <ReferenceList title="View incident visibility" references={profile.incidentReferences} />
      <ReferenceList title="View outage lineage" references={profile.outageReferences} />
      <ReferenceList title="View recovery readiness" references={profile.recoveryReferences} />
      <ReferenceList title="View escalation readiness" references={profile.escalationReferences} />
      <ReferenceList title="View post-incident review" references={profile.postIncidentReviewReferences} />
      <ReferenceList title="View SLA readiness" references={profile.slaReferences} />
      <ReferenceList title="View alert visibility" references={profile.alertReferences} />
      <ReferenceList title="View release readiness" references={profile.releaseReferences} />
      <ReferenceList title="View public exposure readiness" references={profile.publicExposureReferences} />
      <ReferenceList title="View evidence lineage" references={profile.evidenceReferences} />
      <ReferenceList title="View review lineage" references={profile.reviewReferences} />
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
