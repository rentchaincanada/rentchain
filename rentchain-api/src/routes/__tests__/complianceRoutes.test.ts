import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "user-1", role: "landlord", landlordId: "landlord-1" };
    next();
  },
}));

describe("compliance routes", () => {
  it("returns Ontario compliance rules for authenticated callers", async () => {
    const router = (await import("../complianceRoutes")).default;
    const app = express();
    app.use("/api/compliance", router);

    const res = await request(app).get("/api/compliance/rules?province=ON");
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.province).toBe("ON");
    expect(res.body?.complianceVersion).toBe("v1");
    expect(res.body?.rules?.rentIncrease?.noticeDays).toBeGreaterThan(0);
  });

  it("returns 400 when province is missing", async () => {
    const router = (await import("../complianceRoutes")).default;
    const app = express();
    app.use("/api/compliance", router);

    const res = await request(app).get("/api/compliance/rules");
    expect(res.status).toBe(400);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.error).toBe("province_required");
  });
});
