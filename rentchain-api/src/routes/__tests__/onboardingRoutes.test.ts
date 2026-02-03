import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.user = { landlordId: "landlord-1", id: "user-1" };
    next();
  },
}));

vi.mock("../../db/onboardingRepo", () => ({
  updateOnboarding: vi.fn(async () => ({
    landlordId: "landlord-1",
    dismissed: false,
    steps: { propertyAdded: false },
    lastSeenAt: null,
  })),
  getOrCreateDefault: vi.fn(),
  markStep: vi.fn(),
}));

describe("onboarding routes", () => {
  it("returns 200 when authed", async () => {
    const router = (await import("../onboardingRoutes")).default;
    const app = express();
    app.use("/api/onboarding", router);
    const res = await request(app).get("/api/onboarding");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 200 for probe when authed", async () => {
    const router = (await import("../onboardingRoutes")).default;
    const app = express();
    app.use("/api", router);
    const res = await request(app).get("/api/__probe/onboarding");
    expect(res.status).toBe(200);
    expect(res.body.mounted).toBe(true);
  });
});
