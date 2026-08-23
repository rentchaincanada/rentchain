import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ apiJson: vi.fn() }));
vi.mock("@/api/http", () => ({ apiJson: mocks.apiJson }));
import { getOccupancyReviewWorkspace } from "./occupancyReviewApi";

describe("occupancyReviewApi", () => {
  beforeEach(() => mocks.apiJson.mockReset());
  it("uses the single read-only review endpoint", async () => {
    mocks.apiJson.mockResolvedValue({ ok: true, items: [], counts: { total: 0 } });
    await getOccupancyReviewWorkspace();
    expect(mocks.apiJson).toHaveBeenCalledWith("/occupancy-reviews");
  });
});
