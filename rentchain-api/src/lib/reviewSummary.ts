import PDFDocument from "pdfkit";

export type ReviewSummary = {
  applicationId: string;
  generatedAt: string;
  applicant: {
    name: string | null;
    email: string | null;
    currentAddressLine: string | null;
    city: string | null;
    provinceState: string | null;
    postalCode: string | null;
    country: string | null;
    timeAtCurrentAddressMonths: number | null;
    currentRentAmountCents: number | null;
  };
  employment: {
    employerName: string | null;
    jobTitle: string | null;
    incomeAmountCents: number | null;
    incomeFrequency: "monthly" | "annual" | null;
    incomeMonthlyCents: number | null;
    monthsAtJob: number | null;
  };
  reference: {
    name: string | null;
    phone: string | null;
  };
  compliance: {
    applicationConsentAcceptedAt: string | null;
    applicationConsentVersion: string | null;
    signatureType: string | null;
    signedAt: string | null;
  };
  screening: {
    status: string;
    provider: string | null;
    referenceId: string | null;
  };
  derived: {
    incomeToRentRatio: number | null;
    completeness: {
      score: number;
      label: "High" | "Medium" | "Low";
    };
    flags: string[];
  };
  insights: string[];
};

function stringOrNull(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatCurrency(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "Not provided";
  return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function formatRatio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Not provided";
  return `${value.toFixed(2)}x`;
}

function completenessLabel(score: number): "High" | "Medium" | "Low" {
  if (score >= 0.9) return "High";
  if (score >= 0.7) return "Medium";
  return "Low";
}

function screeningStatus(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return "not_run";
  return value;
}

function buildInsights(summary: Omit<ReviewSummary, "insights">): string[] {
  const insights: string[] = [];
  insights.push(`Application completeness: ${summary.derived.completeness.label}`);
  if (summary.derived.incomeToRentRatio != null) {
    insights.push(`Income-to-rent ratio: ${summary.derived.incomeToRentRatio.toFixed(2)}x`);
  }
  if (summary.applicant.timeAtCurrentAddressMonths != null) {
    insights.push(`Time at current address: ${summary.applicant.timeAtCurrentAddressMonths} months`);
  }
  if (summary.employment.monthsAtJob != null) {
    insights.push(`Time at current job: ${summary.employment.monthsAtJob} months`);
  }
  if (summary.screening.status && summary.screening.status !== "not_run") {
    const provider = summary.screening.provider || "Provider unavailable";
    insights.push(`Screening status: ${summary.screening.status} (${provider})`);
  }
  if (summary.derived.flags.length) {
    const missing = summary.derived.flags
      .map((flag) => flag.replace(/^MISSING_/, "").replace(/_/g, " ").toLowerCase())
      .join(", ");
    insights.push(`Missing: ${missing}`);
  }
  return insights;
}

export function buildReviewSummary(applicationId: string, application: any): ReviewSummary {
  const profile = application?.applicantProfile || {};
  const currentAddress = profile?.currentAddress || {};
  const employment = profile?.employment || {};
  const workReference = profile?.workReference || {};
  const signature = profile?.signature || {};
  const appConsent = application?.applicationConsent || {};
  const applicant = application?.applicant || {};
  const screening = application?.screening || {};

  const firstName = stringOrNull(applicant?.firstName);
  const lastName = stringOrNull(applicant?.lastName);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  const incomeAmountCents = numberOrNull(employment?.incomeAmountCents);
  const incomeFrequency = stringOrNull(employment?.incomeFrequency) as "monthly" | "annual" | null;
  const currentRentAmountCents = numberOrNull(profile?.currentRentAmountCents);
  const incomeMonthlyCents =
    incomeAmountCents == null
      ? null
      : incomeFrequency === "annual"
      ? Math.round(incomeAmountCents / 12)
      : incomeFrequency === "monthly"
      ? incomeAmountCents
      : null;
  const incomeToRentRatio =
    incomeMonthlyCents != null && currentRentAmountCents != null && currentRentAmountCents > 0
      ? incomeMonthlyCents / currentRentAmountCents
      : null;

  const requiredChecks: Array<[string, boolean]> = [
    ["MISSING_CURRENT_ADDRESS_LINE1", !!stringOrNull(currentAddress?.line1)],
    ["MISSING_CURRENT_ADDRESS_CITY", !!stringOrNull(currentAddress?.city)],
    ["MISSING_CURRENT_ADDRESS_PROVINCE", !!stringOrNull(currentAddress?.provinceState)],
    ["MISSING_CURRENT_ADDRESS_POSTAL", !!stringOrNull(currentAddress?.postalCode)],
    ["MISSING_TIME_AT_ADDRESS", numberOrNull(profile?.timeAtCurrentAddressMonths) != null],
    ["MISSING_CURRENT_RENT", currentRentAmountCents != null],
    ["MISSING_EMPLOYER_NAME", !!stringOrNull(employment?.employerName)],
    ["MISSING_JOB_TITLE", !!stringOrNull(employment?.jobTitle)],
    ["MISSING_INCOME", incomeAmountCents != null && !!incomeFrequency],
    ["MISSING_MONTHS_AT_JOB", numberOrNull(employment?.monthsAtJob) != null],
    ["MISSING_WORK_REFERENCE_NAME", !!stringOrNull(workReference?.name)],
    ["MISSING_WORK_REFERENCE_PHONE", !!stringOrNull(workReference?.phone)],
    ["MISSING_SIGNATURE", !!toIso(signature?.signedAt)],
    ["MISSING_APPLICATION_CONSENT", !!toIso(appConsent?.acceptedAt)],
  ];
  const pointsPresent = requiredChecks.filter(([, ok]) => ok).length;
  const score = requiredChecks.length ? pointsPresent / requiredChecks.length : 0;
  const flags = requiredChecks.filter(([, ok]) => !ok).map(([flag]) => flag);

  const summaryBase: Omit<ReviewSummary, "insights"> = {
    applicationId,
    generatedAt: new Date().toISOString(),
    applicant: {
      name,
      email: stringOrNull(applicant?.email),
      currentAddressLine: stringOrNull(currentAddress?.line1),
      city: stringOrNull(currentAddress?.city),
      provinceState: stringOrNull(currentAddress?.provinceState),
      postalCode: stringOrNull(currentAddress?.postalCode),
      country: stringOrNull(currentAddress?.country) || "CA",
      timeAtCurrentAddressMonths: numberOrNull(profile?.timeAtCurrentAddressMonths),
      currentRentAmountCents,
    },
    employment: {
      employerName: stringOrNull(employment?.employerName),
      jobTitle: stringOrNull(employment?.jobTitle),
      incomeAmountCents,
      incomeFrequency,
      incomeMonthlyCents,
      monthsAtJob: numberOrNull(employment?.monthsAtJob),
    },
    reference: {
      name: stringOrNull(workReference?.name),
      phone: stringOrNull(workReference?.phone),
    },
    compliance: {
      applicationConsentAcceptedAt: toIso(appConsent?.acceptedAt),
      applicationConsentVersion: stringOrNull(appConsent?.version),
      signatureType: stringOrNull(signature?.type),
      signedAt: toIso(signature?.signedAt),
    },
    screening: {
      status: screeningStatus(application?.screeningStatus || screening?.status),
      provider: stringOrNull(application?.screeningProvider || screening?.provider),
      referenceId: stringOrNull(screening?.orderId || application?.screeningSessionId || application?.screeningResultId),
    },
    derived: {
      incomeToRentRatio,
      completeness: {
        score: Number(score.toFixed(2)),
        label: completenessLabel(score),
      },
      flags,
    },
  };

  return {
    ...summaryBase,
    insights: buildInsights(summaryBase),
  };
}

function drawTable(
  doc: any,
  title: string,
  rows: Array<{ label: string; value: string }>
) {
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(title);
  doc.moveDown(0.3);
  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = Math.min(190, tableWidth * 0.38);
  const valueWidth = tableWidth - labelWidth;
  for (const row of rows) {
    const y = doc.y;
    const labelHeight = doc.heightOfString(row.label, {
      width: labelWidth - 12,
      align: "left",
    });
    const valueHeight = doc.heightOfString(row.value, {
      width: valueWidth - 12,
      align: "left",
    });
    const rowHeight = Math.max(labelHeight, valueHeight, 16) + 10;
    doc.save();
    doc.rect(startX, y, labelWidth, rowHeight).fill("#f3f4f6");
    doc.rect(startX + labelWidth, y, valueWidth, rowHeight).fill("#ffffff");
    doc.restore();
    doc.rect(startX, y, tableWidth, rowHeight).stroke("#d1d5db");
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#374151")
      .text(row.label, startX + 6, y + 5, { width: labelWidth - 12 });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#0f172a")
      .text(row.value, startX + labelWidth + 6, y + 5, { width: valueWidth - 12 });
    doc.y = y + rowHeight;
  }
}

export async function buildReviewSummaryPdf(summary: ReviewSummary): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#6b7280").text("RENTCHAIN");
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("APPLICATION REVIEW SUMMARY");
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text("Version v1.0");
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(10).fillColor("#0f172a").text(`Application ID: ${summary.applicationId}`);
  doc.text(`Generated: ${new Date(summary.generatedAt).toLocaleString()}`);

  drawTable(doc, "Applicant Overview", [
    { label: "Name", value: summary.applicant.name || "Not provided" },
    { label: "Email", value: summary.applicant.email || "Not provided" },
    {
      label: "Current address",
      value: [
        summary.applicant.currentAddressLine,
        summary.applicant.city,
        summary.applicant.provinceState,
        summary.applicant.postalCode,
        summary.applicant.country,
      ]
        .filter(Boolean)
        .join(", ") || "Not provided",
    },
    {
      label: "Time at current address",
      value:
        summary.applicant.timeAtCurrentAddressMonths != null
          ? `${summary.applicant.timeAtCurrentAddressMonths} months`
          : "Not provided",
    },
    { label: "Current rent", value: formatCurrency(summary.applicant.currentRentAmountCents) },
  ]);

  drawTable(doc, "Employment & Income", [
    { label: "Employer", value: summary.employment.employerName || "Not provided" },
    { label: "Job title", value: summary.employment.jobTitle || "Not provided" },
    { label: "Income", value: formatCurrency(summary.employment.incomeAmountCents) },
    { label: "Income frequency", value: summary.employment.incomeFrequency || "Not provided" },
    { label: "Income (monthly)", value: formatCurrency(summary.employment.incomeMonthlyCents) },
    {
      label: "Time at current job",
      value:
        summary.employment.monthsAtJob != null
          ? `${summary.employment.monthsAtJob} months`
          : "Not provided",
    },
  ]);

  drawTable(doc, "References & Compliance", [
    { label: "Work reference", value: summary.reference.name || "Not provided" },
    { label: "Reference phone", value: summary.reference.phone || "Not provided" },
    { label: "Signature", value: summary.compliance.signatureType || "Not provided" },
    {
      label: "Signed at",
      value: summary.compliance.signedAt
        ? new Date(summary.compliance.signedAt).toLocaleString()
        : "Not provided",
    },
    { label: "Consent version", value: summary.compliance.applicationConsentVersion || "Not provided" },
    {
      label: "Consent accepted at",
      value: summary.compliance.applicationConsentAcceptedAt
        ? new Date(summary.compliance.applicationConsentAcceptedAt).toLocaleString()
        : "Not provided",
    },
  ]);

  drawTable(doc, "Deterministic Signals", [
    {
      label: "Completeness",
      value: `${summary.derived.completeness.label} (${Math.round(summary.derived.completeness.score * 100)}%)`,
    },
    { label: "Income-to-rent ratio", value: formatRatio(summary.derived.incomeToRentRatio) },
    { label: "Screening status", value: summary.screening.status || "not_run" },
    { label: "Screening provider", value: summary.screening.provider || "Not provided" },
    { label: "Screening reference", value: summary.screening.referenceId || "Not provided" },
  ]);

  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Insights");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor("#111827");
  if (!summary.insights.length) {
    doc.text("No additional insights available.");
  } else {
    summary.insights.forEach((insight) => {
      doc.text(`• ${insight}`);
    });
  }

  doc.moveDown(0.8);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text("This summary is descriptive and does not provide approval or denial recommendations.");

  doc.end();
  await new Promise<void>((resolve, reject) => {
    doc.on("end", resolve);
    doc.on("error", reject);
  });
  return Buffer.concat(chunks);
}
