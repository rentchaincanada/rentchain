import { describe, expect, it } from "vitest";

import {
  isMachineStyleWorkOrderLabel,
  workOrderCategoryLabel,
  workOrderCollectionLabel,
  workOrderEntityLabel,
  workOrderPriorityLabel,
  workOrderStatusLabel,
} from "./workOrderOperationalLabels";

describe("workOrderOperationalLabels", () => {
  it("uses canonical terminology by audience", () => {
    expect(workOrderEntityLabel("tenant")).toBe("Maintenance request");
    expect(workOrderEntityLabel("operator")).toBe("Work order");
    expect(workOrderEntityLabel("review")).toBe("Operational work order");
    expect(workOrderEntityLabel("vendor")).toBe("Service task");

    expect(workOrderCollectionLabel("tenant")).toBe("Maintenance requests");
    expect(workOrderCollectionLabel("operator")).toBe("Work orders");
    expect(workOrderCollectionLabel("review")).toBe("Operational work orders");
    expect(workOrderCollectionLabel("vendor")).toBe("Service tasks");
  });

  it("normalizes workflow statuses without exposing machine-style labels", () => {
    const labels = [
      workOrderStatusLabel("submitted", "operator"),
      workOrderStatusLabel("reviewed", "operator"),
      workOrderStatusLabel("scheduled", "operator"),
      workOrderStatusLabel("in_progress", "operator"),
      workOrderStatusLabel("tenant_pending_signoff", "operator"),
      workOrderStatusLabel("contractor_pending", "operator"),
      workOrderStatusLabel("completed", "operator"),
      workOrderStatusLabel("cancelled", "operator"),
    ];

    expect(labels).toEqual([
      "Needs review",
      "Open",
      "Assigned",
      "In progress",
      "Waiting on tenant",
      "Waiting on vendor",
      "Completed",
      "Cancelled",
    ]);
    expect(labels.some((label) => isMachineStyleWorkOrderLabel(label))).toBe(false);
  });

  it("keeps tenant-facing maintenance request status language safe", () => {
    expect(workOrderStatusLabel("submitted", "tenant")).toBe("Submitted");
    expect(workOrderStatusLabel("reviewed", "tenant")).toBe("Acknowledged");
    expect(workOrderStatusLabel("scheduled", "tenant")).toBe("Scheduled");
    expect(workOrderStatusLabel("tenant_pending_signoff", "tenant")).toBe("Waiting on tenant");
  });

  it("normalizes priority and category labels deterministically", () => {
    expect(workOrderPriorityLabel("urgent")).toBe("Urgent");
    expect(workOrderCategoryLabel("hvac")).toBe("HVAC");
    expect(workOrderCategoryLabel("general_repair")).toBe("General Repair");
  });
});
