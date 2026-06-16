import PDFDocument from "pdfkit";
import type { JurisdictionLeaseDocumentAdapter, PrimaryLeaseDocumentInput } from "../leaseDocumentTypes";

function text(value: unknown, fallback = "Not provided") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function money(centsOrDollars: unknown) {
  const value = Number(centsOrDollars || 0);
  const dollars = value > 10000 ? value / 100 : value;
  return dollars.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function collectPdf(write: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    write(doc);
    doc.end();
  });
}

function configuredBoolean(name: string): boolean | null {
  const explicit = String(process.env[name] || "").trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;
  return null;
}

function isTestDocumentMode() {
  const documentGenerationMode = configuredBoolean("LEASE_DOCUMENT_GENERATION_TEST_MODE");
  if (documentGenerationMode !== null) return documentGenerationMode;
  const legacyDocumentSourceMode = configuredBoolean("SIGNING_DOCUMENT_SOURCE_TEST_MODE");
  if (legacyDocumentSourceMode !== null) return legacyDocumentSourceMode;
  const signingProviderTestMode = configuredBoolean("SIGNING_PROVIDER_TEST_MODE");
  if (signingProviderTestMode !== null) return signingProviderTestMode;
  return String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production";
}

function productionReadinessNotice() {
  const base =
    "Generated lease package. Review all details and applicable Nova Scotia requirements before signing. RentChain does not provide legal advice or guarantee enforceability.";
  return isTestDocumentMode() ? `Preview/test environment: ${base}` : base;
}

function closingReadinessNotice() {
  const base =
    "Generated from RentChain lease workflow using provincial workflow inputs. Review all lease details and applicable Nova Scotia requirements before use. RentChain does not provide legal advice, certification, notarization, or an enforceability guarantee.";
  return isTestDocumentMode() ? `Preview/test environment: ${base}` : base;
}

