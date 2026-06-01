import { describe, expect, it } from "vitest";
import { leaseStateMachine } from "../leaseStateMachine";
import type { LeaseContext } from "../types";

const context: LeaseContext = {
  actorRole: "landlord",
  actorId: "actor-1",
  authorized: true,
  leaseId: "lease-1",
  landlordId: "landlord-1",
  noticeId: "notice-1",
  noticeRequired: true,
  restoreRequested: true,
};

describe("leaseStateMachine", () => {
  it("allows lifecycle movement through notice, end, restore, and reactivate", () => {
    const results = [
      leaseStateMachine.validateTransition({ currentState: "Draft", proposedState: "Active", event: "activate", context }),
      leaseStateMachine.validateTransition({ currentState: "Active", proposedState: "NoticePending", event: "prepare_notice", context }),
      leaseStateMachine.validateTransition({ currentState: "NoticePending", proposedState: "Ended", event: "end", context }),
      leaseStateMachine.validateTransition({ currentState: "Ended", proposedState: "Restored", event: "restore", context }),
      leaseStateMachine.validateTransition({ currentState: "Restored", proposedState: "Active", event: "reactivate", context }),
    ];

    expect(results.every((result) => result.valid)).toBe(true);
  });

  it("rejects direct reversal from ended to active", () => {
    const result = leaseStateMachine.validateTransition({
      currentState: "Ended",
      proposedState: "Active",
      event: "reactivate",
      context,
    });

    expect(result.valid).toBe(false);
    expect(result.allowedTransitions).toEqual(["Restored"]);
  });

  it("requires restore intent and notice context", () => {
    const restore = leaseStateMachine.validateTransition({
      currentState: "Ended",
      proposedState: "Restored",
      event: "restore",
      context: { ...context, restoreRequested: false },
    });
    const notice = leaseStateMachine.validateTransition({
      currentState: "Active",
      proposedState: "NoticePending",
      event: "prepare_notice",
      context: { ...context, noticeId: null },
    });

    expect(restore.valid).toBe(false);
    expect(restore.reason).toContain("restore");
    expect(notice.valid).toBe(false);
    expect(notice.reason).toContain("noticeId");
  });
});
