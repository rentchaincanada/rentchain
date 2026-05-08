import type { LandlordActiveLease } from "@/api/leasesApi";

export type LegalDocumentMetadata = {
  documentType: string;
  title: string;
  version: string;
  province?: string | null;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
};

export type LegalDocumentField = {
  label: string;
  value: string;
};

export type LegalDocumentSection = {
  id: string;
  title: string;
  fields: LegalDocumentField[];
  note?: string | null;
  layout?: {
    avoidBreakInside?: boolean;
    signatureSafe?: boolean;
  };
};

export type LegalDocumentDefinition = {
  metadata: LegalDocumentMetadata;
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalDocumentSection[];
};

export type LeaseSummaryFormatters = {
  currency(value: number | null | undefined): string;
  date(value: string | null | undefined): string;
  status(value: string | null | undefined): string;
};

const CLAUSES_NOTE =
  "Full legal clauses remain in the attached lease document when one is available. This fallback view summarizes the landlord-visible lease record so the lease is still reviewable when no separate file is attached.";

function auditEventsNote(lease: LandlordActiveLease): string | null {
  const notes = [
    lease.leaseExecution
      ? `${lease.leaseExecution.executionLabel}: ${lease.leaseExecution.executionDescription}`
      : "",
    lease.leaseLifecycleSummary
      ? `${lease.leaseLifecycleSummary.lifecycleLabel}: ${lease.leaseLifecycleSummary.lifecycleDescription}`
      : "",
  ].filter(Boolean);
  return notes.length ? notes.join(" ") : null;
}

export function composeLeaseSummaryLegalDocument(
  lease: LandlordActiveLease,
  formatters: LeaseSummaryFormatters
): LegalDocumentDefinition {
  const sections: LegalDocumentSection[] = [
    {
      id: "property-unit",
      title: "Property and Unit",
      fields: [
        { label: "Property", value: lease.propertyName || lease.propertyLabel || lease.propertyAddress || "Property" },
        { label: "Unit", value: lease.unitNumber || "—" },
        { label: "Lease reference", value: lease.id },
      ],
      layout: { avoidBreakInside: true },
    },
    {
      id: "parties",
      title: "Landlord and Tenant",
      fields: [
        { label: "Tenant", value: lease.tenantName || "Tenant not linked" },
        { label: "Tenant email", value: lease.tenantEmail || "No email on file" },
        { label: "Landlord record", value: "Current RentChain landlord account" },
      ],
      layout: { avoidBreakInside: true },
    },
    {
      id: "term",
      title: "Lease Term",
      fields: [
        { label: "Start date", value: formatters.date(lease.startDate) },
        { label: "End date", value: formatters.date(lease.endDate) },
        { label: "Current status", value: formatters.status(lease.status) },
      ],
      layout: { avoidBreakInside: true },
    },
    {
      id: "rent-payment",
      title: "Rent and Payment Terms",
      fields: [
        { label: "Monthly rent", value: formatters.currency(lease.monthlyRent) },
        {
          label: "Payment readiness",
          value: lease.paymentReadiness?.readinessLabel || "Payment readiness unavailable",
        },
        {
          label: "Rent collection",
          value: lease.rentPaymentSummary?.paymentRail.enabled ? "Enabled" : "Not enabled",
        },
      ],
      note: lease.paymentReadiness?.readinessDescription || null,
      layout: { avoidBreakInside: true },
    },
    {
      id: "clauses",
      title: "Clauses and Additional Terms",
      fields: [],
      note: CLAUSES_NOTE,
      layout: { avoidBreakInside: true },
    },
  ];

  const auditNote = auditEventsNote(lease);
  if (auditNote) {
    sections.push({
      id: "audit-events",
      title: "Audit and Events",
      fields: [],
      note: auditNote,
      layout: { avoidBreakInside: true },
    });
  }

  return {
    metadata: {
      documentType: "lease_summary",
      title: "Residential Lease Pack",
      version: "lease-summary-v1",
      sensitivity: "confidential",
    },
    eyebrow: "RentChain lease record",
    title: "Residential Lease Pack",
    description: "Document-style summary generated from the current landlord lease record.",
    sections,
  };
}
