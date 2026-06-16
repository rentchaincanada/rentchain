import React from "react";
import type { LandlordActiveLease } from "@/api/leasesApi";
import { composeLeaseSummaryLegalDocument } from "@/lib/legalDocumentComposition";

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
      aria-labelledby={titleId}
      style={{
        display: "grid",
        gap: 10,
        padding: highlighted ? "18px 14px 14px" : "18px 0 0",
        borderTop: highlighted ? "2px solid #2563eb" : "1px solid #e2e8f0",
        borderRadius: highlighted ? 8 : 0,
        background: highlighted ? "#eff6ff" : "transparent",
        scrollMarginTop: 96,
        transition: "background-color 160ms ease, border-color 160ms ease",
      }}
    >
      <h2 id={titleId} style={{ margin: 0, fontSize: 16, letterSpacing: 0, color: "#0f172a" }}>{title}</h2>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <dt aria-label={label} style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0 }}>
        {label}
      </dt>
      <dd style={{ margin: 0, color: "#0f172a" }}>{value}</dd>
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
        border: "1px solid #dbe4ee",
        borderRadius: 6,
        background: "#fff",
        boxShadow: "0 14px 32px rgba(15,23,42,0.08)",
        display: "grid",
        gap: 22,
        overflowWrap: "anywhere",
      }}
    >
      <header style={{ display: "grid", gap: 8, textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0 }}>
          {documentDefinition.eyebrow}
        </div>
        <h1 id={titleId} style={{ margin: 0, fontSize: 26, letterSpacing: 0, color: "#0f172a" }}>{documentDefinition.title}</h1>
        <div id={descriptionId} style={{ color: "#475569" }}>
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
          {section.note ? <div style={{ color: "#475569", lineHeight: 1.6 }}>{section.note}</div> : null}
        </Section>
      ))}
    </article>
  );
}
