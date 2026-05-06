import React from "react";
import { Link } from "react-router-dom";
import type { RentalHistoryReference, VerifiedRentalHistoryLedger } from "@/api/rentalHistoryLedgerApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "review_required" || status === "missing" || status === "unavailable") {
    return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  }
  if (status === "verified" || status === "available") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  if (status === "partially_verified") return { color: "#9a3412", background: "#ffedd5", border: "#fed7aa" };
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

function ReferenceList({ title, references }: { title: string; references: RentalHistoryReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {references.length ? (
        references.slice(0, 8).map((reference) => (
          <Card key={`${reference.referenceType}:${reference.referenceId}`} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{reference.label || "Context unavailable"}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(reference.referenceType)}</div>
              </div>
              <Badge status={reference.status}>{label(reference.status)}</Badge>
            </div>
            {reference.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {reference.blockedReason}</div> : null}
            {reference.redacted ? <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>Redacted rental-history reference</div> : null}
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

export function VerifiedRentalHistoryPanel({ ledger }: { ledger: VerifiedRentalHistoryLedger }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View rental history</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>{ledger.identityId}</h2>
          </div>
          <Badge status={ledger.status}>{label(ledger.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Rental history references are permissioned and operationally scoped. Manual review remains required. No public sharing, bureau
          reporting, or tokenization is enabled.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status="review_required">Manual review required</Badge>
          <Badge status={ledger.publiclyShareable ? "blocked" : "available"}>Permission scoped</Badge>
          <Badge status={ledger.tokenizationEnabled ? "blocked" : "available"}>Tokenization disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Rental history summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["Entries", ledger.summary.totalEntries],
            ["Verified", ledger.summary.verifiedEntries],
            ["Properties", ledger.summary.propertiesReferenced],
            ["Leases", ledger.summary.leasesReferenced],
            ["Maintenance", ledger.summary.maintenanceReferences],
            ["Delinquency reviews", ledger.summary.delinquencyReviewReferences],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Occupancy timeline summaries</div>
        {ledger.historyEntries.length ? (
          ledger.historyEntries.map((entry) => (
            <Card key={entry.historyEntryId} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong>{label(entry.entryType)}</strong>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {entry.occupancyPeriod.startDate || "Start unavailable"} to {entry.occupancyPeriod.endDate || "current or unavailable"}
                  </div>
                </div>
                <Badge status={entry.status}>{label(entry.status)}</Badge>
              </div>
              <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>
                Verified references: {entry.verificationSummary.verifiedReferences}; missing: {entry.verificationSummary.missingReferences};
                blocked: {entry.verificationSummary.blockedReferences}
              </div>
              {entry.blockedReason ? <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>View blocked reason: {entry.blockedReason}</div> : null}
            </Card>
          ))
        ) : (
          <Card style={{ color: "#64748b" }}>No rental-history entries are available.</Card>
        )}
      </Section>

      <ReferenceList title="View verification lineage" references={ledger.verificationReferences} />
      <ReferenceList title="View evidence lineage" references={ledger.evidenceReferences} />
      <ReferenceList title="View review lineage" references={ledger.reviewReferences} />
      <ReferenceList title="Consent lineage" references={ledger.consentReferences} />

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {ledger.redactions.map((redaction) => (
          <Card key={redaction} style={{ borderRadius: 8, padding: 12, color: "#475569" }}>
            {redaction}
          </Card>
        ))}
      </Section>
    </div>
  );
}
