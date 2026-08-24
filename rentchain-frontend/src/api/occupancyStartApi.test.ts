import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ apiJson: vi.fn() }));
vi.mock("@/api/http", () => ({ apiJson: mocks.apiJson }));
import { getOccupancyStartContext, startOccupancy } from "./occupancyStartApi";

describe("occupancyStartApi", () => {
  beforeEach(() => vi.clearAllMocks());
  it("loads encoded server-authoritative context", async () => { await getOccupancyStartContext("lease one"); expect(mocks.apiJson).toHaveBeenCalledWith("/leases/lease%20one/occupancy-start-context"); });
  it("sends expected state, confirmation, and idempotency header", async () => { await startOccupancy("lease-1", { expectedStateToken: "state-1", evaluationInstant: "2026-08-24T00:00:00.000Z", idempotencyKey: "key-1" }); expect(mocks.apiJson).toHaveBeenCalledWith("/leases/lease-1/start-occupancy", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" }, body: expect.stringContaining('"possessionConfirmed":true') })); });
});
