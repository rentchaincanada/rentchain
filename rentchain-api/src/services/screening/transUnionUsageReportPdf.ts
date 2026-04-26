import PDFDocument from "pdfkit";
import type { TransUnionUsageReport } from "./transUnionUsageReportService";

type PdfTableRow = {
  label: string;
  value: string;
};

export type TransUnionUsagePdfViewModel = {
  cover: {
    title: string;
    subtitle: string;
    reportPeriodLabel: string;
    preparedBy: string;
    preparedFor: string;
    confidentialNote: string;
    generatedAtLabel: string;
  };
  executiveSummary: {
    title: string;
    paragraphs: string[];
  };
  reportPeriod: {
    title: string;
    rows: PdfTableRow[];
  };
  onboardingFunnel: {
    title: string;
    rows: PdfTableRow[];
  };
  screeningUsage: {
    title: string;
    rows: PdfTableRow[];
  };
  complianceAndAuditCoverage: {
    title: string;
    rows: PdfTableRow[];
    note: string;
  };
  workflowDescription: {
    title: string;
    steps: string[];
  };
  partnershipReadiness: {
    title: string;
    paragraphs: string[];
    discussionPoints: string[];
  };
  appendix: {
    title: string;
    eventDefinitions: string[];
    dataExclusions: string[];
  };
};

