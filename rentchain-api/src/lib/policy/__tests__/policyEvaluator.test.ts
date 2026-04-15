import { describe, expect, it } from "vitest";

import { evaluatePolicy } from "../policyEvaluator";

describe("policyEvaluator", () => {
  it("lets a higher-priority blocking rule win over allow", () => {
    const result = evaluatePolicy({
      domain: "screening",
      action: "start_checkout",
      actor: { role: "landlord", userId: "user-1" },
      resource: { type: "rental_application", id: "app-1" },
      context: {
        eligible: true,
        consentComplete: true,
        applicationDataComplete: true,
        providerReady: false,
      },
    });

    expect(result.outcome).toBe("block");
    expect(result.reasons[0]?.code).toBe("SCREENING_PROVIDER_UNAVAILABLE");
  });

  it("returns review when screening consent is missing", () => {
    const result = evaluatePolicy({
      domain: "screening",
      action: "generate_quote",
      actor: { role: "landlord", userId: "user-1" },
      resource: { type: "rental_application", id: "app-1" },
      context: {
        eligible: true,
        consentComplete: false,
        applicationDataComplete: true,
        providerReady: true,
      },
    });

    expect(result.outcome).toBe("review");
    expect(result.requiresManualApproval).toBe(true);
  });

  it("ignores disabled rules", () => {
    const result = evaluatePolicy({
      domain: "screening",
      action: "generate_quote",
      actor: { role: "landlord", userId: "user-1" },
      resource: { type: "rental_application", id: "app-1" },
      context: {
        eligible: true,
        consentComplete: true,
        applicationDataComplete: true,
        providerReady: false,
      },
    });

    expect(result.outcome).toBe("allow");
    expect(result.reasons[0]?.code).toBe("SCREENING_READY");
  });

  it("returns matched rules in deterministic order", () => {
    const result = evaluatePolicy({
      domain: "screening",
      action: "start_checkout",
      actor: { role: "landlord", userId: "user-1" },
      resource: { type: "rental_application", id: "app-1" },
      context: {
        eligible: true,
        consentComplete: false,
        applicationDataComplete: false,
        providerReady: true,
      },
    });

    expect(result.matchedRules.map((entry) => entry.ruleId)).toEqual([
      "screening-start_checkout-missing-consent",
      "screening-start_checkout-incomplete-data",
      "screening-start_checkout-allow",
    ]);
  });

  it("returns serializable reasons data", () => {
    const result = evaluatePolicy({
      domain: "lease_notice",
      action: "preview_notice",
      actor: { role: "landlord", userId: "user-1" },
      resource: { type: "lease", id: "lease-1" },
      context: {
        hasRequiredLegalInputs: false,
      },
    });

    expect(JSON.parse(JSON.stringify(result.reasons))).toEqual(result.reasons);
  });
});
