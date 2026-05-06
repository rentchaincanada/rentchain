import React from "react";
import { Link } from "react-router-dom";
import type { NetworkParticipantProfile, NetworkParticipantReference, NetworkRelationshipReference } from "@/api/networkParticipantsApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "review_required" || status === "partially_verified" || status === "missing" || status === "unavailable") {
    return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  }
  if (status === "verified" || status === "available") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
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

function RelationshipList({ relationships }: { relationships: NetworkRelationshipReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>View relationships</div>
      {relationships.length ? (
        relationships.map((relationship) => (
          <Card key={relationship.relationshipId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{relationship.label}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(relationship.relationshipType)}</div>
              </div>
              <Badge status={relationship.status}>{label(relationship.status)}</Badge>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>{relationship.description}</div>
            {relationship.reviewLineage.length ? <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>View review lineage: {relationship.reviewLineage.length}</div> : null}
            {relationship.evidenceLineage.length ? <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>View evidence lineage: {relationship.evidenceLineage.length}</div> : null}
            {relationship.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {relationship.blockedReason}</div> : null}
            {relationship.destination ? <Link to={relationship.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View participant context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

function ReferenceList({ title, references }: { title: string; references: NetworkParticipantReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {references.length ? (
        references.map((reference) => (
          <Card key={reference.referenceId} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{reference.label}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(reference.referenceType)}</div>
              </div>
              <Badge status={reference.status}>{label(reference.status)}</Badge>
            </div>
            {reference.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {reference.blockedReason}</div> : null}
            {reference.redacted ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>Redacted participant reference</div> : null}
            {reference.destination ? <Link to={reference.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, marginTop: 8, display: "inline-block" }}>View context</Link> : null}
          </Card>
        ))
      ) : (
        <Card style={{ color: "#64748b" }}>Context unavailable</Card>
      )}
    </Section>
  );
}

export function NetworkParticipantPanel({ participant }: { participant: NetworkParticipantProfile }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View participant</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>{label(participant.participantType)}</h2>
          </div>
          <Badge status={participant.status}>{label(participant.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Network participants are permissioned operational actors. No public discovery or autonomous relationship execution is enabled.
          Manual review remains required.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="review_required">Manual review required</Badge>
          <Badge status={participant.publiclyDiscoverable ? "blocked" : "verified"}>Discovery disabled</Badge>
          <Badge status={participant.externalRelationshipExecutionEnabled ? "blocked" : "verified"}>Relationship execution disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Participant summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["Relationships", participant.summary.totalRelationships],
            ["Verified", participant.summary.verifiedRelationships],
            ["Partial", participant.summary.partiallyVerifiedRelationships],
            ["Blocked", participant.summary.blockedRelationships],
            ["Evidence", participant.summary.evidenceReferences],
            ["Reviews", participant.summary.reviewReferences],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <RelationshipList relationships={participant.relationshipReferences} />
      <ReferenceList title="Identity references" references={participant.identityReferences} />
      <ReferenceList title="View review lineage" references={participant.reviewReferences} />
      <ReferenceList title="View evidence lineage" references={participant.evidenceReferences} />
      <ReferenceList title="Permission references" references={participant.permissionReferences} />

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {participant.redactions.map((redaction) => (
          <Card key={redaction} style={{ borderRadius: 8, padding: 12, color: "#475569" }}>{redaction}</Card>
        ))}
      </Section>
    </div>
  );
}
