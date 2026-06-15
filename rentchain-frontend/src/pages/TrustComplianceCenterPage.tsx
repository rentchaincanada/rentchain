import React from "react";
import {
  fetchTrustComplianceSummary,
  type TrustComplianceCenterSummary,
  type TrustComplianceSectionSummary,
  type TrustComplianceStatus,
  type TrustComplianceSummaryItem,
} from "@/api/trustComplianceApi";
import { MacShell } from "@/components/layout/MacShell";
import { Card, Section } from "@/components/ui/Ui";
import { useToast } from "@/components/ui/ToastProvider";

function label(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const UNSAFE_DISPLAY_PATTERN =
  /gs:\/\/|storage\.googleapis\.com|providerRequestId|providerRequestRef|processor|paymentIntent|checkoutSession|stripe|secret|token|credential|rawPayload|messageBody|documentUrl|storagePath|screeningReport|bureau/i;

function safeDisplay(value: unknown, fallback: string) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text || UNSAFE_DISPLAY_PATTERN.test(text)) return fallback;
  if (/^[A-Za-z0-9_-]{18,}$/.test(text)) return fallback;
  return text;
}

function dateOrEmpty(value: string | null | undefined) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function statusTone(status: TrustComplianceStatus) {
  if (status === "ready") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  if (status === "needs_attention") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  return { color: "#475569", background: "#f8fafc", border: "#e2e8f0" };
}

function Badge({ status, children }: { status: TrustComplianceStatus; children: React.ReactNode }) {
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

function sourceLabel(value: string) {
  if (value === "available") return "Source available";
  if (value === "empty") return "No records yet";
  if (value === "access_unavailable") return "Access unavailable";
  return "Source unavailable";
}

function metadataRows(item: TrustComplianceSummaryItem) {
  const metadata = item.safeMetadata || {};
  return Object.entries(metadata).filter(([, value]) => value);
}

function SummaryItemCard({ item }: { item: TrustComplianceSummaryItem }) {
  const rows = metadataRows(item);
  return (
    <Card style={{ borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <strong style={{ color: "#0f172a" }}>{safeDisplay(item.label, "Governance summary")}</strong>
          <div style={{ color: "#64748b", fontSize: 13 }}>{safeDisplay(item.description, "Metadata-only summary")}</div>
        </div>
        {item.status ? (
          <span style={{ color: "#475569", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{label(item.status)}</span>
        ) : null}
      </div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{dateOrEmpty(item.occurredAt)}</div>
      {rows.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {rows.slice(0, 6).map(([key, value]) => (
            <span
              key={key}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                padding: "3px 8px",
                color: "#334155",
                fontSize: 12,
                background: "#fff",
              }}
            >
              {label(key)}: {key === "manifestHash" ? String(value) : safeDisplay(value, "Redacted")}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function SectionCard({ section }: { section: TrustComplianceSectionSummary }) {
  return (
    <Section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{section.label}</h2>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            {sourceLabel(section.sourceAvailability)} · {section.count} records · Last activity {dateOrEmpty(section.lastActivityAt)}
          </div>
        </div>
        <Badge status={section.status}>{label(section.status)}</Badge>
      </div>
      {section.items.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {section.items.map((item, index) => (
            <SummaryItemCard key={`${section.key}-${index}-${item.occurredAt || "none"}`} item={item} />
          ))}
        </div>
      ) : (
        <Card style={{ color: "#64748b", borderRadius: 8 }}>{section.emptyState}</Card>
      )}
    </Section>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load trust and compliance summary";
}

export default function TrustComplianceCenterPage() {
  const { showToast } = useToast();
  const [summary, setSummary] = React.useState<TrustComplianceCenterSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchTrustComplianceSummary();
        if (mounted) setSummary(result);
      } catch (err) {
        const message = errorMessage(err);
        if (mounted) {
          setError(message);
          showToast({ message: "Failed to load trust and compliance summary", description: message, variant: "error" });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  return (
    <MacShell title="Trust & Compliance Center" showTopNav={false}>
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Trust & Compliance Center</h1>
            <div style={{ color: "#475569", maxWidth: 920 }}>
              Read-only governance visibility across evidence, export, consent, privacy, retention, screening, audit, and incident readiness signals.
            </div>
          </div>
        </Section>

        {loading ? <Card>Loading trust and compliance summary...</Card> : null}
        {!loading && error ? (
          <Card style={{ color: "#b91c1c" }}>We couldn't load trust and compliance summary right now.</Card>
        ) : null}

        {!loading && !error && summary ? (
          <>
            <Section style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>Overall governance posture</div>
                  <div style={{ color: "#0f172a", fontSize: "1.1rem", fontWeight: 900 }}>{label(summary.overallStatus)}</div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>Generated {dateOrEmpty(summary.generatedAt)}</div>
                </div>
                <Badge status={summary.overallStatus}>{label(summary.overallStatus)}</Badge>
              </div>
            </Section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {summary.sections.map((section) => (
                <SectionCard key={section.key} section={section} />
              ))}
            </div>

            <Section style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Recent Audit Trail</div>
              {summary.recentAuditTrail.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {summary.recentAuditTrail.map((item, index) => (
                    <SummaryItemCard key={`audit-${index}-${item.occurredAt || "none"}`} item={item} />
                  ))}
                </div>
              ) : (
                <Card style={{ color: "#64748b", borderRadius: 8 }}>No recent governance audit events are available yet.</Card>
              )}
            </Section>

            <Section style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 900 }}>Redactions</div>
              {summary.redactions.map((redaction) => (
                <div key={redaction} style={{ color: "#475569", lineHeight: 1.55 }}>
                  {redaction}
                </div>
              ))}
            </Section>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
