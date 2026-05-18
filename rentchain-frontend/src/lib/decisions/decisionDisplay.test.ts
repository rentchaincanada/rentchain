import { describe, expect, it } from "vitest";
import { isDecisionActive, summarizeDecisionItems, type DecisionItem } from "./decisionDisplay";

function decision(overrides: Partial<DecisionItem> = {}): DecisionItem {
  return {
    decisionId: "decision-1",
    leaseId: "lease-1",
    decisionType: "review_missing_payment",
    severity: "critical",
    status: "detected",
    reason: "Expected rent payment is missing.",
    metadata: {},
    ...overrides,
  };
}

describe("decisionDisplay", () => {
  it("treats assigned decisions as active and reviewed/snoozed/dismissed/resolved decisions as inactive", () => {
    expect(isDecisionActive(decision({ status: "detected" }))).toBe(true);
    expect(isDecisionActive(decision({ status: "assigned" }))).toBe(true);
    expect(isDecisionActive(decision({ status: "reviewed" }))).toBe(false);
    expect(isDecisionActive(decision({ status: "snoozed" }))).toBe(false);
    expect(isDecisionActive(decision({ status: "dismissed" }))).toBe(false);
    expect(isDecisionActive(decision({ status: "resolved" }))).toBe(false);
  });

  it("summarizes active decisions without losing the inactive audit count", () => {
    const summary = summarizeDecisionItems([
      decision({ decisionId: "critical-active", severity: "critical", status: "detected" }),
      decision({ decisionId: "warning-active", severity: "warning", decisionType: "review_underpaid_rent", status: "assigned" }),
      decision({ decisionId: "critical-reviewed", severity: "critical", status: "reviewed" }),
      decision({ decisionId: "warning-resolved", severity: "warning", status: "resolved" }),
    ]);

    expect(summary.total).toBe(2);
    expect(summary.allTotal).toBe(4);
    expect(summary.inactiveTotal).toBe(2);
    expect(summary.critical).toBe(1);
    expect(summary.warning).toBe(1);
    expect(summary.underpaid).toBe(1);
  });
});
