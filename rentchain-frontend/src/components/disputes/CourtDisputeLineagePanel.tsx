import React from "react";
import { Link } from "react-router-dom";
import type {
  CourtDisputeLineageProfile,
  CourtDisputeReference,
  CourtDisputeRestriction,
} from "@/api/courtDisputeLineageApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "review_required" || status === "partially_verified" || status === "unavailable") {
    return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  }
  if (status === "verified") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
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

function ReferenceList({ title, references }: { title: string; references: CourtDisputeReference[] }) {
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
            {reference.redacted ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>{reference.redactionReason || "Redacted court/dispute reference"}</div> : null}
            {reference.destination?.startsWith("/") ? <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

function RestrictionList({ restrictions }: { restrictions: CourtDisputeRestriction[] }) {
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
        <Card style={{ color: "#64748b" }}>No court/dispute restrictions detected.</Card>
      )}
    </Section>
  );
}

export function CourtDisputeLineagePanel({ profile }: { profile: CourtDisputeLineageProfile }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View dispute lineage</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>Court and dispute lineage</h2>
          </div>
          <Badge status={profile.status}>{label(profile.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Court and dispute lineage is operationally scoped and review controlled. No legal filing, collections execution, bureau reporting, or public court-record exposure is enabled.
          Manual review remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="review_required">Manual review required</Badge>
          <Badge status={profile.legalFilingExecutionEnabled ? "blocked" : "verified"}>Legal filing disabled</Badge>
          <Badge status={profile.collectionsExecutionEnabled ? "blocked" : "verified"}>Collections execution disabled</Badge>
          <Badge status={profile.bureauReportingEnabled ? "blocked" : "verified"}>Bureau reporting disabled</Badge>
          <Badge status={profile.publicCourtRecordExposureEnabled ? "blocked" : "verified"}>Public exposure disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Lineage summary</div>
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

      <RestrictionList restrictions={profile.courtDisputeRestrictions} />
      <ReferenceList title="View dispute lineage" references={profile.disputeReferences} />
      <ReferenceList title="View court reference" references={profile.courtRecordReferences} />
      <ReferenceList title="Filing preparedness metadata" references={profile.filingReadinessReferences} />
      <ReferenceList title="Judgment/order metadata" references={profile.judgmentOrderReferences} />
      <ReferenceList title="Rental debt linkage" references={profile.rentalDebtReferences} />
      <ReferenceList title="Consent governance lineage" references={profile.consentReferences} />
      <ReferenceList title="View review lineage" references={profile.reviewReferences} />
      <ReferenceList title="View evidence lineage" references={profile.evidenceReferences} />
      <ReferenceList title="Audit lineage" references={profile.auditReferences} />

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {profile.redactions.map((redaction) => (
          <Card key={redaction} style={{ borderRadius: 8, padding: 12, color: "#475569" }}>{redaction}</Card>
        ))}
      </Section>
    </div>
  );
}
