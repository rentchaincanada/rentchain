import React from "react";
import { Link } from "react-router-dom";
import type {
  ProductionIntegrationProfile,
  ProductionIntegrationReference,
  ProductionIntegrationRestriction,
} from "@/api/productionIntegrationsApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "production_review_required" || status === "partially_ready" || status === "partially_verified" || status === "unavailable" || status === "disabled") {
    return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  }
  if (status === "sandbox_ready" || status === "verified") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
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

function ReferenceList({ title, references }: { title: string; references: ProductionIntegrationReference[] }) {
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
            {reference.redacted ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>{reference.redactionReason || "Redacted production integration reference"}</div> : null}
            {reference.destination?.startsWith("/") ? <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

function RestrictionList({ restrictions }: { restrictions: ProductionIntegrationRestriction[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>View restrictions</div>
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
        <Card style={{ color: "#64748b" }}>No production integration restrictions detected.</Card>
      )}
    </Section>
  );
}

export function ProductionIntegrationsPanel({ profile }: { profile: ProductionIntegrationProfile }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View production readiness</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>{label(profile.integrationType)}</h2>
          </div>
          <Badge status={profile.status}>{label(profile.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Production integrations are operationally scoped and review controlled. No autonomous synchronization or unrestricted external execution is enabled.
          Manual approval remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="production_review_required">Manual approval required</Badge>
          <Badge status={profile.autonomousExecutionEnabled ? "blocked" : "verified"}>External execution disabled</Badge>
          <Badge status={profile.paymentExecutionEnabled ? "blocked" : "verified"}>Payment execution disabled</Badge>
          <Badge status={profile.unrestrictedWebhookExecutionEnabled ? "blocked" : "verified"}>Webhook execution restricted</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Production readiness summary</div>
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

      <RestrictionList restrictions={profile.integrationRestrictions} />
      <ReferenceList title="View production readiness" references={profile.activationReferences} />
      <ReferenceList title="View observability readiness" references={profile.observabilityReferences} />
      <ReferenceList title="Rollback readiness" references={profile.rollbackReferences} />
      <ReferenceList title="Governance readiness" references={profile.governanceReferences} />
      <ReferenceList title="View review lineage" references={profile.reviewReferences} />
      <ReferenceList title="View evidence lineage" references={profile.evidenceReferences} />
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
