import { describe, expect, it } from "vitest";
import { buildMaintenanceReopenEscalationView } from "./maintenanceReopenEscalationState";

const baseItem = {
  id: "maint-1",
  tenantId: "tenant-1",
  landlordId: "landlord-1",
  propertyId: "prop-1",
  unitId: "unit-1",
  title: "Leaky faucet",
  description: "Kitchen sink is leaking",
  category: "PLUMBING",
  priority: "normal" as const,
  status: "completed" as const,
  createdAt: 100,
  updatedAt: 200,
};

describe("maintenanceReopenEscalationState", () => {
  it("marks a closed request as tenant-reopenable when the issue returns after closure", () => {
    const view = buildMaintenanceReopenEscalationView(
      {
        ...baseItem,
        resolutionStatus: "resolved",
        tenantSignoffStatus: "accepted",
        finalResolvedAt: 300,
      },
      "tenant"
    );

    expect(view.reopenState).toBe("closed");
    expect(view.canTenantReopen).toBe(true);
    expect(view.tenantVisibleState).toBe("closed");
  });

  it("marks active follow-up as reopened when reopen metadata is present", () => {
    const view = buildMaintenanceReopenEscalationView(
      {
        ...baseItem,
        resolutionStatus: "follow_up_required",
        followUpRequired: true,
        followUpReason: "The leak returned overnight.",
        reopenedAt: 310,
        reopenReason: "The leak returned overnight.",
      },
      "landlord"
    );

    expect(view.reopenState).toBe("reopened");
    expect(view.escalationState).toBe("not_escalated");
    expect(view.timelineEvents.map((event) => event.kind)).toContain("request_reopened");
  });

  it("marks repeated follow-up as escalated after a failed return visit", () => {
    const view = buildMaintenanceReopenEscalationView(
      {
        ...baseItem,
        resolutionStatus: "follow_up_required",
        followUpRequired: true,
        followUpReason: "Still not heating evenly.",
        reopenedAt: 310,
        reworkHistory: [{ cycleNumber: 1, completedAt: 320, outcome: "partial", notes: "Initial rework reduced but did not fix the issue." }],
        reworkReview: {
          status: "follow_up_required",
          tenantSignoffStatus: "declined",
          tenantDeclinedAt: 330,
          tenantDeclineReason: "Still not heating evenly.",
          closureOutcome: "needs_more_followup",
          closedAt: null,
        },
      },
      "landlord"
    );

    expect(view.escalationState).toBe("escalated");
    expect(view.tenantVisibleState).toBe("escalated");
    expect(view.blockers.join(" ")).toMatch(/repeated attention/i);
  });
});
