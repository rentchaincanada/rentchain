import React from "react";
import { Link } from "react-router-dom";
import { type EvidencePack } from "@/api/evidencePackApi";
import { reviewTimelinePath } from "@/api/reviewTimelineApi";
import { Card, Section } from "@/components/ui/Ui";

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string) {
  if (status === "blocked") return { color: "#991b1b", background: "#fee2e2", border: "#fecaca" };
  if (status === "incomplete" || status === "unavailable") return { color: "#92400e", background: "#fef3c7", border: "#fde68a" };
  if (status === "included" || status === "ready_for_review") return { color: "#166534", background: "#dcfce7", border: "#bbf7d0" };
  if (status === "redacted") return { color: "#1d4ed8", background: "#dbeafe", border: "#bfdbfe" };
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

export function EvidencePackPanel({ evidencePack }: { evidencePack: EvidencePack }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Section>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Evidence details</h2>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                {label(evidencePack.scope)} · {evidencePack.scopeId}
              </div>
            </div>
            <Badge status={evidencePack.status}>{label(evidencePack.status)}</Badge>
          </div>
          <div style={{ color: "#475569", lineHeight: 1.55 }}>
            Preview only. Evidence is not shared externally. Manual review is required before relying on or sharing this
            evidence. Sensitive data may be excluded or redacted.
          </div>
          <div style={{ color: "#475569", fontSize: 13 }}>
            Manual review required: {evidencePack.manualReviewRequired ? "Yes" : "No"}. External sharing enabled:{" "}
            {evidencePack.externalSharingEnabled ? "Yes" : "No"}. Certification issued:{" "}
            {evidencePack.certificationIssued ? "Yes" : "No"}.
          </div>
          <Link
            to={reviewTimelinePath({ scope: "evidence_pack", scopeId: evidencePack.evidencePackId })}
            style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}
          >
            View timeline
          </Link>
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
          {[
            ["Total items", evidencePack.summary.totalItems],
            ["Included", evidencePack.summary.includedItems],
            ["Redacted", evidencePack.summary.redactedItems],
            ["Blocked", evidencePack.summary.blockedItems],
            ["Missing", evidencePack.summary.missingItems],
          ].map(([name, value]) => (
            <Card key={String(name)} style={{ borderRadius: 8, padding: 12 }}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{name}</div>
              <strong style={{ color: "#0f172a", fontSize: 22 }}>{String(value)}</strong>
            </Card>
          ))}
        </div>
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Evidence sections</div>
        {evidencePack.sections.map((section) => (
          <Card key={section.sectionKey} style={{ borderRadius: 8, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{section.label}</strong>
                <div style={{ color: "#64748b", fontSize: 13 }}>{section.itemsCount} evidence items</div>
              </div>
              <Badge status={section.status}>{label(section.status)}</Badge>
            </div>
            {section.items.slice(0, 5).map((item) => (
              <div key={item.evidenceItemId} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8, display: "grid", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ color: "#0f172a", fontSize: 13 }}>{item.label}</strong>
                  <Badge status={item.status}>{label(item.status)}</Badge>
                </div>
                <div style={{ color: "#475569", fontSize: 13 }}>{item.description}</div>
                {item.redactionReason ? <div style={{ color: "#1d4ed8", fontSize: 12 }}>{item.redactionReason}</div> : null}
                {item.blockedReason ? <div style={{ color: "#991b1b", fontSize: 12 }}>{item.blockedReason}</div> : null}
                {item.destination ? (
                  <Link to={item.destination} style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}>
                    View context
                  </Link>
                ) : null}
              </div>
            ))}
            {section.missingEvidence.length ? (
              <div style={{ color: "#92400e", fontSize: 13 }}>Missing evidence: {section.missingEvidence.join(" ")}</div>
            ) : null}
            {section.blockedReasons.length ? (
              <div style={{ color: "#991b1b", fontSize: 13 }}>Blocked: {section.blockedReasons.join(" ")}</div>
            ) : null}
          </Card>
        ))}
      </Section>

      <Section style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Redactions</div>
        {evidencePack.redactions.length ? (
          evidencePack.redactions.map((redaction) => (
            <Card key={redaction.fieldCategory} style={{ borderRadius: 8, padding: 12 }}>
              <strong>{label(redaction.fieldCategory)}</strong>
              <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{redaction.reason}</div>
            </Card>
          ))
        ) : (
          <Card style={{ color: "#92400e" }}>Review missing evidence: redaction metadata is unavailable.</Card>
        )}
      </Section>

      <Section style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 900 }}>Disclaimers</div>
        {evidencePack.disclaimers.map((disclaimer) => (
          <div key={disclaimer} style={{ color: "#475569", lineHeight: 1.55 }}>
            {disclaimer}
          </div>
        ))}
      </Section>
    </div>
  );
}
