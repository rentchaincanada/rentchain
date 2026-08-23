import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiJson } = vi.hoisted(() => ({ apiJson: vi.fn() }));
vi.mock("@/api/http", () => ({ apiJson }));

import { submitOccupancyResolution } from "./occupancyResolutionApi";

describe("occupancyResolutionApi", () => {
  beforeEach(() => apiJson.mockReset().mockResolvedValue({ ok: true }));

  it("sends the caller-owned idempotency key as a header", async () => {
    await submitOccupancyResolution({
      context: { propertyId: "property-1", unitId: "unit-1", tenantId: null, propertyLabel: "Property", unitLabel: "1", canonicalState: {} as any, expectedStateToken: "state-1", eligibleResolutionTypes: ["resolve_multiple_current_leases"], existingLeaseCandidates: [], activeLeaseRequiresEndWorkflow: false },
      type: "resolve_multiple_current_leases",
      selectedLeaseId: "lease-a",
      idempotencyKey: "resolution-key-1",
    });
    expect(apiJson).toHaveBeenCalledWith("/occupancy-resolutions", expect.objectContaining({ headers: { "Content-Type": "application/json", "Idempotency-Key": "resolution-key-1" } }));
    expect(JSON.parse(apiJson.mock.calls[0][1].body)).not.toHaveProperty("idempotencyKey");
  });
});
