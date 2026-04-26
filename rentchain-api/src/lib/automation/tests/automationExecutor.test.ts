import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAutomation } from "../automationExecutor";
import type { PolicyEvaluationResult } from "../../policy/policyTypes";

const { writeCanonicalEvent } = vi.hoisted(() => ({
  writeCanonicalEvent: vi.fn(async () => undefined),
}));

vi.mock("../../events/buildEvent", () => ({
  writeCanonicalEvent,
}));

function policyResult(overrides: Partial<PolicyEvaluationResult>): PolicyEvaluationResult {
  return {
    version: "v1",
    domain: "screening",
    action: "start_checkout",
    outcome: "allow",
    reasons: [],
    matchedRules: [],
    requiresManualApproval: false,
    canAutopilot: true,
    evaluatedAt: "2026-04-15T12:00:00.000Z",
    ...overrides,
  };
}

const actor = { type: "landlord" as const, id: "landlord-1", role: "landlord" };
const resource = { type: "rental_application", id: "app-1" };

describe("executeAutomation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes when policy allows", async () => {
    const execute = vi.fn(async () => ({ checkoutUrl: "https://checkout.test" }));
    const result = await executeAutomation({
      action: "screening.auto_start_checkout",
      policyResult: policyResult({}),
      actor,
      resource,
      context: {
        quoteExists: true,
        existingCheckout: false,
        alreadyPaid: false,
        execute,
      },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.automationResult).toEqual(
      expect.objectContaining({
        action: "screening.auto_start_checkout",
        executed: true,
        skipped: false,
      })
    );
    expect(result.data).toEqual({ checkoutUrl: "https://checkout.test" });
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation.executed",
      })
    );
  });

  it("skips when blocked", async () => {
    const execute = vi.fn();
    const result = await executeAutomation({
      action: "screening.auto_start_checkout",
      policyResult: policyResult({ outcome: "block", canAutopilot: false }),
      actor,
      resource,
      context: {
        quoteExists: true,
        existingCheckout: false,
        alreadyPaid: false,
        execute,
      },
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.automationResult).toEqual(
      expect.objectContaining({
        executed: false,
        skipped: true,
      })
    );
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation.skipped",
      })
    );
  });

  it("skips when review is required", async () => {
    const execute = vi.fn();
    const result = await executeAutomation({
      action: "maintenance.auto_approve_cost",
      policyResult: policyResult({
        domain: "maintenance",
        action: "approve_cost",
        outcome: "review",
        requiresManualApproval: true,
        canAutopilot: false,
      }),
      actor,
      resource: { type: "work_order", id: "wo-1" },
      context: {
        alreadyApproved: false,
        actualCostCents: 50_000,
        thresholdCents: 100_000,
        hasSupportingEvidence: true,
        execute,
      },
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.automationResult.skipped).toBe(true);
    expect(result.automationResult.executed).toBe(false);
  });

  it("skips when already completed", async () => {
    const execute = vi.fn();
    const result = await executeAutomation({
      action: "maintenance.auto_approve_cost",
      policyResult: policyResult({
        domain: "maintenance",
        action: "approve_cost",
      }),
      actor,
      resource: { type: "work_order", id: "wo-1" },
      context: {
        alreadyApproved: true,
        actualCostCents: 50_000,
        thresholdCents: 100_000,
        hasSupportingEvidence: true,
        execute,
      },
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.automationResult.reason).toBe("MAINTENANCE_ALREADY_APPROVED");
  });

  it("does not duplicate execution when prerequisites say an action already exists", async () => {
    const execute = vi.fn();
    const result = await executeAutomation({
      action: "screening.auto_start_checkout",
      policyResult: policyResult({}),
      actor,
      resource,
      context: {
        quoteExists: true,
        existingCheckout: true,
        alreadyPaid: false,
        execute,
      },
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.automationResult.reason).toBe("SCREENING_CHECKOUT_ALREADY_EXISTS");
  });

  it("returns a stable result structure when execution throws", async () => {
    const result = await executeAutomation({
      action: "lease.auto_send_notice",
      policyResult: policyResult({
        domain: "lease_notice",
        action: "send_notice",
      }),
      actor,
      resource: { type: "lease", id: "lease-1" },
      context: {
        noticeReady: true,
        alreadySent: false,
        hasRequiredLegalInputs: true,
        execute: async () => {
          throw new Error("EMAIL_FAILED");
        },
      },
    });

    expect(result.automationResult).toEqual(
      expect.objectContaining({
        action: "lease.auto_send_notice",
        executed: false,
        skipped: true,
        reason: "EMAIL_FAILED",
      })
    );
  });
});
