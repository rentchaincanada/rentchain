import express from "express";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

let allowExports = true;

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () =>
    allowExports
      ? { ok: true, plan: "pro" }
      : { ok: false, plan: "starter", error: "forbidden" }
  ),
}));

vi.mock("../../services/screening/reportExportService", () => ({
  getReportExport: vi.fn(async (exportId: string) => {
    if (exportId === "missing") return null;
    return {
      exportId,
      status: "ready",
      expiresAt: Date.now() + 60_000,
      tokenHash: "test",
    };
  }),
  validateToken: vi.fn((exportDoc: any, token: string) => token === "valid"),
  getExportPdfBuffer: vi.fn(async () => Buffer.from("pdf-bytes")),
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const role = String(req.headers["x-test-role"] || "landlord").toLowerCase();
    req.user = { role, landlordId: "landlord-1", id: "landlord-1" };
    next();
  },
}));

describe("GET /screening/report", () => {
  beforeEach(() => {
    allowExports = true;
  });

  const buildApp = async () => {
    const router = (await import("../screeningReportRoutes")).default;
    const app = express();
    app.use(router);
    return app;
  };

  it("returns 400 when exportId/token missing", async () => {
    const app = await buildApp();
    const res = await request(app).get("/screening/report");
    expect(res.status).toBe(400);
  });

  it("returns 404 when exportId not found", async () => {
    const app = await buildApp();
    const res = await request(app).get("/screening/report?exportId=missing&token=valid");
    expect(res.status).toBe(404);
  });

  it("returns 404 when token invalid", async () => {
    const app = await buildApp();
    const res = await request(app).get("/screening/report?exportId=exp_1&token=bad");
    expect(res.status).toBe(404);
  });

  it("returns 402 when exports_basic missing", async () => {
    allowExports = false;
    const app = await buildApp();
    const res = await request(app).get("/screening/report?exportId=exp_1&token=valid");
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("upgrade_required");
    expect(res.body.capability).toBe("exports_basic");
  });

  it("returns 200 with pdf for pro/admin", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/screening/report?exportId=exp_1&token=valid")
      .set("x-test-role", "admin");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });
});
