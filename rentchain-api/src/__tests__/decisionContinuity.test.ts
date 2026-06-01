import { describe, expect, it } from "vitest";
import { deriveCanonicalReviewTimeline } from "../lib/reviewTimeline/deriveCanonicalReviewTimeline";

describe("decision continuity timeline integration", () => {
  it("includes recovery actions as manual-only canonical timeline entries", () => {
    const timeline = deriveCanonicalReviewTimeline({
      scope: "workflow",
      scopeId: "decision:instance:safe-workflow",
      recoveryLogs: [
        {
          logId: "operator_recovery:safe-log",
          workflowInstanceKey: "decision:instance:safe-workflow",
          reconciliationDecision: "EVIDENCE_REVIEW_REQUIRED",
          reasonSummary: "Evidence needs manual review.",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(timeline.filters.entryType).toContain("recovery_action");
    expect(timeline.filters.source).toContain("operator_recovery");
    expect(timeline.entries).toHaveLength(1);
    expect(timeline.entries[0]).toMatchObject({
      entryType: "recovery_action",
      source: "operator_recovery",
      status: "review_required",
      manualOnly: true,
    });
  });
});
