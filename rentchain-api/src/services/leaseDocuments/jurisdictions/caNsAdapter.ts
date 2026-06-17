import PDFDocument from "pdfkit";
import type {
  JurisdictionLeaseDocumentAdapter,
  LeaseDocumentSigningFieldPlacement,
  PrimaryLeaseDocumentInput,
} from "../leaseDocumentTypes";

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

function buildDropboxSignPlacement(signaturePage: number): LeaseDocumentSigningFieldPlacement {
  return {
    provider: "dropbox_sign",
    placementVersion: "dropbox_sign_form_fields_v1",
    landlordPlacementPrepared: true,
    fields: [
      {
        apiId: "tenant_signature",
        type: "signature",
        signerRole: "tenant",
        signerIndex: 0,
        documentIndex: 0,
        page: signaturePage,
        x: 170,
        y: 165,
        width: 270,
        height: 52,
        required: true,
        name: "Tenant signature",
      },
      {
        apiId: "tenant_date_signed",
        type: "date_signed",
        signerRole: "tenant",
        signerIndex: 0,
        documentIndex: 0,
        page: signaturePage,
        x: 455,
        y: 175,
        width: 92,
        height: 28,
        required: true,
        name: "Tenant date signed",
      },
    ],
  };
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
    "This draft/test adapter is not legal advice and is not counsel-approved for production signing.",
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
    let pageNumber = 1;
    let signaturePage = 1;
    const pdfBuffer = await collectPdf((doc) => {
      doc.on("pageAdded", () => {
        pageNumber += 1;
      });
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
      doc.fontSize(9).fillColor("#555").text("Template status: draft/test. Not legal advice. Counsel review required before production signing.", {
        align: "center",
      });
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

      doc.addPage();
      signaturePage = pageNumber;
      doc.fontSize(16).fillColor("#111").text("Sign and Date", { align: "center" });
      doc.moveDown(0.7);
      doc.fontSize(10).text("Review the lease details and applicable provincial requirements before signing. RentChain does not provide legal advice or guarantee enforceability.");

      doc.moveDown(2);
      doc.font("Helvetica-Bold").fontSize(10).text("Tenant signature", 72, 150);
      doc.font("Helvetica").moveTo(170, 207).lineTo(440, 207).stroke("#111");
      doc.text("Date", 455, 150);
      doc.moveTo(455, 207).lineTo(547, 207).stroke("#111");

      doc.font("Helvetica-Bold").text("Landlord signature", 72, 245);
      doc.font("Helvetica").moveTo(170, 302).lineTo(440, 302).stroke("#111");
      doc.text("Date", 455, 245);
      doc.moveTo(455, 302).lineTo(547, 302).stroke("#111");
      doc.fontSize(8).fillColor("#555").text(
        "Landlord signature placement is prepared for a future countersignature flow. The current Dropbox Sign request places the tenant signature and signing date.",
        72,
        330,
        { width: 476 }
      );

      doc.moveDown();
      doc.fontSize(8).fillColor("#555").text("This generated draft is provided for workflow testing. It is not legal advice, certification, notarization, or an enforceability guarantee.");
    });
    return {
      pdfBuffer,
      signingFieldPlacement: buildDropboxSignPlacement(signaturePage),
    };
  },
};
