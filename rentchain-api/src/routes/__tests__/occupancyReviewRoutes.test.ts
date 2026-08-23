import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getWorkspace: vi.fn(), capability: vi.fn() }));
vi.mock("../../services/occupancyReviewWorkspaceService", () => ({ getOccupancyReviewWorkspace: mocks.getWorkspace }));
vi.mock("../../services/capabilityGuard", () => ({ requireCapability: mocks.capability }));
vi.mock("../../middleware/requireLandlord", () => ({ requireLandlord: (req: any, res: any, next: any) => req.headers.authorization ? (req.user = { id: req.headers["x-landlord-id"] || "landlord-1", landlordId: req.headers["x-landlord-id"] || "landlord-1", role: req.headers["x-role"] || "landlord" }, next()) : res.status(401).json({ ok: false, error: "unauthenticated" }) }));
import router from "../occupancyReviewRoutes";

describe("occupancyReviewRoutes", () => {
  const app = express().use(express.json()).use("/api/occupancy-reviews", router);
  beforeEach(() => { vi.clearAllMocks(); mocks.capability.mockResolvedValue({ ok: true, plan: "starter" }); mocks.getWorkspace.mockResolvedValue({ items: [], counts: { total: 0, multipleCurrent: 0, occupancy: 0, lease: 0, signing: 0, tenantRelationship: 0 } }); });
  it("rejects unauthenticated requests", async () => expect((await request(app).get("/api/occupancy-reviews")).status).toBe(401));
  it("enforces the existing leases capability", async () => { mocks.capability.mockResolvedValue({ ok: false, plan: "free" }); const res = await request(app).get("/api/occupancy-reviews").set("Authorization", "Bearer test"); expect(res.status).toBe(403); expect(mocks.getWorkspace).not.toHaveBeenCalled(); });
  it("returns a legitimate empty landlord-scoped workspace", async () => { const res = await request(app).get("/api/occupancy-reviews").set("Authorization", "Bearer test"); expect(res.status).toBe(200); expect(res.body).toMatchObject({ ok: true, items: [], counts: { total: 0 } }); expect(mocks.getWorkspace).toHaveBeenCalledWith("landlord-1"); });
  it("returns populated review items without mutation endpoints", async () => { mocks.getWorkspace.mockResolvedValue({ items: [{ id: "review-1" }], counts: { total: 1 } }); const get = await request(app).get("/api/occupancy-reviews").set("Authorization", "Bearer test"); expect(get.status).toBe(200); expect(get.body.items).toEqual([{ id: "review-1" }]); expect((await request(app).post("/api/occupancy-reviews").set("Authorization", "Bearer test")).status).toBe(404); });
  it("fails closed instead of returning a false all-clear", async () => { mocks.getWorkspace.mockRejectedValue(new Error("read failed")); const res = await request(app).get("/api/occupancy-reviews").set("Authorization", "Bearer test"); expect(res.status).toBe(500); expect(res.body).toEqual({ ok: false, error: "occupancy_reviews_unavailable" }); });
  it("uses the authenticated landlord identity for isolation", async () => { await request(app).get("/api/occupancy-reviews").set("Authorization", "Bearer test").set("x-landlord-id", "landlord-2"); expect(mocks.getWorkspace).toHaveBeenCalledWith("landlord-2"); });
});
