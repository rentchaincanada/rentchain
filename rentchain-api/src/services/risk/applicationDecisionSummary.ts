import type { ReviewSummary } from "../../lib/reviewSummary";

export type ApplicationDecisionGrade = "A" | "B" | "C" | "D" | "E";

export type ApplicationDecisionRiskInsights = {
  score?: number | null;
  grade?: ApplicationDecisionGrade | null;
  confidence?: number | null;
  signals?: string[];
  recommendations?: string[];
} | null;

export type ApplicationDecisionSummary = {
  applicationId: string;
  status?: string | null;
  riskInsights?: ApplicationDecisionRiskInsights;
  referenceQuestions?: string[];
  screeningRecommendation?: {
    recommended: boolean;
    reason?: string | null;
    priority?: "low" | "medium" | "high" | null;
  } | null;
  screeningSummary?: {
    available: boolean;
    provider?: string | null;
    completedAt?: string | null;
    highlights?: string[];
  } | null;
  decisionSupport?: {
    summaryLine?: string | null;
    nextBestAction?: string | null;
  } | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function gradeFromScore(score: number | null | undefined): ApplicationDecisionGrade | null {
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function asIsoOrNull(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatMissingFlag(flag: string) {
  return titleCase(flag.replace(/^MISSING_/, "").replace(/_/g, " "));
}

function uniqueCompact(items: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const value = String(item || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= limit) break;
  }
  return output;
}

function buildDerivedRiskInsights(reviewSummary: ReviewSummary) {
  const completenessScore = Number(reviewSummary?.derived?.completeness?.score || 0);
  const ratio = reviewSummary?.derived?.incomeToRentRatio ?? null;
  const monthsAtJob = reviewSummary?.employment?.monthsAtJob ?? null;
  const monthsAtAddress = reviewSummary?.applicant?.timeAtCurrentAddressMonths ?? null;
  const flags = Array.isArray(reviewSummary?.derived?.flags) ? reviewSummary.derived.flags : [];

  let score = 62;
  score += completenessScore >= 0.9 ? 12 : completenessScore >= 0.7 ? 6 : completenessScore >= 0.45 ? 0 : -8;
  if (typeof ratio === "number") {
    score += ratio >= 3 ? 12 : ratio >= 2.2 ? 6 : ratio >= 1.5 ? -4 : -12;
  }
  if (typeof monthsAtJob === "number") {
    score += monthsAtJob >= 24 ? 6 : monthsAtJob >= 12 ? 3 : monthsAtJob >= 6 ? 0 : -6;
  }
  if (typeof monthsAtAddress === "number") {
    score += monthsAtAddress >= 24 ? 4 : monthsAtAddress >= 12 ? 2 : monthsAtAddress >= 6 ? 0 : -4;
  }
  score -= Math.min(flags.length, 5) * 2;
  const normalizedScore = clamp(Math.round(score), 38, 90);

  const confidenceInputs = [
    completenessScore >= 0.6,
    typeof ratio === "number",
    typeof monthsAtJob === "number",
    typeof monthsAtAddress === "number",
    !!reviewSummary?.reference?.name,
  ].filter(Boolean).length;
  const confidence = clamp(0.48 + confidenceInputs * 0.09, 0.48, 0.86);

  const signals = uniqueCompact(
    [
      typeof ratio === "number" && ratio < 2.2 ? "Tight income-to-rent ratio" : null,
      typeof monthsAtJob === "number" && monthsAtJob < 12 ? "Short employment tenure" : null,
      typeof monthsAtAddress === "number" && monthsAtAddress < 12 ? "Recent address change" : null,
      ...flags.slice(0, 3).map(formatMissingFlag),
    ],
    4
  );

  const recommendations = uniqueCompact(
    [
      typeof ratio === "number" && ratio < 2.2 ? "Verify income documentation before approving." : null,
      typeof monthsAtJob === "number" && monthsAtJob < 12 ? "Use employment references to confirm stability." : null,
      flags.length ? "Fill missing application details before making a final decision." : null,
      !reviewSummary?.reference?.phone ? "Request a reachable landlord or work reference." : null,
    ],
    4
  );

  return {
    score: normalizedScore,
    grade: gradeFromScore(normalizedScore),
    confidence: Number(confidence.toFixed(2)),
    signals,
    recommendations,
  };
}

function buildAiRiskInsights(application: any) {
  const ai = application?.screening?.ai;
  if (!ai?.enabled) return null;
  const scoreByAssessment: Record<string, number> = {
    LOW: 84,
    MODERATE: 63,
    HIGH: 41,
  };
  const riskScore = clamp(scoreByAssessment[String(ai.riskAssessment || "").toUpperCase()] || 58, 0, 100);
  return {
    score: riskScore,
    grade: gradeFromScore(riskScore),
    confidence: clamp(Number(ai.confidenceScore || 0) / 100, 0.45, 0.95),
    signals: uniqueCompact(
      (Array.isArray(ai.flags) ? ai.flags : []).map((flag: string) => titleCase(flag.replace(/_/g, " "))),
      4
    ),
    recommendations: uniqueCompact(Array.isArray(ai.recommendations) ? ai.recommendations : [], 4),
  };
}

function buildReferenceQuestions(reviewSummary: ReviewSummary, riskInsights: NonNullable<ApplicationDecisionRiskInsights>) {
  const ratio = reviewSummary?.derived?.incomeToRentRatio ?? null;
  return uniqueCompact(
    [
      typeof ratio === "number" && ratio < 2.5
        ? "Can you confirm how the applicant plans to manage rent alongside current monthly obligations?"
        : "Would you re-rent to this applicant based on payment reliability and care of the unit?",
      reviewSummary?.employment?.monthsAtJob != null && reviewSummary.employment.monthsAtJob < 12
        ? "Has the applicant demonstrated stable employment and dependable attendance?"
        : "Can you confirm the applicant's employment status and income stability?",
      reviewSummary?.applicant?.timeAtCurrentAddressMonths != null &&
      reviewSummary.applicant.timeAtCurrentAddressMonths < 12
        ? "Did the applicant explain the reason for their recent move clearly and consistently?"
        : "How long has the applicant maintained their current housing arrangement without issue?",
      reviewSummary?.reference?.phone
        ? "Have rent payments or other major obligations ever arrived late or required repeated follow-up?"
        : "Please confirm a reference who can speak to payment behavior and tenancy stability.",
      riskInsights.signals?.some((signal) => signal.toLowerCase().includes("income"))
        ? "Was income documentation consistent with the role, tenure, and compensation described?"
        : "Would you describe the applicant as dependable with commitments and communication?",
    ],
    5
  );
}

function buildScreeningRecommendation(application: any, reviewSummary: ReviewSummary, riskInsights: NonNullable<ApplicationDecisionRiskInsights>) {
  const screeningStatus = String(application?.screeningStatus || application?.screening?.status || "").trim().toLowerCase();
  if (screeningStatus === "complete") {
    return {
      recommended: false,
      reason: "Screening is already complete and can be reviewed alongside references.",
      priority: "low" as const,
    };
  }

  const completeness = Number(reviewSummary?.derived?.completeness?.score || 0);
  const ratio = reviewSummary?.derived?.incomeToRentRatio ?? null;
  const priority: "low" | "medium" | "high" =
    completeness < 0.65 || (typeof ratio === "number" && ratio < 2) || (riskInsights.grade != null && ["D", "E"].includes(riskInsights.grade))
      ? "high"
      : riskInsights.grade === "C"
      ? "medium"
      : "low";

  if (screeningStatus === "paid" || screeningStatus === "processing") {
    return {
      recommended: false,
      reason: "Screening is already in progress.",
      priority: "low" as const,
    };
  }

  if (priority === "high") {
    return {
      recommended: true,
      reason: "Current application signals are limited or elevated enough that screening should be completed before deciding.",
      priority,
    };
  }

  return {
    recommended: true,
    reason: "Screening can improve confidence before approval, especially if references are still being confirmed.",
    priority,
  };
}

function buildScreeningSummary(application: any) {
  const summary = application?.screeningResultSummary || null;
  const available = Boolean(summary || application?.screeningCompletedAt || application?.screening?.result);
  const highlights = uniqueCompact(
    [
      summary?.overall ? `Overall result: ${titleCase(summary.overall)}` : null,
      summary?.scoreBand ? `Score band: ${summary.scoreBand}` : null,
      ...(Array.isArray(summary?.flags) ? summary.flags.slice(0, 3) : []),
    ],
    4
  );
  return {
    available,
    provider: application?.screeningProvider || application?.screening?.provider || null,
    completedAt: asIsoOrNull(application?.screeningCompletedAt || application?.screening?.paidAt),
    highlights,
  };
}

function buildDecisionSupport(
  reviewSummary: ReviewSummary,
  screeningRecommendation: NonNullable<ApplicationDecisionSummary["screeningRecommendation"]>,
  screeningSummary: NonNullable<ApplicationDecisionSummary["screeningSummary"]>,
  riskInsights: NonNullable<ApplicationDecisionRiskInsights>
) {
  if (screeningSummary.available) {
    return {
      summaryLine: "Screening is available. Use it with the current application signals and references to complete review.",
      nextBestAction: reviewSummary?.reference?.phone
        ? "Review screening and references before final approval."
        : "Confirm references, then review the completed screening result.",
    };
  }
  if (screeningRecommendation.recommended) {
    return {
      summaryLine: "Current application signals are enough to guide review, but screening would strengthen decision confidence.",
      nextBestAction:
        screeningRecommendation.priority === "high"
          ? "Complete screening before deciding."
          : "Review references and consider screening before approval.",
    };
  }
  if ((riskInsights.score ?? 0) >= 75 && reviewSummary?.derived?.completeness?.score >= 0.8) {
    return {
      summaryLine: "The application reads as relatively complete and stable based on the current information available.",
      nextBestAction: "Review references before moving to approval.",
    };
  }
  return {
    summaryLine: "More verification will help improve confidence before moving forward.",
    nextBestAction: "Request any missing application details before deciding.",
  };
}

export function buildApplicationDecisionSummary(params: {
  applicationId: string;
  application: any;
  reviewSummary: ReviewSummary;
}): ApplicationDecisionSummary {
  const { applicationId, application, reviewSummary } = params;
  const riskInsights = buildAiRiskInsights(application) || buildDerivedRiskInsights(reviewSummary);
  const referenceQuestions = buildReferenceQuestions(reviewSummary, riskInsights);
  const screeningRecommendation = buildScreeningRecommendation(application, reviewSummary, riskInsights);
  const screeningSummary = buildScreeningSummary(application);
  const decisionSupport = buildDecisionSupport(reviewSummary, screeningRecommendation, screeningSummary, riskInsights);

  return {
    applicationId,
    status: String(application?.status || "").trim() || null,
    riskInsights,
    referenceQuestions,
    screeningRecommendation,
    screeningSummary,
    decisionSupport,
  };
}

