import { describe, expect, it } from "vitest";
import { buildLandlordDecisionOutcome } from "./landlordDecisionOutcome";

describe("buildLandlordDecisionOutcome", () => {
  it("maps an explicit ready outcome record when present", () => {
    const result = buildLandlordDecisionOutcome({
      decisionStatus: "approved",
    });

    expect(result.outcomeState).toBe("ready_for_next_step");
    expect(result.source).toBe("explicit");
    expect(result.timelineEvent.title).toBe("Application marked Ready for next step");
  });

  it("maps an explicit not proceeding outcome record when present", () => {
    const result = buildLandlordDecisionOutcome({
      decisionStatus: "not_proceeding",
    });

    expect(result.outcomeState).toBe("not_proceeding");
    expect(result.source).toBe("explicit");
    expect(result.tenantDescription).toMatch(/not proceeding/i);
  });

  it("derives ready for next step from a ready-for-decision workspace", () => {
    const result = buildLandlordDecisionOutcome({
      decisionWorkspace: {
        decisionState: "ready_for_decision",
        statusLabel: "Ready for decision",
        summary: "Decision workspace",
        explanation: "Ready.",
        blockers: [],
        nextSteps: ["Move forward."],
        missingCategories: [],
      },
      followUpOverallState: "ready_for_rereview",
      remainingCategories: [],
    });

    expect(result.outcomeState).toBe("ready_for_next_step");
    expect(result.source).toBe("derived");
    expect(result.timelineEvent.title).toBe("Application aligned as Ready for next step");
  });

  it("derives hold for later when follow-up still remains open", () => {
    const result = buildLandlordDecisionOutcome({
      followUpOverallState: "follow_up_needed",
      remainingCategories: ["Documents & records"],
    });

    expect(result.outcomeState).toBe("hold_for_later");
    expect(result.source).toBe("derived");
    expect(result.blockers[0]).toMatch(/Documents & records/i);
    expect(result.timelineEvent.actionRequired).toBe(true);
  });
});