export const caNsLeaseDocumentAdapter: JurisdictionLeaseDocumentAdapter = {
  jurisdictionCode: "CA_NS",
  templateVersion: "ca-ns-primary-lease-draft-v1",
  effectiveDate: "2026-06-15",
  counselReviewStatus: "draft",
  signingEnabled: false,
  productionApproved: false,
  requiredSections: [
    "parties",
    "occupants",
    "premises",
    "emergency_contact",
    "agent",
    "property_manager",
    "building_superintendent",
    "email_service_of_documents",
    "service_of_notices_documents",
    "lease_type",
    "public_housing",
    "rent",
    "rent_increases",
    "rental_incentive",
    "rent_includes",
    "tenant_responsibilities",
    "additional_obligations",
    "security_deposit",
    "inspection",
    "statutory_conditions_reasonable_rules",
    "assignment_sublet",
    "rental_arrears",
    "tenant_notice_to_quit",
    "landlord_notice_to_quit",
    "general_binding_clause",
    "tenant_terms_responsibility",
    "attachments_initials",
    "sign_and_date",
    "schedule_a_statutory_conditions",
  ],
  requiredDisclosures: [
    "Form P is the Nova Scotia Standard Form of Lease under the Residential Tenancies Act.",
    "A landlord's lease may look different, but must contain all Form P items; missing items may apply anyway.",
    "Residential lease terms must be reviewed against Nova Scotia requirements before production use.",
  ],
  requiredNotices: [
    "Schedule A statutory conditions are required as an attachment/section and remain distinct from the primary document source.",
    "Generated lease packages must be reviewed against applicable Nova Scotia requirements before use.",
  ],
  prohibitedClauseChecks: ["unsafe_additional_clauses_unreviewed"],
  languageRequirements: ["en-CA"],
  statutoryReferences: [
    "Nova Scotia Residential Tenancies Act",
    "Form P Standard Form of Lease",
    "Schedule A statutory conditions",
  ],
  sourceReferences: ["Nova Scotia Form P Standard Lease Form reference upload"],
  async renderPrimaryLeasePdf(input: PrimaryLeaseDocumentInput) {
    return collectPdf((doc) => {
      const lease = input.lease || {};
      const property = input.property || {};
      const unit = input.unit || {};
      const tenants = input.tenants || [];
      const landlordName = text(input.landlord?.displayName || input.landlord?.name || input.landlord?.email || lease.landlordId, "Landlord");
      const tenantNames = tenants
        .map((tenant) => text(tenant.fullName || tenant.name || tenant.email || tenant.id, "Tenant"))
        .join(", ");
      const unitLabel = text(unit.unitNumber || unit.label || lease.unitNumber || lease.unitId, "Unit");
      const propertyLabel = text(property.addressLine1 || property.name || lease.propertyId, "Property");

      doc.fontSize(18).text("Primary Residential Lease Document", { align: "center" });
      doc.moveDown(0.35);
      doc
        .fontSize(9)
        .fillColor("#555")
        .text(productionReadinessNotice(), { align: "center" });
      doc.fillColor("#111").moveDown();

      const section = (title: string) => {
        doc.moveDown(0.7);
        doc.fontSize(13).text(title, { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10);
      };
      const row = (label: string, value: string) => {
        doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
        doc.font("Helvetica").text(value);
      };

      section("Parties");
      row("Landlord", landlordName);
      row("Tenant(s)", tenantNames || "Tenant details on file");
      row("Occupants", "Occupants must be listed before production use.");

      section("Premises");
      row("Property", propertyLabel);
      row("Unit", unitLabel);
      row("Jurisdiction", "Nova Scotia, Canada");
      row("Emergency contact", "Required before production use.");
      row("Agent", "Required if applicable.");
      row("Property manager", "Required if applicable.");
      row("Building superintendent", "Required if applicable.");

      section("Term");
      row("Start date", text(lease.startDate));
      row("End date", text(lease.endDate, "Month-to-month or not provided"));
      row("Term type", text(lease.termType));
      row("Public housing", "Required if applicable.");

      section("Rent and Payments");
      row("Monthly rent", money(lease.baseRentCents ?? lease.monthlyRent));
      row("Due day", text(lease.dueDay));
      row("Payment method", text(lease.paymentMethod));
      row("Deposit", lease.depositCents == null ? "Not provided" : money(lease.depositCents));
      row("Rent increases", "Governed by Nova Scotia requirements.");
      row("Rental incentive", "Required if applicable.");
      row("Rent includes", Array.isArray(lease.utilitiesIncluded) && lease.utilitiesIncluded.length ? lease.utilitiesIncluded.join(", ") : "Not provided");

      section("Tenant Responsibilities and Notices");
      row("Tenant responsibilities", "Required Form P terms and reasonable rules must be included.");
      row("Additional obligations", "Required if applicable and subject to review.");
      row("Assignment/sublet", "Required Form P terms apply.");
      row("Rental arrears", "Required Form P terms apply.");
      row("Tenant notice to quit", "Required Form P terms apply.");
      row("Landlord notice to quit", "Required Form P terms apply.");
      row("Email service of documents", "Landlord and tenant consent details required before production use.");
      row("How to serve notices/documents", "Required Form P service terms apply.");

      section("Inspection, Rules, and General Terms");
      row("Inspection", "Required Form P terms apply.");
      row("Statutory conditions and reasonable rules", "Schedule A statutory conditions must be attached/sectioned.");
      row("General/binding clause", "Required Form P terms apply.");
      row("Tenants responsible for terms", "Required Form P terms apply.");
      doc.moveDown(0.2);
      doc.text(text(lease.additionalClauses, "No additional clauses provided."));

      section("Attachments");
      doc.text("Schedule A statutory conditions and addenda must be attached/initialed where required and do not replace this primary lease document.");

      section("Signature Acknowledgement");
      doc.text("Tenant signature: _______________________________   Date: ______________");
      doc.moveDown(0.5);
      doc.text("Landlord signature: _____________________________   Date: ______________");

      doc.moveDown();
      doc
        .fontSize(8)
        .fillColor("#555")
        .text(closingReadinessNotice());
    });
  },
};
