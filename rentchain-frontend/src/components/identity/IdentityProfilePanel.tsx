import React from "react";
import { Link } from "react-router-dom";
import type { IdentityLayerProfile, IdentityLayerReference } from "@/api/identityLayerApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "review_required" || status === "missing") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "verified" || status === "available" || status === "ready" || status === "provider_attested" || status === "institution_reviewed") {
    return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  }
  if (status === "partially_verified" || status === "limited" || status === "platform_correlated" || status === "authenticated") {
    return { color: "#9a3412", background: "#ffedd5", border: "#fed7aa" };
  }
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ children, status }: { children: React.ReactNode; status: string }) {
  const tone = statusTone(status);
  return (
    <span
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        background: tone.background,
        color: tone.color,
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

function ReferenceList({ title, references }: { title: string; references: IdentityLayerReference[] }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      {references.length ? (
        references.map((reference) => (
          <Card key={`${reference.referenceType}:${reference.referenceId}`} style={{ borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong style={{ color: "#0f172a" }}>{reference.label || "Context unavailable"}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{label(reference.referenceType)}</div>
              </div>
              <Badge status={reference.status}>{label(reference.status)}</Badge>
            </div>
            {reference.blockedReason ? (
              <div style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>Blocked reason: {reference.blockedReason}</div>
            ) : null}
            {reference.redacted ? (
              <div style={{ color: "#92400e", fontSize: 13, marginTop: 8 }}>Redacted identity reference</div>
            ) : null}
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

export function IdentityProfilePanel({ profile }: { profile: IdentityLayerProfile }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>View identity profile</div>
            <h2 style={{ margin: "2px 0 0", fontSize: "1.15rem" }}>{label(profile.identityType)}</h2>
          </div>
          <Badge status={profile.status}>{label(profile.status)}</Badge>
        </div>
        <div style={{ color: "#475569", lineHeight: 1.55 }}>
          Identity references are permissioned and operationally scoped. Manual review remains required. No public identity sharing or
          tokenization is enabled.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge status={profile.manualReviewRequired ? "review_required" : "unknown"}>Manual review required</Badge>
          <Badge status={profile.publiclyShareable ? "blocked" : "available"}>Permission scoped</Badge>
          <Badge status={profile.tokenizationEnabled ? "blocked" : "available"}>Tokenization disabled</Badge>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Verification summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            ["Total references", profile.verificationSummary.totalReferences],
            ["Verified", profile.verificationSummary.verifiedReferences],
            ["Missing", profile.verificationSummary.missingReferences],
            ["Blocked", profile.verificationSummary.blockedReferences],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Account trust state</div>
        <Card style={{ borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong>{profile.trustState.trustLabel}</strong>
              <div style={{ color: "#475569", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                {profile.trustState.trustDescription}
              </div>
            </div>
            <Badge status={profile.trustState.trustLevel}>{label(profile.trustState.trustLevel)}</Badge>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <Badge status={profile.trustState.manualReviewRequired ? "review_required" : "unknown"}>Manual review required</Badge>
            <Badge status={profile.trustState.providerIntegrationEnabled ? "available" : "limited"}>Provider integration disabled</Badge>
            <Badge status={profile.trustState.executionEligible ? "blocked" : "available"}>Execution disabled</Badge>
            <Badge status={profile.trustState.rawSensitivePayloadStored ? "blocked" : "available"}>Metadata only</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginTop: 12 }}>
            {[
              ["Signals", profile.trustState.signalSummary.totalSignals],
              ["Verified", profile.trustState.signalSummary.verifiedSignals],
              ["Provider attested", profile.trustState.signalSummary.providerAttestedSignals],
              ["Needs review", profile.trustState.signalSummary.reviewRequiredSignals],
            ].map(([name, value]) => (
              <div key={String(name)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
                <strong style={{ color: "#0f172a", fontSize: 18 }}>{String(value)}</strong>
              </div>
            ))}
          </div>
          {profile.trustState.missingSignals.length ? (
            <div style={{ color: "#92400e", fontSize: 13, marginTop: 10 }}>
              Missing trust signals: {profile.trustState.missingSignals.map(label).join(", ")}.
            </div>
          ) : null}
        </Card>
      </Section>

      <ReferenceList title="View verification lineage" references={profile.verificationReferences} />
      <ReferenceList title="View consent lineage" references={profile.consentReferences} />
      <ReferenceList title="View review lineage" references={profile.reviewReferences} />

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Portability readiness</div>
        <Card style={{ borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <strong>{profile.portabilitySummary.portableReferenceAvailable ? "Portable reference available" : "Portable reference limited"}</strong>
            <Badge status={profile.portabilitySummary.portabilityStatus}>{label(profile.portabilitySummary.portabilityStatus)}</Badge>
          </div>
          {profile.portabilitySummary.blockedReasons.map((reason) => (
            <div key={reason} style={{ color: "#991b1b", fontSize: 13, marginTop: 8 }}>
              View blocked reason: {reason}
            </div>
          ))}
        </Card>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {profile.redactions.map((redaction) => (
          <Card key={redaction} style={{ borderRadius: 8, padding: 12, color: "#475569" }}>
            {redaction}
          </Card>
        ))}
      </Section>
    </div>
  );
}
