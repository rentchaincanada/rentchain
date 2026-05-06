import React from "react";
import { Link } from "react-router-dom";
import {
  fetchAuditComplianceReadiness,
  type AuditComplianceCheck,
  type AuditComplianceReadiness,
} from "@/api/auditComplianceApi";
import { evidencePackPath } from "@/api/evidencePackApi";
import { reviewTimelinePath } from "@/api/reviewTimelineApi";
import { MacShell } from "@/components/layout/MacShell";
import { OperatorReviewSessionPanel } from "@/components/operatorReviews/OperatorReviewSessionPanel";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "needs_attention") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "passed" || status === "ready_for_review") {
    return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
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

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load audit and compliance readiness";
}

function CheckCard({ check }: { check: AuditComplianceCheck }) {
  return (
    <Card style={{ borderRadius: 8, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong style={{ color: "#0f172a" }}>{check.label}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>Severity: {label(check.severity)}</div>
        </div>
        <Badge status={check.status}>{label(check.status)}</Badge>
      </div>
      {check.evidence.length ? (
        <div style={{ color: "#166534", fontSize: 13 }}>Evidence: {check.evidence.join(" ")}</div>
      ) : null}
      {check.missingEvidence.length ? (
        <div style={{ color: "#92400e", fontSize: 13 }}>Missing evidence: {check.missingEvidence.join(" ")}</div>
      ) : null}
      {check.blockedReasons.length ? (
        <div style={{ color: "#991b1b", fontSize: 13 }}>Blocked: {check.blockedReasons.join(" ")}</div>
      ) : null}
      {check.manualReviewRequired ? (
        <div style={{ color: "#475569", fontSize: 12 }}>Manual review required</div>
      ) : null}
    </Card>
  );
}

export default function AuditCompliancePage() {
  const { showToast } = useToast();
  const [data, setData] = React.useState<AuditComplianceReadiness | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const readiness = await fetchAuditComplianceReadiness();
        if (!mounted) return;
        setData(readiness);
      } catch (err) {
        if (!mounted) return;
        const message = errorMessage(err);
        setError(message);
        showToast({ message: "Failed to load audit and compliance readiness", description: message, variant: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  return (
    <MacShell title="Audit and compliance readiness" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Audit and compliance readiness</h1>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Readiness only. This is not legal certification. No external filing or automated reporting is performed.
              Manual review is required before sharing or relying on this package.
            </div>
          </div>
        </Section>

        {loading ? <Card>Loading audit and compliance readiness...</Card> : null}
        {!loading && error ? (
          <Card style={{ color: "#b91c1c" }}>We couldn't load audit and compliance readiness right now.</Card>
        ) : null}

        {!loading && !error && data ? (
          <>
            <Section style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Readiness status</div>
                  <h2 style={{ margin: "2px 0 0", fontSize: "1.1rem" }}>{label(data.scope)}</h2>
                </div>
                <Badge status={data.status}>{label(data.status)}</Badge>
              </div>
              <div style={{ color: "#475569", lineHeight: 1.55 }}>
                Manual only: {data.manualOnly ? "Yes" : "No"}. Certification issued: {data.certificationIssued ? "Yes" : "No"}.
                External filing enabled: {data.externalFilingEnabled ? "Yes" : "No"}. Automated reporting enabled:{" "}
                {data.automatedReportingEnabled ? "Yes" : "No"}.
              </div>
            </Section>

            <Section style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {[
                  ["Total checks", data.summary.totalChecks],
                  ["Passed", data.summary.passed],
                  ["Needs attention", data.summary.needsAttention],
                  ["Blocked", data.summary.blocked],
                  ["Unavailable", data.summary.unavailable],
                ].map(([name, value]) => (
                  <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
                    <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
                    <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
                  </Card>
                ))}
              </div>
            </Section>

            <Section style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Review checks</div>
              <div style={{ display: "grid", gap: 10 }}>
                {data.checks.map((check) => (
                  <CheckCard key={check.checkKey} check={check} />
                ))}
              </div>
            </Section>

            <Section style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Redactions</div>
              {data.redactions.length ? (
                data.redactions.map((redaction) => (
                  <Card key={redaction.fieldCategory} style={{ borderRadius: 8, padding: 12 }}>
                    <strong style={{ color: "#0f172a" }}>{label(redaction.fieldCategory)}</strong>
                    <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{redaction.reason}</div>
                  </Card>
                ))
              ) : (
                <Card style={{ color: "#64748b" }}>No redaction metadata is available yet.</Card>
              )}
            </Section>

            <Section style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900 }}>Disclaimers</div>
              {data.disclaimers.map((disclaimer) => (
                <div key={disclaimer} style={{ color: "#475569", lineHeight: 1.55 }}>
                  {disclaimer}
                </div>
              ))}
            </Section>

            <Section>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  to={evidencePackPath({ scope: "audit_compliance", scopeId: data.readinessId })}
                  style={{ color: "#2563eb", fontWeight: 800 }}
                >
                  Preview evidence
                </Link>
                <Link
                  to={reviewTimelinePath({ scope: "audit_compliance", scopeId: data.readinessId })}
                  style={{ color: "#2563eb", fontWeight: 800 }}
                >
                  View timeline
                </Link>
              </div>
            </Section>

            <Section>
              <OperatorReviewSessionPanel
                scope="audit_compliance"
                scopeId={data.readinessId}
                linkedEvidence={[
                  {
                    evidenceId: data.readinessId,
                    label: "Audit and compliance readiness",
                    kind: "audit_readiness",
                    destination: "/audit-compliance",
                  },
                ]}
              />
            </Section>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
