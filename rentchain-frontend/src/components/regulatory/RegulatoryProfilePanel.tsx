import React from "react";
import { Link } from "react-router-dom";
import type { RegulatoryProfile, RegulatoryReference } from "@/api/regulatoryProfileApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "partially_ready" || status === "partially_verified" || status === "unavailable") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
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

function ReferenceList({ title, references }: { title: string; references: RegulatoryReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {references.length ? (
        references.slice(0, 10).map((reference) => (
          <Card key={reference.referenceId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{reference.label}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(reference.referenceType)}</div>
              </div>
              <Badge status={reference.status}>{label(reference.status)}</Badge>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>{reference.description}</div>
            {reference.restrictionSummary.restricted ? (
              <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>View restrictions: {reference.restrictionSummary.reasons.join("; ") || "Manual review required."}</div>
            ) : null}
            {reference.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {reference.blockedReason}</div> : null}
            {reference.destination ? <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

export function RegulatoryProfilePanel({ profile }: { profile: RegulatoryProfile }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View regulatory profile</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>{profile.jurisdiction.country} / {profile.jurisdiction.province} / {profile.jurisdiction.municipality}</h2>
          </div>
          <Badge status={profile.status}>{label(profile.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Regulatory profiles are operational readiness references only. No legal certification or regulator submission is enabled. Manual review remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="partially_ready">Manual review required</Badge>
          <Badge status={profile.legalCertificationEnabled ? "blocked" : "verified"}>Legal certification disabled</Badge>
          <Badge status={profile.externalRegulatorSubmissionEnabled ? "blocked" : "verified"}>Regulator submission disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Regulatory summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["References", profile.summary.totalReferences],
            ["Verified", profile.summary.verifiedReferences],
            ["Partial", profile.summary.partiallyReadyReferences],
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

      <ReferenceList title="Registry references" references={profile.registryReferences} />
      <ReferenceList title="Screening and privacy readiness" references={[...profile.screeningReadiness, ...profile.privacyReadiness]} />
      <ReferenceList title="View restrictions" references={[...profile.sharingRestrictions, ...profile.settlementRestrictions]} />
      <ReferenceList title="View evidence lineage" references={profile.evidenceReferences} />
      <ReferenceList title="View review lineage" references={profile.reviewReferences} />

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {profile.redactions.map((redaction) => (
          <Card key={redaction} style={{ borderRadius: 8, padding: 12, color: "#475569" }}>{redaction}</Card>
        ))}
      </Section>
    </div>
  );
}
