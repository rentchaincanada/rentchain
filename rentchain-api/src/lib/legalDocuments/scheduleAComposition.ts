import type { LeaseDraftCore } from "../../services/leaseDraftsService";
import {
  legalExportMetadata,
  type LegalDocumentDefinition,
  type LegalDocumentField,
} from "./legalDocumentEngine";

export const NS_SCHEDULE_A_TEMPLATE_VERSION = "ns-schedule-a-v1";

function formatMoney(cents: number | null | undefined): string {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(value);
}

function termLabel(termType: LeaseDraftCore["termType"]): string {
  if (termType === "fixed") return "Fixed term";
  if (termType === "year-to-year") return "Year-to-year";
  return "Month-to-month";
}

function nonEmpty(value: string): string {
  return value.trim() || "Not specified";
}

function field(key: string, label: string, value: string | number): LegalDocumentField {
  return { key, label, value: String(value) };
}

export function composeScheduleALegalDocument(input: {
  draftId: string;
  draft: LeaseDraftCore;
  landlordDisplayName: string;
  tenantDisplayNames: string[];
  propertyAddressLine: string;
  unitLabel: string;
}): LegalDocumentDefinition {
  const { draft } = input;
  const utilities = draft.utilitiesIncluded.length ? draft.utilitiesIncluded.join(", ") : "None listed";
  const clauses = draft.additionalClauses?.trim() || "No additional clauses provided.";

  return {
    metadata: legalExportMetadata({
      documentKind: "schedule_a",
      title: "Schedule A addendum",
      version: NS_SCHEDULE_A_TEMPLATE_VERSION,
      province: "NS",
      templateKey: NS_SCHEDULE_A_TEMPLATE_VERSION,
      sensitivity: "restricted",
    }),
    heading: {
      title: "Schedule A addendum",
      subtitle: "Province: Nova Scotia (NS)",
      description: "Reference: Nova Scotia Standard Form of Lease (Form P). Review base lease terms.",
    },
    sections: [
      {
        id: "lease-summary",
        title: "Lease Summary",
        fields: [
          field("landlord", "Landlord", nonEmpty(input.landlordDisplayName || "Landlord")),
          field("tenants", "Tenant(s)", nonEmpty(input.tenantDisplayNames.join(", ") || "Tenant")),
          field("property", "Property", nonEmpty(input.propertyAddressLine || draft.propertyId)),
          field("unit", "Unit", nonEmpty(input.unitLabel || draft.unitId)),
          field("draftId", "Draft ID", nonEmpty(input.draftId)),
        ],
        layout: { avoidBreakInside: true },
      },
      {
        id: "term",
        title: "Term",
        fields: [
          field("termType", "Term type", termLabel(draft.termType)),
          field("startDate", "Start date", nonEmpty(draft.startDate)),
          field("endDate", "End date", nonEmpty(draft.endDate || "")),
          field("rentDueDay", "Rent due day", draft.dueDay),
        ],
        layout: { avoidBreakInside: true },
      },
      {
        id: "payments",
        title: "Payments",
        fields: [
          field("baseRent", "Base rent", formatMoney(draft.baseRentCents)),
          field("parking", "Parking", formatMoney(draft.parkingCents)),
          field("deposit", "Deposit", draft.depositCents != null ? formatMoney(draft.depositCents) : "Not specified"),
          field("nsfFee", "NSF fee", draft.nsfFeeCents != null ? formatMoney(draft.nsfFeeCents) : "Not specified"),
          field("paymentMethod", "Payment method", nonEmpty(draft.paymentMethod)),
          field("utilitiesIncluded", "Utilities included", utilities),
        ],
        layout: { avoidBreakInside: true },
      },
      {
        id: "additional-clauses",
        title: "Additional clauses",
        fields: [],
        body: clauses,
        layout: { avoidBreakInside: true },
      },
    ],
    footer: "This Schedule A addendum supplements Form P and does not replace the base lease form.",
  };
}
