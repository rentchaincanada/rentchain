import React from "react";
import type { LandlordActiveLease } from "@/api/leasesApi";
import { composeLeaseSummaryLegalDocument } from "@/lib/legalDocumentComposition";

const leaseDocumentTheme = {
  card: "#fffaf1",
  cardStrong: "#fff6e8",
  border: "rgba(91, 70, 48, 0.18)",
  borderStrong: "rgba(91, 70, 48, 0.3)",
  charcoal: "#211c17",
  muted: "#63594d",
  subtle: "#7a6b5c",
  pine: "#245842",
  pineSoft: "rgba(36, 88, 66, 0.12)",
} as const;

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : 0;
  return amount.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function prettyLeaseStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function Section({
  id,
  title,
  anchorIds = true,
  highlighted = false,
  children,
}: React.PropsWithChildren<{ id: string; title: string; anchorIds?: boolean; highlighted?: boolean }>) {
  const titleId = `${id}-heading`;
  return (
    <section
      id={anchorIds ? id : undefined}
      tabIndex={anchorIds ? -1 : undefined}
      aria-labelledby={titleId}
      data-workflow-target={highlighted ? "true" : undefined}
      style={{
        display: "grid",
        gap: 10,
        padding: highlighted ? "18px 14px 14px" : "18px 0 0",
        borderTop: highlighted ? `2px solid ${leaseDocumentTheme.pine}` : `1px solid ${leaseDocumentTheme.border}`,
        borderRadius: highlighted ? 12 : 0,
        background: highlighted ? leaseDocumentTheme.pineSoft : "transparent",
        scrollMarginTop: 96,
        transition: "background-color 160ms ease, border-color 160ms ease",
      }}
    >
      <h2 id={titleId} style={{ margin: 0, fontSize: 16, letterSpacing: 0, color: leaseDocumentTheme.charcoal }}>{title}</h2>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <dt aria-label={label} style={{ fontSize: 12, fontWeight: 700, color: leaseDocumentTheme.subtle, textTransform: "uppercase", letterSpacing: 0 }}>
        {label}
      </dt>
      <dd style={{ margin: 0, color: leaseDocumentTheme.charcoal }}>{value}</dd>
    </div>
  );
}

export function LeaseDocumentView({
  lease,
  activeSectionId = null,
  anchorIds = true,
}: {
  lease: LandlordActiveLease;
  activeSectionId?: string | null;
  anchorIds?: boolean;
}) {
  const documentDefinition = composeLeaseSummaryLegalDocument(lease, {
    currency: formatCurrency,
    date: formatDate,
    status: prettyLeaseStatus,
  });
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <article
      data-testid="lease-document-view"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: 860,
        margin: "0 auto",
        padding: "clamp(18px, 5vw, 32px) clamp(14px, 5vw, 52px)",
        border: `1px solid ${leaseDocumentTheme.border}`,
        borderRadius: 18,
        background: `linear-gradient(180deg, ${leaseDocumentTheme.cardStrong} 0%, ${leaseDocumentTheme.card} 100%)`,
        boxShadow: "0 14px 32px rgba(59, 44, 28, 0.12)",
        display: "grid",
        gap: 22,
        overflowWrap: "anywhere",
      }}
    >
      <header style={{ display: "grid", gap: 8, textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: leaseDocumentTheme.subtle, textTransform: "uppercase", letterSpacing: 0 }}>
          {documentDefinition.eyebrow}
        </div>
        <h1 id={titleId} style={{ margin: 0, fontSize: 26, letterSpacing: 0, color: leaseDocumentTheme.charcoal }}>{documentDefinition.title}</h1>
        <div id={descriptionId} style={{ color: leaseDocumentTheme.muted }}>
          {documentDefinition.description}
        </div>
      </header>

      {documentDefinition.sections.map((section) => (
        <Section
          key={section.id}
          id={`lease-section-${section.id}`}
          title={section.title}
          anchorIds={anchorIds}
          highlighted={activeSectionId === `lease-section-${section.id}`}
        >
          {section.fields.length ? (
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, margin: 0 }}>
              {section.fields.map((field) => (
                <Field key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          ) : null}
          {section.note ? <div style={{ color: leaseDocumentTheme.muted, lineHeight: 1.6 }}>{section.note}</div> : null}
        </Section>
      ))}
    </article>
  );
}
