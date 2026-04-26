import { describe, expect, it } from "vitest";
import { deriveSlaState } from "../deriveSlaState";

const NOW = Date.parse("2026-04-16T14:00:00.000Z");

describe("deriveSlaState", () => {
  it("maps severity to threshold profiles deterministically", () => {
    const critical = deriveSlaState({
      resourceType: "application",
      resourceId: "app-1",
      triageCategory: "screening_reconciliation",
      triageSeverity: "critical",
      firstSeenAt: "2026-04-16T10:00:00.000Z",
      now: NOW,
    });
    const medium = deriveSlaState({
      resourceType: "maintenance",
      resourceId: "maint-1",
      triageCategory: "maintenance_friction",
      triageSeverity: "medium",
      firstSeenAt: "2026-04-16T10:00:00.000Z",
      now: NOW,
    });
    const low = deriveSlaState({
      resourceType: "lease",
      resourceId: "lease-1",
      triageCategory: "policy_review",
      triageSeverity: "low",
      firstSeenAt: "2026-04-16T10:00:00.000Z",
      now: NOW,
    });

    expect(critical.sla.thresholdHours).toEqual({ aging: 6, dueSoon: 12, overdue: 24, escalated: 36 });
    expect(medium.sla.thresholdHours).toEqual({ aging: 12, dueSoon: 24, overdue: 48, escalated: 72 });
    expect(low.sla.thresholdHours).toEqual({ aging: 24, dueSoon: 48, overdue: 72, escalated: 96 });
  });

  it("derives stages across fresh through escalated", () => {
    expect(
      deriveSlaState({
        resourceType: "application",
        resourceId: "app-1",
        triageSeverity: "critical",
        firstSeenAt: "2026-04-16T10:00:00.000Z",
        now: NOW,
      }).sla.stage
    ).toBe("fresh");
    expect(
      deriveSlaState({
        resourceType: "application",
        resourceId: "app-1",
        triageSeverity: "critical",
        firstSeenAt: "2026-04-16T07:00:00.000Z",
        now: NOW,
      }).sla.stage
    ).toBe("aging");
    expect(
      deriveSlaState({
        resourceType: "application",
        resourceId: "app-1",
        triageSeverity: "critical",
        firstSeenAt: "2026-04-15T23:00:00.000Z",
        now: NOW,
      }).sla.stage
    ).toBe("due_soon");
    expect(
      deriveSlaState({
        resourceType: "application",
        resourceId: "app-1",
        triageSeverity: "critical",
        firstSeenAt: "2026-04-15T10:00:00.000Z",
        now: NOW,
      }).sla.stage
    ).toBe("overdue");
    expect(
      deriveSlaState({
        resourceType: "application",
        resourceId: "app-1",
        triageSeverity: "critical",
        firstSeenAt: "2026-04-14T22:00:00.000Z",
        now: NOW,
      }).sla.stage
    ).toBe("escalated");
  });

  it("maps escalation levels from stage", () => {
    expect(
      deriveSlaState({
        resourceType: "maintenance",
        resourceId: "maint-1",
        triageSeverity: "medium",
        firstSeenAt: "2026-04-15T13:00:00.000Z",
        now: NOW,
      }).sla.escalationLevel
    ).toBe("low");
    expect(
      deriveSlaState({
        resourceType: "maintenance",
        resourceId: "maint-1",
        triageSeverity: "medium",
        firstSeenAt: "2026-04-14T13:00:00.000Z",
        now: NOW,
      }).sla.escalationLevel
    ).toBe("high");
    expect(
      deriveSlaState({
        resourceType: "maintenance",
        resourceId: "maint-1",
        triageSeverity: "medium",
        firstSeenAt: "2026-04-13T10:00:00.000Z",
        now: NOW,
      }).sla.escalationLevel
    ).toBe("critical");
  });

  it("handles missing timestamp context safely", () => {
    const result = deriveSlaState({
      resourceType: "lease",
      resourceId: "lease-1",
      triageSeverity: "low",
      now: NOW,
    });

    expect(result.age.ageMs).toBe(0);
    expect(result.sla.stage).toBe("fresh");
    expect(result.reason.code).toBe("SLA_FRESH");
  });
});
