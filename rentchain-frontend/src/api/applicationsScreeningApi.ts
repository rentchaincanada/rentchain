import type { Application } from "./applications";

export type ScreeningReadiness = {
  canRun: boolean;
  missing: string[];
};

export function deriveScreeningReadiness(
  application?: Pick<
    Application,
    "consentCreditCheck" | "phoneVerified" | "referencesContacted" | "canRunCreditReport"
  > | null
): ScreeningReadiness {
  if (!application) {
    return { canRun: false, missing: [] };
  }

  const missing: string[] = [];

  if (!application.consentCreditCheck) {
    missing.push("Consent required");
  }
  if (!application.phoneVerified) {
    missing.push("Phone verification required");
  }
  if (!application.referencesContacted) {
    missing.push("References must be contacted");
  }

  const canRun = missing.length === 0;

  return { canRun, missing };
}
