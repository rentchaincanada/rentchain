import { describe, expect, it } from "vitest";
import { generateLeaseAutomationTasks } from "../automationScheduler/leaseTaskScheduler";

describe("leaseTaskScheduler", () => {
  it("generates renewal and draft tasks for an active automated lease", () => {
    const tasks = generateLeaseAutomationTasks({
      id: "lease-1",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      automationEnabled: true,
      renewalStatus: "unknown",
    });

    expect(tasks.map((t) => t.kind)).toEqual([
      "renewal_reminder",
      "rent_increase_eligibility_check",
      "renewal_offer_draft",
    ]);
  });

  it("adds move-out reminders when renewal is declined", () => {
    const tasks = generateLeaseAutomationTasks({
      id: "lease-2",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      automationEnabled: true,
      renewalStatus: "declined",
    });

    expect(tasks.map((t) => t.kind)).toEqual([
      "renewal_reminder",
      "rent_increase_eligibility_check",
      "renewal_offer_draft",
      "move_out_reminder_30",
      "move_out_reminder_14",
      "move_out_reminder_3",
    ]);
  });

  it("returns no tasks when automation is disabled", () => {
    const tasks = generateLeaseAutomationTasks({
      id: "lease-3",
      endDate: "2026-12-31",
      automationEnabled: false,
    });

    expect(tasks).toEqual([]);
  });
});
