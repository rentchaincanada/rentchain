import { describe, expect, it } from "vitest";
import {
  addOperatorReviewNote,
  buildOperatorReviewSession,
  closeOperatorReviewSession,
  normalizeOperatorReviewSession,
  parseOperatorReviewCloseRequest,
  parseOperatorReviewOpenRequest,
  sanitizeOperatorReviewNote,
} from "../buildOperatorReviewSession";

const actor = { userId: "landlord-1", role: "landlord" as const, email: "landlord@example.com" };

describe("buildOperatorReviewSession", () => {
  it("builds deterministic manual review sessions for a scope", () => {
    const request = parseOperatorReviewOpenRequest({
      scope: "decision",
      scopeId: "decision-1",
      linkedEvidence: [{ evidenceId: "decision-1", label: "Decision", kind: "decision", destination: "/decision-inbox" }],
      note: "Initial review",
    });
    expect(request).toBeTruthy();

    const session = buildOperatorReviewSession({
      landlordId: "landlord-1",
      request: request!,
      actor,
      now: "2026-05-05T12:00:00.000Z",
    });
    const duplicate = buildOperatorReviewSession({
      landlordId: "landlord-1",
      request: request!,
      actor,
      now: "2026-05-05T12:00:00.000Z",
    });

    expect(session.reviewSessionId).toBe(duplicate.reviewSessionId);
    expect(session).toEqual(
      expect.objectContaining({
        scope: "decision",
        scopeId: "decision-1",
        status: "open",
        manualOnly: true,
        systemGenerated: false,
      })
    );
    expect(session.notes[0]).toEqual(expect.objectContaining({ text: "Initial review", actor }));
  });

  it("sanitizes notes and preserves note history", () => {
    const session = buildOperatorReviewSession({
      landlordId: "landlord-1",
      request: { scope: "audit_compliance", scopeId: "readiness-1", linkedEvidence: [], note: null },
      actor,
      now: "2026-05-05T12:00:00.000Z",
    });
    const updated = addOperatorReviewNote({
      session,
      note: " <script>Review</script>   evidence ",
      actor,
      now: "2026-05-05T12:01:00.000Z",
    });

    expect(sanitizeOperatorReviewNote(" <b>Needs review</b> ")).toBe("bNeeds review/b");
    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0].text).toBe("scriptReview/script evidence");
    expect(session.notes).toHaveLength(0);
  });

  it("closes sessions with deterministic outcomes without mutating the source object", () => {
    const session = buildOperatorReviewSession({
      landlordId: "landlord-1",
      request: { scope: "institution_export", scopeId: "package-1", linkedEvidence: [], note: null },
      actor,
      now: "2026-05-05T12:00:00.000Z",
    });
    const request = parseOperatorReviewCloseRequest({
      result: "needs_follow_up",
      summary: "Needs source context follow-up",
    });

    const closed = closeOperatorReviewSession({
      session,
      request: request!,
      actor,
      now: "2026-05-05T12:02:00.000Z",
    });

    expect(session.status).toBe("open");
    expect(closed.status).toBe("completed");
    expect(closed.outcome).toEqual(
      expect.objectContaining({
        result: "needs_follow_up",
        summary: "Needs source context follow-up",
        recordedBy: actor,
      })
    );
  });

  it("normalizes stored sessions defensively", () => {
    const normalized = normalizeOperatorReviewSession({
      reviewSessionId: "session-1",
      landlordId: "landlord-1",
      scope: "workflow",
      scopeId: "workflow-1",
      status: "completed",
      openedAt: "2026-05-05T12:00:00.000Z",
      closedAt: "2026-05-05T12:02:00.000Z",
      openedBy: actor,
      outcome: {
        result: "reviewed",
        summary: "Reviewed",
        recordedAt: "2026-05-05T12:02:00.000Z",
        recordedBy: actor,
      },
      notes: [],
      linkedEvidence: [],
      updatedAt: "2026-05-05T12:02:00.000Z",
    });

    expect(normalized).toEqual(expect.objectContaining({ reviewSessionId: "session-1", manualOnly: true }));
    expect(normalizeOperatorReviewSession({ reviewSessionId: "missing" })).toBeNull();
  });
});
