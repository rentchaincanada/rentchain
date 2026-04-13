import { describe, expect, it } from "vitest";
import { buildMaintenanceAssignmentRoutingView } from "./maintenanceAssignmentRoutingState";

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
  status: "submitted" as const,
  createdAt: 100,
  updatedAt: 200,
};

describe("maintenance assignment routing state", () => {
  it("treats new requests as unassigned", () => {
    const result = buildMaintenanceAssignmentRoutingView(baseItem, "tenant");
    expect(result.assignmentState).toBe("unassigned");
    expect(result.tenantVisibleState).toBe("awaiting_assignment");
    expect(result.summary).toMatch(/waiting to be assigned/i);
  });

  it("treats assigned requests without a contractor as internal handling", () => {
    const result = buildMaintenanceAssignmentRoutingView({ ...baseItem, status: "assigned" }, "landlord");
    expect(result.assignmentState).toBe("assigned_internal");
    expect(result.routingSummary).toMatch(/internal handling/i);
  });

  it("treats assigned requests with a contractor as routed for service", () => {
    const result = buildMaintenanceAssignmentRoutingView(
      { ...baseItem, status: "assigned", assignedContractorName: "North Shore HVAC" },
      "landlord"
    );
    expect(result.assignmentState).toBe("routed_for_service");
    expect(result.summary).toMatch(/North Shore HVAC/i);
  });

  it("treats in-progress work as active handling for tenants", () => {
    const result = buildMaintenanceAssignmentRoutingView(
      { ...baseItem, status: "in_progress", assignedContractorName: "North Shore HVAC" },
      "tenant"
    );
    expect(result.assignmentState).toBe("in_progress");
    expect(result.tenantVisibleState).toBe("service_in_progress");
  });

  it("surfaces routing problems as needs attention", () => {
    const result = buildMaintenanceAssignmentRoutingView(
      { ...baseItem, status: "assigned", contractorStatus: "declined", assignedContractorName: "North Shore HVAC" },
      "landlord"
    );
    expect(result.assignmentState).toBe("needs_attention");
    expect(result.blockers[0]).toMatch(/declined/i);
  });
});
