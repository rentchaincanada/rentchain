import PDFDocument from "pdfkit";

export type ReviewSummary = {
  applicationId: string;
  generatedAt: string;
  application: {
    status: string | null;
    submittedAt: string | null;
    propertyName: string | null;
    unitLabel: string | null;
    leaseStartDate: string | null;
    requestedRentAmountCents: number | null;
    moveInDate: string | null;
  };
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
    statusLabel: string;
    provider: string | null;
    providerLabel: string | null;
    referenceId: string | null;
  };
  coApplicant: {
    name: string | null;
    email: string | null;
    phone: string | null;
    monthlyIncomeCents: number | null;
    address: string | null;
  };
  household: {
    otherOccupants: string | null;
    pets: string | null;
    vehicles: string | null;
    notes: string | null;
  };
  residentialHistory: Array<{
    address: string | null;
    durationMonths: number | null;
    rentAmountCents: number | null;
    landlordName: string | null;
    landlordPhone: string | null;
    reasonForLeaving: string | null;
  }>;
  currentLeaseStatus: {
    hasActiveLease: boolean | null;
    leaseEndDate: string | null;
    landlordAware: string | null;
    reasonForMoving: string | null;
  };
  notes: {
    applicantNotes: string | null;
    landlordNotes: string | null;
    flags: string[];
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

export type ReviewSummaryPdfDecisionContext = {
  status?: string | null;
  riskInsights?: {
    score?: number | null;
    grade?: string | null;
    confidence?: number | null;
    signals?: string[];
    recommendations?: string[];
  } | null;
  referenceQuestions?: string[];
  screeningRecommendation?: {
    recommended?: boolean;
    reason?: string | null;
    priority?: string | null;
  } | null;
  screeningSummary?: {
    available?: boolean;
    provider?: string | null;
    providerLabel?: string | null;
    completedAt?: string | null;
    highlights?: string[];
  } | null;
  decisionSupport?: {
    summaryLine?: string | null;
    nextBestAction?: string | null;
  } | null;
};

export type ReviewSummaryPdfOptions = {
  decisionSummary?: ReviewSummaryPdfDecisionContext | null;
};

export type ReviewSummaryPdfSection = {
  title: string;
  rows: Array<{ label: string; value: string }>;
};

function stringOrNull(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

function looksLikeInternalId(value: string): boolean {
  const raw = value.trim();
  if (/^(app|application|lease|property|prop|tenant|unit)[-_][A-Za-z0-9_-]+$/i.test(raw)) return true;
  if (!/^[A-Za-z0-9_-]{16,}$/.test(raw)) return false;
  return /[a-z]/.test(raw) && /[A-Z]/.test(raw) && /\d/.test(raw);
}

function safeContextLabel(value: unknown): string | null {
  const raw = stringOrNull(value);
  if (!raw || looksLikeInternalId(raw)) return null;
  return raw;
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positiveCentsOrNull(value: unknown): number | null {
  const cents = numberOrNull(value);
  return cents != null && cents > 0 ? cents : null;
}

function amountToCents(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const amount = numberOrNull(value);
  if (amount == null || amount <= 0) return null;
  return Math.round(amount * 100);
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

function formatDate(value: string | null): string {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-CA");
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

function screeningStatusLabel(raw: unknown): string {
  const value = screeningStatus(raw);
  if (["complete", "completed"].includes(value)) return "Screening complete";
  if (["not_requested", "not_run", "not_started"].includes(value)) return "Screening not requested";
  if (["processing", "external_pending", "requested", "in_progress", "provider_pending"].includes(value)) {
    return "Screening in progress";
  }
  if (value === "paid") return "Screening paid; result pending";
  if (value === "unpaid") return "Screening not started";
  if (value === "ineligible") return "Screening unavailable";
  if (["failed", "cancelled"].includes(value)) return value === "failed" ? "Screening failed" : "Screening cancelled";
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function screeningProviderLabel(raw: unknown): string | null {
  const value = stringOrNull(raw);
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["stub", "stubbed_screening", "mock", "test"].includes(normalized)) return null;
  if (normalized === "transunion_referral" || normalized === "transunion_manual") return "TransUnion";
  if (normalized === "manual") return "Manual review";
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
    const provider = summary.screening.providerLabel || "Provider unavailable";
    insights.push(`Screening status: ${summary.screening.statusLabel} (${provider})`);
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
  const coApplicant = application?.coApplicant || {};
  const household = application?.household || {};
  const currentLeaseStatus = application?.currentLeaseStatus || null;

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
    application: {
      status: stringOrNull(application?.status),
      submittedAt: toIso(application?.submittedAt || application?.createdAt),
      propertyName: safeContextLabel(
        application?.propertyName ||
          application?.property?.name ||
          application?.propertyAddress ||
          application?.address
      ),
      unitLabel: safeContextLabel(
        application?.unitLabel ||
          application?.unitName ||
          application?.unitNumber ||
          application?.unitApplied ||
          application?.unit
      ),
      leaseStartDate: toIso(application?.leaseStartDate || application?.moveInDate),
      requestedRentAmountCents:
        positiveCentsOrNull(application?.requestedRentAmountCents) ??
        positiveCentsOrNull(application?.requestedRentCents) ??
        positiveCentsOrNull(application?.monthlyRentAmountCents) ??
        positiveCentsOrNull(application?.monthlyRentCents) ??
        positiveCentsOrNull(application?.rentAmountCents) ??
        positiveCentsOrNull(application?.rentCents) ??
        amountToCents(application?.requestedRent) ??
        amountToCents(application?.monthlyRent) ??
        amountToCents(application?.rentAmount) ??
        amountToCents(application?.rent),
      moveInDate: toIso(application?.moveInDate),
    },
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
      statusLabel: screeningStatusLabel(application?.screeningStatus || screening?.status),
      provider: stringOrNull(application?.screeningProvider || screening?.provider),
      providerLabel: screeningProviderLabel(application?.screeningProvider || screening?.provider),
      referenceId: stringOrNull(screening?.orderId || application?.screeningSessionId || application?.screeningResultId),
    },
    coApplicant: {
      name: stringOrNull(coApplicant?.fullName),
      email: stringOrNull(coApplicant?.email),
      phone: stringOrNull(coApplicant?.phone),
      monthlyIncomeCents: amountToCents(coApplicant?.monthlyIncome),
      address:
        [
          stringOrNull(coApplicant?.address),
          stringOrNull(coApplicant?.city),
          stringOrNull(coApplicant?.provinceState),
          stringOrNull(coApplicant?.postalCode),
        ]
          .filter(Boolean)
          .join(", ") || null,
    },
    household: {
      otherOccupants: stringOrNull(household?.otherOccupants),
      pets: stringOrNull(household?.pets),
      vehicles: stringOrNull(household?.vehicles),
      notes: stringOrNull(household?.notes),
    },
    residentialHistory: Array.isArray(application?.residentialHistory)
      ? application.residentialHistory.slice(0, 5).map((entry: any) => ({
          address: stringOrNull(entry?.address),
          durationMonths: numberOrNull(entry?.durationMonths),
          rentAmountCents: numberOrNull(entry?.rentAmountCents),
          landlordName: stringOrNull(entry?.landlordName),
          landlordPhone: stringOrNull(entry?.landlordPhone),
          reasonForLeaving: stringOrNull(entry?.reasonForLeaving),
        }))
      : [],
    currentLeaseStatus: currentLeaseStatus
      ? {
          hasActiveLease:
            typeof currentLeaseStatus?.hasActiveLease === "boolean"
              ? currentLeaseStatus.hasActiveLease
              : null,
          leaseEndDate: toIso(currentLeaseStatus?.leaseEndDate),
          landlordAware: stringOrNull(currentLeaseStatus?.landlordAware),
          reasonForMoving: stringOrNull(currentLeaseStatus?.reasonForMoving),
        }
      : {
          hasActiveLease: null,
          leaseEndDate: null,
          landlordAware: null,
          reasonForMoving: null,
        },
    notes: {
      applicantNotes: stringOrNull(profile?.applicantNotes),
      landlordNotes: stringOrNull(application?.landlordNote || application?.notes),
      flags: Array.isArray(application?.flags)
        ? application.flags.map((flag: unknown) => stringOrNull(flag)).filter(Boolean) as string[]
        : [],
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

function listOrFallback(items: string[] | undefined | null, fallback = "None recorded"): string {
  const compact = (items || []).map((item) => String(item || "").trim()).filter(Boolean);
  return compact.length ? compact.join("; ") : fallback;
}

function yesNoUnknown(value: boolean | null): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not provided";
}

function residentialHistoryRows(summary: ReviewSummary): Array<{ label: string; value: string }> {
  if (!summary.residentialHistory.length) {
    return [{ label: "History", value: "No residential history provided" }];
  }
  return summary.residentialHistory.map((entry, index) => {
    const details = [
      entry.durationMonths != null ? `${entry.durationMonths} months` : null,
      entry.rentAmountCents != null ? formatCurrency(entry.rentAmountCents) : null,
      entry.landlordName ? `Landlord: ${entry.landlordName}` : null,
      entry.landlordPhone ? `Phone: ${entry.landlordPhone}` : null,
      entry.reasonForLeaving ? `Reason: ${entry.reasonForLeaving}` : null,
    ].filter(Boolean);
    return {
      label: `Address ${index + 1}`,
      value: [entry.address || "Address not provided", ...details].join(" | "),
    };
  });
}

export function buildReviewSummaryPdfSections(
  summary: ReviewSummary,
  options: ReviewSummaryPdfOptions = {}
): ReviewSummaryPdfSection[] {
  const decision = options.decisionSummary || null;
  const risk = decision?.riskInsights || null;
  const sections: ReviewSummaryPdfSection[] = [
    {
      title: "Application Context",
      rows: [
        { label: "Status", value: summary.application.status || "Not provided" },
        { label: "Submitted", value: formatDateTime(summary.application.submittedAt) },
        { label: "Property", value: summary.application.propertyName || "Not provided" },
        { label: "Unit", value: summary.application.unitLabel || "Not provided" },
        { label: "Lease start", value: formatDate(summary.application.leaseStartDate) },
        { label: "Requested rent", value: formatCurrency(summary.application.requestedRentAmountCents) },
      ],
    },
    {
      title: "Applicant Overview",
      rows: [
        { label: "Name", value: summary.applicant.name || "Not provided" },
        { label: "Email", value: summary.applicant.email || "Not provided" },
        {
          label: "Current address",
          value:
            [
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
      ],
    },
    {
      title: "Household & Co-applicant",
      rows: [
        { label: "Co-applicant", value: summary.coApplicant.name || "Not provided" },
        { label: "Co-applicant email", value: summary.coApplicant.email || "Not provided" },
        { label: "Co-applicant phone", value: summary.coApplicant.phone || "Not provided" },
        { label: "Co-applicant income", value: formatCurrency(summary.coApplicant.monthlyIncomeCents) },
        { label: "Other occupants", value: summary.household.otherOccupants || "Not provided" },
        { label: "Pets", value: summary.household.pets || "Not provided" },
        { label: "Vehicles", value: summary.household.vehicles || "Not provided" },
        { label: "Household notes", value: summary.household.notes || "Not provided" },
      ],
    },
    {
      title: "Employment & Income",
      rows: [
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
        { label: "Income-to-rent ratio", value: formatRatio(summary.derived.incomeToRentRatio) },
      ],
    },
    {
      title: "References & Compliance",
      rows: [
        { label: "Work reference", value: summary.reference.name || "Not provided" },
        { label: "Reference phone", value: summary.reference.phone || "Not provided" },
        { label: "Signature", value: summary.compliance.signatureType || "Not provided" },
        { label: "Signed at", value: formatDateTime(summary.compliance.signedAt) },
        { label: "Consent version", value: summary.compliance.applicationConsentVersion || "Not provided" },
        { label: "Consent accepted at", value: formatDateTime(summary.compliance.applicationConsentAcceptedAt) },
      ],
    },
    {
      title: "Current Housing & Lease Status",
      rows: [
        { label: "Active lease", value: yesNoUnknown(summary.currentLeaseStatus.hasActiveLease) },
        { label: "Lease end date", value: formatDate(summary.currentLeaseStatus.leaseEndDate) },
        { label: "Landlord aware", value: summary.currentLeaseStatus.landlordAware || "Not provided" },
        { label: "Reason for moving", value: summary.currentLeaseStatus.reasonForMoving || "Not provided" },
      ],
    },
    {
      title: "Residential History",
      rows: residentialHistoryRows(summary),
    },
    {
      title: "Screening & Deterministic Signals",
      rows: [
        {
          label: "Completeness",
          value: `${summary.derived.completeness.label} (${Math.round(summary.derived.completeness.score * 100)}%)`,
        },
        { label: "Screening status", value: summary.screening.statusLabel || "Screening not requested" },
        { label: "Screening provider", value: summary.screening.providerLabel || "Not provided" },
        { label: "Screening recommendation", value: decision?.screeningRecommendation?.reason || "Not provided" },
        {
          label: "Screening highlights",
          value: listOrFallback(decision?.screeningSummary?.highlights, "No screening highlights recorded"),
        },
      ],
    },
    {
      title: "Risk & Decision Guidance",
      rows: [
        {
          label: "Risk score",
          value:
            typeof risk?.score === "number"
              ? `${risk.score}${risk.grade ? ` (${risk.grade})` : ""}`
              : "Not provided",
        },
        {
          label: "Confidence",
          value:
            typeof risk?.confidence === "number"
              ? `${Math.round(risk.confidence * 100)}%`
              : "Not provided",
        },
        { label: "Signals", value: listOrFallback(risk?.signals) },
        { label: "Recommendations", value: listOrFallback(risk?.recommendations) },
        { label: "Decision summary", value: decision?.decisionSupport?.summaryLine || "Not provided" },
        { label: "Next action", value: decision?.decisionSupport?.nextBestAction || "Not provided" },
        { label: "Reference questions", value: listOrFallback(decision?.referenceQuestions) },
      ],
    },
    {
      title: "Notes & Flags",
      rows: [
        { label: "Applicant notes", value: summary.notes.applicantNotes || "Not provided" },
        { label: "Landlord notes", value: summary.notes.landlordNotes || "Not provided" },
        { label: "Flags", value: listOrFallback(summary.notes.flags) },
      ],
    },
  ];
  return sections;
}

function drawTable(
  doc: any,
  title: string,
  rows: Array<{ label: string; value: string }>
) {
  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = Math.min(190, tableWidth * 0.38);
  const valueWidth = tableWidth - labelWidth;
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const maxRowHeight = Math.max(72, Math.min(132, pageBottom() - doc.page.margins.top - 24));
  const estimateRowHeight = (row: { label: string; value: string }) => {
    const labelHeight = doc.heightOfString(row.label, {
      width: labelWidth - 12,
      align: "left",
    });
    const valueHeight = doc.heightOfString(row.value, {
      width: valueWidth - 12,
      align: "left",
    });
    return Math.min(Math.max(labelHeight, valueHeight, 16) + 10, maxRowHeight);
  };
  const firstRowHeight = rows[0] ? estimateRowHeight(rows[0]) : 0;
  const sectionGap = 10;
  const titleBlockHeight = 28;
  if (doc.y + sectionGap + titleBlockHeight + firstRowHeight > pageBottom()) {
    doc.addPage();
  } else {
    doc.moveDown(0.8);
  }
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(title);
  doc.moveDown(0.3);
  for (const row of rows) {
    const rowHeight = estimateRowHeight(row);
    if (doc.y + rowHeight > pageBottom()) {
      doc.addPage();
    }
    const y = doc.y;
    doc.save();
    doc.rect(startX, y, labelWidth, rowHeight).fill("#f3f4f6");
    doc.rect(startX + labelWidth, y, valueWidth, rowHeight).fill("#ffffff");
    doc.restore();
    doc.rect(startX, y, tableWidth, rowHeight).stroke("#d1d5db");
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#374151")
      .text(row.label, startX + 6, y + 5, {
        width: labelWidth - 12,
        height: rowHeight - 10,
        ellipsis: true,
      });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#0f172a")
      .text(row.value, startX + labelWidth + 6, y + 5, {
        width: valueWidth - 12,
        height: rowHeight - 10,
        ellipsis: true,
      });
    doc.y = y + rowHeight;
  }
}

export async function buildReviewSummaryPdf(
  summary: ReviewSummary,
  options: ReviewSummaryPdfOptions = {}
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#6b7280").text("RENTCHAIN");
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text("APPLICATION REVIEW SUMMARY");
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text("Version v1.0");
  doc.moveDown(0.5);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#0f172a")
    .text(`Application: ${summary.applicant.name || "Applicant"}${summary.application.propertyName ? ` · ${summary.application.propertyName}` : ""}`);
  doc.text(`Generated: ${new Date(summary.generatedAt).toLocaleString()}`);

  buildReviewSummaryPdfSections(summary, options).forEach((section) => {
    drawTable(doc, section.title, section.rows);
  });

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
