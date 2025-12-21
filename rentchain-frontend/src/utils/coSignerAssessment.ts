// rentchain-frontend/src/utils/coSignerAssessment.ts
import type { Application } from "@/api/applicationsApi";

export type CoSignerLevel = "NotRequired" | "Recommended" | "Required";

export interface CoSignerDecision {
  level: CoSignerLevel;
  reasons: string[];
}

export function assessCoSignerNeed(app: Application): CoSignerDecision {
  const reasons: string[] = [];

  const ratio =
    app.rentToIncomeRatio ??
    (app.monthlyIncome > 0
      ? app.requestedRent / app.monthlyIncome
      : 0);

  const score = app.score;
  const risk = app.riskLevel;

  let level: CoSignerLevel = "NotRequired";

  // 🔴 Hard triggers → co-signer REQUIRED
  if (risk === "High") {
    level = "Required";
    reasons.push("Overall risk level is High.");
  }

  if (score < 60) {
    level = "Required";
    reasons.push(
      "Score is below 60, indicating elevated credit or behavior risk."
    );
  }

  if (ratio >= 0.5) {
    level = "Required";
    reasons.push(
      "Rent-to-income is at or above 50%, which is outside typical underwriting limits."
    );
  }

  // 🟡 Softer triggers → co-signer RECOMMENDED (only if not already 'Required')
  if (level !== "Required") {
    if (risk === "Medium") {
      level = "Recommended";
      reasons.push(
        "Risk level is Medium; a co-signer can reduce landlord exposure."
      );
    }

    if (ratio >= 0.4 && ratio < 0.5) {
      if (level === "NotRequired") level = "Recommended";
      reasons.push(
        "Rent-to-income between 40–50% is high; a co-signer is prudent."
      );
    }

    if (score >= 60 && score <= 70) {
      if (level === "NotRequired") level = "Recommended";
      reasons.push(
        "Score is in a borderline band (60–70) where co-signers are commonly used."
      );
    }
  }

  // 🟢 Everything looks strong → Not required
  if (!reasons.length) {
    reasons.push(
      "Income, rent-to-income ratio, risk level and score are all within conservative limits."
    );
  }

  return { level, reasons };
}
