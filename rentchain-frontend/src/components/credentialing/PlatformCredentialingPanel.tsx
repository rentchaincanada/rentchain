import React from "react";
import { Link } from "react-router-dom";
import type {
  CredentialingReference,
  CredentialingRestriction,
  PlatformCredentialingReadiness,
} from "@/api/platformCredentialingApi";
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

function ReferenceList({ title, references }: { title: string; references: CredentialingReference[] }) {
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
            {reference.redacted ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>{reference.redactionReason || "Redacted credentialing readiness reference"}</div> : null}
            {reference.destination?.startsWith("/") ? <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

function RestrictionList({ restrictions }: { restrictions: CredentialingRestriction[] }) {
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
        <Card style={{ color: "#64748b" }}>No credentialing restrictions detected.</Card>
      )}
    </Section>
  );
}

export function PlatformCredentialingPanel({ readiness }: { readiness: PlatformCredentialingReadiness }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View credentialing readiness</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>Platform credentialing readiness</h2>
          </div>
          <Badge status={readiness.status}>{label(readiness.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Platform credentialing readiness is operationally scoped and review controlled. No consumer-reporting execution or autonomous credential approval is enabled.
          Manual review remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="review_required">Manual review required</Badge>
          <Badge status={readiness.consumerReportingExecutionEnabled ? "blocked" : "verified"}>Consumer-reporting execution disabled</Badge>
          <Badge status={readiness.autonomousCredentialApprovalEnabled ? "blocked" : "verified"}>Credential approval disabled</Badge>
          <Badge status={readiness.publicCredentialExposureEnabled ? "blocked" : "verified"}>Public credential exposure disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Credentialing summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["References", readiness.summary.totalReferences],
            ["Verified", readiness.summary.verifiedReferences],
            ["Partial", readiness.summary.partiallyVerifiedReferences],
            ["Blocked", readiness.summary.blockedReferences],
            ["Unavailable", readiness.summary.unavailableReferences],
            ["Restrictions", readiness.summary.restrictions],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <RestrictionList restrictions={readiness.credentialingRestrictions} />
      <ReferenceList title="View governance references" references={readiness.governanceReferences} />
      <ReferenceList title="Privacy readiness" references={readiness.privacyReferences} />
      <ReferenceList title="View consent lineage" references={readiness.consentReferences} />
      <ReferenceList title="View audit lineage" references={readiness.auditReferences} />
      <ReferenceList title="Verification support" references={readiness.verificationReferences} />
      <ReferenceList title="Interoperability governance" references={readiness.interoperabilityReferences} />
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