function toPercent(value: number): string {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function toMetric(value: number | null): string {
  if (value == null) return "Not available";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function toDateLabel(value: string): string {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return String(value || "Unknown");
  return new Date(parsed).toLocaleString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  if (doc.y > 690) doc.addPage();
  doc.moveDown(0.5);
  doc.fontSize(15).fillColor("#111827").text(title, { underline: false });
  doc.moveDown(0.25);
}

function drawParagraph(doc: PDFKit.PDFDocument, text: string) {
  doc.fontSize(10.5).fillColor("#374151").text(text, {
    width: 500,
    align: "left",
    lineGap: 2,
  });
  doc.moveDown(0.45);
}

function drawRows(doc: PDFKit.PDFDocument, rows: PdfTableRow[]) {
  rows.forEach((row) => {
    if (doc.y > 710) doc.addPage();
    doc.fontSize(10.5).fillColor("#111827").text(row.label, 54, doc.y, { continued: true });
    doc.font("Helvetica-Bold").text(` ${row.value}`);
    doc.font("Helvetica");
    doc.moveDown(0.25);
  });
}

function drawList(doc: PDFKit.PDFDocument, items: string[]) {
  items.forEach((item) => {
    if (doc.y > 710) doc.addPage();
    doc.fontSize(10.5).fillColor("#374151").text(`- ${item}`, {
      indent: 10,
      width: 500,
      lineGap: 2,
    });
    doc.moveDown(0.15);
  });
  doc.moveDown(0.3);
}

export function buildTransUnionUsagePdfViewModel(
  report: TransUnionUsageReport
): TransUnionUsagePdfViewModel {
  return {
    cover: {
      title: "RentChain TransUnion Usage Summary",
      subtitle:
        "Landlord-by-landlord onboarding, screening workflow usage, and compliance/audit summary",
      reportPeriodLabel: `${toDateLabel(report.period.startDate)} to ${toDateLabel(report.period.endDate)}`,
      preparedBy: "RentChain",
      preparedFor: "TransUnion Canada",
      confidentialNote:
        "Confidential. Aggregate workflow and usage information only. No raw credit report contents, credential secrets, tenant PII, or landlord customer lists are included.",
      generatedAtLabel: toDateLabel(new Date().toISOString()),
    },
    executiveSummary: {
      title: "Executive Summary",
      paragraphs: [
        "RentChain supports a landlord-by-landlord TransUnion onboarding model. Landlords either obtain their own TransUnion access or connect existing TransUnion-issued credentials within the RentChain workflow.",
        "RentChain operates as the workflow, consent, and audit layer around rental application intake and screening operations. TransUnion remains the underlying screening and data provider.",
        "This PDF is generated from aggregated internal reporting data only and is intended for partnership, onboarding, pricing, and future XML/API discussion readiness.",
      ],
    },
    reportPeriod: {
      title: "Report Period",
      rows: [
        { label: "Period label", value: report.period.label.replace(/_/g, " ") },
        { label: "Start date", value: toDateLabel(report.period.startDate) },
        { label: "End date", value: toDateLabel(report.period.endDate) },
        { label: "Prepared by", value: "RentChain" },
        { label: "Prepared for", value: "TransUnion Canada" },
      ],
    },
    onboardingFunnel: {
      title: "Onboarding Funnel",
      rows: [
        { label: "Viewed TransUnion option", value: toMetric(report.funnel.optionViewed) },
        { label: "Clicked Get TransUnion Access", value: toMetric(report.funnel.getAccessClicks) },
        {
          label: "Clicked Connect Existing Membership",
          value: toMetric(report.funnel.haveCredentialsClicks),
        },
        { label: "Credential submissions", value: toMetric(report.funnel.credentialSubmissions) },
        { label: "Successful connections", value: toMetric(report.funnel.connectionSuccesses) },
        { label: "Connection failures", value: toMetric(report.funnel.connectionFailures) },
        { label: "First screening initiators", value: toMetric(report.funnel.firstScreeningInitiated) },
        { label: "Repeat screening users", value: toMetric(report.funnel.repeatScreeningUsers) },
      ],
    },
    screeningUsage: {
      title: "Screening Usage",
      rows: [
        { label: "Active connected landlords", value: toMetric(report.usage.activeConnectedLandlords) },
        { label: "Total screening requests", value: toMetric(report.usage.totalScreeningRequests) },
        { label: "Completed screenings", value: toMetric(report.usage.completedScreenings) },
        { label: "In-progress screenings", value: toMetric(report.usage.inProgressScreenings) },
        { label: "Blocked screenings", value: toMetric(report.usage.blockedScreenings) },
        { label: "Manual review screenings", value: toMetric(report.usage.manualReviewScreenings) },
        {
          label: "Average screenings per connected landlord",
          value: toMetric(report.usage.averageScreeningsPerConnectedLandlord),
        },
        { label: "Repeat usage rate", value: toPercent(report.usage.repeatUsageRate) },
      ],
    },
    complianceAndAuditCoverage: {
      title: "Compliance and Audit Coverage",
      rows: [
        {
          label: "Tenant consent capture rate",
          value: toPercent(report.compliance.tenantConsentCapturedRate),
        },
        {
          label: "Permissible-purpose confirmation rate",
          value: toPercent(report.compliance.permissiblePurposeConfirmedRate),
        },
        { label: "Audit coverage rate", value: toPercent(report.compliance.auditCoverageRate) },
        {
          label: "Blocked requests due to missing consent",
          value: toMetric(report.compliance.requestsBlockedForMissingConsent),
        },
        {
          label: "Blocked requests due to missing provider connection",
          value: toMetric(report.compliance.requestsBlockedForMissingProviderConnection),
        },
        { label: "Completion rate", value: toPercent(report.quality.completionRate) },
        { label: "Manual review rate", value: toPercent(report.quality.manualReviewRate) },
        { label: "Failed or blocked rate", value: toPercent(report.quality.failedOrBlockedRate) },
      ],
      note:
        "This report excludes raw credit report contents, TransUnion passcodes, TransUnion member codes, tenant PII, and landlord customer lists by default.",
    },
    workflowDescription: {
      title: "Workflow Description",
      steps: [
        "Landlord views the screening option in RentChain.",
        "Landlord selects Get TransUnion Access or Connect Existing Membership.",
        "Existing credentials are connected where applicable.",
        "Screening request is initiated through the RentChain workflow.",
        "Consent and permissible-purpose events are recorded.",
        "Workflow state transitions are tracked internally.",
        "Admin reporting aggregates usage without exposing sensitive data.",
      ],
    },
    partnershipReadiness: {
      title: "Partnership Readiness",
      paragraphs: [
        "RentChain is aligned with the landlord-by-landlord TransUnion onboarding model.",
        "RentChain can share periodic aggregated usage summaries for partnership and onboarding discussions.",
        "Future XML/API discussion should be revisited only when screening volume and repeat usage are meaningfully established.",
      ],
      discussionPoints: [
        "Preferred landlord-facing onboarding wording",
        "Permissible-purpose best practices and retention expectations",
        "Preferred reporting cadence",
        "Volume thresholds for future XML/API discussion",
        "Pricing-tier discussion once volume grows",
      ],
    },
    appendix: {
      title: "Appendix",
      eventDefinitions: [...report.report.appendix.eventDefinitions],
      dataExclusions: [...report.report.appendix.dataExclusions],
    },
  };
}

export async function buildTransUnionUsagePdfBuffer(
  report: TransUnionUsageReport
): Promise<Buffer> {
  const viewModel = buildTransUnionUsagePdfViewModel(report);
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

  doc.fontSize(22).fillColor("#111827").text(viewModel.cover.title);
  doc.moveDown(0.3);
  doc.fontSize(11.5).fillColor("#4b5563").text(viewModel.cover.subtitle, { width: 500 });
  doc.moveDown(0.75);
  doc.fontSize(10.5).fillColor("#111827").text(`Report period: ${viewModel.cover.reportPeriodLabel}`);
  doc.moveDown(0.15);
  doc.text(`Prepared by: ${viewModel.cover.preparedBy}`);
  doc.moveDown(0.15);
  doc.text(`Prepared for: ${viewModel.cover.preparedFor}`);
  doc.moveDown(0.15);
  doc.text(`Generated: ${viewModel.cover.generatedAtLabel}`);
  doc.moveDown(0.8);
  drawParagraph(doc, viewModel.cover.confidentialNote);

  drawSectionTitle(doc, viewModel.executiveSummary.title);
  viewModel.executiveSummary.paragraphs.forEach((paragraph) => drawParagraph(doc, paragraph));

  drawSectionTitle(doc, viewModel.reportPeriod.title);
  drawRows(doc, viewModel.reportPeriod.rows);

  drawSectionTitle(doc, viewModel.onboardingFunnel.title);
  drawRows(doc, viewModel.onboardingFunnel.rows);

  drawSectionTitle(doc, viewModel.screeningUsage.title);
  drawRows(doc, viewModel.screeningUsage.rows);

  drawSectionTitle(doc, viewModel.complianceAndAuditCoverage.title);
  drawRows(doc, viewModel.complianceAndAuditCoverage.rows);
  drawParagraph(doc, viewModel.complianceAndAuditCoverage.note);

  drawSectionTitle(doc, viewModel.workflowDescription.title);
  drawList(doc, viewModel.workflowDescription.steps);

  drawSectionTitle(doc, viewModel.partnershipReadiness.title);
  viewModel.partnershipReadiness.paragraphs.forEach((paragraph) => drawParagraph(doc, paragraph));
  drawList(doc, viewModel.partnershipReadiness.discussionPoints);

  drawSectionTitle(doc, viewModel.appendix.title);
  drawParagraph(doc, "Event definitions");
  drawList(doc, viewModel.appendix.eventDefinitions);
  drawParagraph(doc, "Data exclusions");
  drawList(doc, viewModel.appendix.dataExclusions);

  doc.end();

  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  return Buffer.concat(chunks);
}
