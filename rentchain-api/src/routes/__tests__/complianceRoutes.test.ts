import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

async function makeApp(authMode: "allow" | "deny") {
  vi.resetModules();
  vi.doMock("../../middleware/requireAuth", () => ({
    requireAuth: (req: any, res: any, next: any) => {
      if (authMode === "deny") {
        return res.status(401).json({ ok: false, error: "unauthenticated" });
      }
      req.user = { id: "user-1", role: "landlord", landlordId: "landlord-1" };
      return next();
    },
  }));

  const router = (await import("../complianceRoutes")).default;
  const app = express();
  app.use("/api/compliance", router);
  return app;
}

describe("compliance routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated callers", async () => {
    const app = await makeApp("deny");
    const res = await request(app).get("/api/compliance/rules?province=ON");
    expect(res.status).toBe(401);
    expect(res.body?.ok).toBe(false);
  });

  it("returns Ontario compliance rules for authenticated callers", async () => {
    const app = await makeApp("allow");
    const res = await request(app).get("/api/compliance/rules?province=ON");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      province: "ON",
      complianceVersion: "v1",
      rules: expect.any(Object),
    });
  });

  it("accepts lowercase province input", async () => {
    const app = await makeApp("allow");
    const res = await request(app).get("/api/compliance/rules?province=on");
    expect(res.status).toBe(200);
    expect(res.body?.province).toBe("ON");
  });

  it("accepts full province name input", async () => {
    const app = await makeApp("allow");
    const res = await request(app).get("/api/compliance/rules?province=Ontario");
    expect(res.status).toBe(200);
    expect(res.body?.province).toBe("ON");
  });

  it("returns 400 when province is missing", async () => {
    const app = await makeApp("allow");
    const res = await request(app).get("/api/compliance/rules");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "province_required" });
  });

  it("returns 400 when province is invalid", async () => {
    const app = await makeApp("allow");
    const res = await request(app).get("/api/compliance/rules?province=XX");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "province_invalid" });
  });

  it("accepts Nova Scotia name input", async () => {
    const app = await makeApp("allow");
    const res = await request(app).get("/api/compliance/rules?province=Nova%20Scotia");
    expect(res.status).toBe(200);
    expect(res.body?.province).toBe("NS");
  });
});
