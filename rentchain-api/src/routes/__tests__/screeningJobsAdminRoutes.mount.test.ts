import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const { claimNextJobMock, runJobMock } = vi.hoisted(() => ({
  claimNextJobMock: vi.fn(async () => ({ ok: true, job: null })),
  runJobMock: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/screeningJobs", () => ({
  claimNextJob: claimNextJobMock,
  runJob: runJobMock,
  enqueueScreeningJob: vi.fn(async () => ({ ok: true })),
}));

describe("screeningJobsAdminRoutes mount path", () => {
  it("responds on /api/admin/screening-jobs/run for admin auth (not 404)", async () => {
    const router = (await import("../screeningJobsAdminRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: "admin_1", role: "admin", landlordId: "admin_1" };
      next();
    });
    app.use("/api", router);

    const res = await request(app).post("/api/admin/screening-jobs/run");
    expect(res.status).not.toBe(404);
    expect([200, 403]).toContain(res.status);
  });
});

