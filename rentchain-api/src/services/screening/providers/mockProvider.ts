import { CreditProvider, CreditProviderRequest, CreditProviderResult } from "./providerTypes";

function normalizeName(request: CreditProviderRequest): string {
  return (
    `${request.applicant.firstName || ""}${request.applicant.middleName || ""}${
      request.applicant.lastName || ""
    }${request.applicant.dateOfBirth || ""}`
      .toLowerCase()
      .replace(/\s+/g, "")
  );
}

function deterministicScore(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  const base = 550 + (hash % 231); // 550-780
  return Math.min(Math.max(base, 550), 780);
}

function determineRisk(score: number): string {
  if (score >= 720) return "low";
  if (score >= 660) return "medium";
  return "high";
}

export class MockCreditProvider implements CreditProvider {
  async createReport(
    request: CreditProviderRequest
  ): Promise<CreditProviderResult> {
    const seed = normalizeName(request);
    const score = deterministicScore(seed);
    const riskBand = determineRisk(score);
    const generatedAt = new Date().toISOString();

    const highlights: string[] = [
      `Credit score: ${score}`,
      riskBand === "low"
        ? "No significant negative records detected in stub data."
        : riskBand === "medium"
        ? "Some moderate risk indicators present; review references closely."
        : "High risk indicators detected in stub data.",
      "Income verification recommended before lease signing.",
    ];

    return {
      providerName: "mock",
      providerReferenceId: `mock_${seed.slice(0, 8)}`,
      score,
      riskBand,
      highlights,
      summaryText: `Mock credit screening completed with risk band ${riskBand}.`,
      rawPayload: {
        provider: "mock",
        seed,
        score,
        riskBand,
        generatedAt,
        requestEcho: {
          applicationId: request.applicationId,
          applicant: request.applicant,
          address: request.address,
        },
      },
      generatedAt,
    };
  }
}
