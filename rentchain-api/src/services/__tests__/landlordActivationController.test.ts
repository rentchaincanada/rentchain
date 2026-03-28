import { describe, expect, it, vi } from "vitest";
import { getLandlordActivation } from "../activation/landlordActivationController";

const { getLandlordActivationSummaryMock } = vi.hoisted(() => ({
  getLandlordActivationSummaryMock: vi.fn(),
}));

vi.mock("../activation/landlordActivationService", () => ({
  getLandlordActivationSummary: getLandlordActivationSummaryMock,
}));

function createRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("getLandlordActivation", () => {
  it("rejects non-landlord users", async () => {
    const res = createRes();
    await getLandlordActivation({ user: { role: "tenant", id: "tenant-1" } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns the activation summary for landlord users", async () => {
    const res = createRes();
    const summary = {
      steps: [],
      completedCount: 0,
      totalCount: 7,
      nextStepKey: "property",
    };
    getLandlordActivationSummaryMock.mockResolvedValueOnce(summary);

    await getLandlordActivation(
      { user: { role: "landlord", id: "landlord-1", landlordId: "landlord-1" } } as any,
      res as any
    );

    expect(getLandlordActivationSummaryMock).toHaveBeenCalledWith("landlord-1");
    expect(res.json).toHaveBeenCalledWith(summary);
  });
});
