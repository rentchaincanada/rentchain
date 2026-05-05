import React from "react";
import type { LandlordActiveLease } from "@/api/leasesApi";

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : 0;
  return amount.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function prettyLeaseStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section style={{ display: "grid", gap: 10, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
      <h2 style={{ margin: 0, fontSize: 16, letterSpacing: 0, color: "#0f172a" }}>{title}</h2>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0 }}>
        {label}
      </div>
      <div style={{ color: "#0f172a" }}>{value}</div>
    </div>
  );
}

export function LeaseDocumentView({ lease }: { lease: LandlordActiveLease }) {
  return (
    <article
      data-testid="lease-document-view"
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
          RentChain lease record
        </div>
        <h1 style={{ margin: 0, fontSize: 26, letterSpacing: 0, color: "#0f172a" }}>Residential Lease Pack</h1>
        <div style={{ color: "#475569" }}>
          Document-style summary generated from the current landlord lease record.
        </div>
      </header>

      <Section title="Property and Unit">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Property" value={lease.propertyName || lease.propertyLabel || lease.propertyAddress || "Property"} />
          <Field label="Unit" value={lease.unitNumber || "—"} />
          <Field label="Lease reference" value={lease.id} />
        </div>
      </Section>

      <Section title="Landlord and Tenant">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Tenant" value={lease.tenantName || "Tenant not linked"} />
          <Field label="Tenant email" value={lease.tenantEmail || "No email on file"} />
          <Field label="Landlord record" value="Current RentChain landlord account" />
        </div>
      </Section>

      <Section title="Lease Term">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Start date" value={formatDate(lease.startDate)} />
          <Field label="End date" value={formatDate(lease.endDate)} />
          <Field label="Current status" value={prettyLeaseStatus(lease.status)} />
        </div>
      </Section>

      <Section title="Rent and Payment Terms">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Monthly rent" value={formatCurrency(lease.monthlyRent)} />
          <Field label="Payment readiness" value={lease.paymentReadiness?.readinessLabel || "Payment readiness unavailable"} />
          <Field
            label="Rent collection"
            value={lease.rentPaymentSummary?.paymentRail.enabled ? "Enabled" : "Not enabled"}
          />
        </div>
        {lease.paymentReadiness?.readinessDescription ? (
          <div style={{ color: "#475569", lineHeight: 1.5 }}>{lease.paymentReadiness.readinessDescription}</div>
        ) : null}
      </Section>

      <Section title="Clauses and Additional Terms">
        <div style={{ color: "#475569", lineHeight: 1.6 }}>
          Full legal clauses remain in the attached lease document when one is available. This fallback view summarizes the
          landlord-visible lease record so the lease is still reviewable when no separate file is attached.
        </div>
      </Section>

      {lease.leaseExecution || lease.leaseLifecycleSummary ? (
        <Section title="Audit and Events">
          {lease.leaseExecution ? (
            <div style={{ display: "grid", gap: 4 }}>
              <strong>{lease.leaseExecution.executionLabel}</strong>
              <span style={{ color: "#475569" }}>{lease.leaseExecution.executionDescription}</span>
            </div>
          ) : null}
          {lease.leaseLifecycleSummary ? (
            <div style={{ display: "grid", gap: 4 }}>
              <strong>{lease.leaseLifecycleSummary.lifecycleLabel}</strong>
              <span style={{ color: "#475569" }}>{lease.leaseLifecycleSummary.lifecycleDescription}</span>
            </div>
          ) : null}
        </Section>
      ) : null}
    </article>
  );
}
