import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMetricsMock,
  renderTextMock,
  renderEmailMock,
  renderCsvMock,
  renderJsonMock,
  sendEmailMock,
  uploadBufferToGcsMock,
  recomputeLeaseRiskMock,
  recomputeTenantScoreMock,
} = vi.hoisted(() => ({
  getMetricsMock: vi.fn(async () => ({
    ok: true,
    month: "2026-03",
    metrics: {
      referralClicks: 2,
      completedScreenings: 1,
      activeLandlords: 1,
      screeningsPerLandlord: 1,
      conversionRate: 0.5,
    },
    dailyInitiated: [{ day: "2026-03-01", count: 2 }],
    dailyCompleted: [{ day: "2026-03-01", count: 1 }],
  })),
  renderTextMock: vi.fn(() => "summary"),
  renderEmailMock: vi.fn(() => ({
    subject: "[RentChain] TransUnion Referral Metrics — 2026-03",
    body: "email-body",
  })),
  renderCsvMock: vi.fn(() => "csv"),
  renderJsonMock: vi.fn(() => "{}"),
  sendEmailMock: vi.fn(async () => undefined),
  uploadBufferToGcsMock: vi.fn(async ({ path }: any) => ({ bucket: "b", path })),
  recomputeLeaseRiskMock: vi.fn(async (leaseId: string) => ({
    leaseId,
    updated: true,
    skipped: false,
    previousRiskScore: 62,
    nextRiskScore: 79,
    previousRiskGrade: "C",
    nextRiskGrade: "B",
  })),
  recomputeTenantScoreMock: vi.fn(async (tenantId: string) => ({
    tenantId,
    updated: true,
    skipped: false,
    previousScore: 66,
    nextScore: 82,
    previousGrade: "C",
    nextGrade: "B",
  })),
}));

vi.mock("../../services/metrics/tuReferralReport", () => ({
  getTuReferralMetricsForMonth: getMetricsMock,
  renderTuReferralReportText: renderTextMock,
  renderTuReferralEmail: renderEmailMock,
  renderTuReferralCsv: renderCsvMock,
  renderTuReferralJson: renderJsonMock,
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("../../services/statusHealthSync", () => ({
  runStatusHealthSync: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: uploadBufferToGcsMock,
}));

vi.mock("../../services/risk/recomputeLeaseRisk", () => ({
  recomputeLeaseRisk: recomputeLeaseRiskMock,
}));

vi.mock("../../services/risk/recomputeTenantScore", () => ({
  recomputeTenantScore: recomputeTenantScoreMock,
}));

async function createApp() {
  const router = (await import("../internalReportsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/internal", router);
  return app;
}

describe("internalReportsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_JOB_TOKEN = "secret-token";
    process.env.TU_REPORT_RECIPIENTS = "";
    delete process.env.GCS_UPLOAD_BUCKET;
  });

  it("rejects missing token", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/internal/reports/tu-referrals").send({});
    expect(res.status).toBe(401);
    expect(res.body?.ok).toBe(false);
  });

  it("rejects invalid token", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/internal/reports/tu-referrals")
      .set("X-Internal-Job-Token", "wrong")
      .send({});
    expect(res.status).toBe(401);
  });

  it("rejects lease recompute without a token", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/internal/leases/lease-1/recompute-risk").send({});
    expect(res.status).toBe(401);
  });

  it("recomputes lease risk through the protected internal route", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/internal/leases/lease-1/recompute-risk")
      .set("X-Internal-Job-Token", "secret-token")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.leaseId).toBe("lease-1");
    expect(res.body?.nextRiskScore).toBe(79);
    expect(recomputeLeaseRiskMock).toHaveBeenCalledWith("lease-1");
  });

  it("rejects tenant score recompute without a token", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/internal/tenants/tenant-1/recompute-score").send({});
    expect(res.status).toBe(401);
  });

  it("recomputes tenant score through the protected internal route", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/internal/tenants/tenant-1/recompute-score")
      .set("X-Internal-Job-Token", "secret-token")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.tenantId).toBe("tenant-1");
    expect(res.body?.nextScore).toBe(82);
    expect(recomputeTenantScoreMock).toHaveBeenCalledWith("tenant-1");
  });

  it("returns ok for valid token", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/internal/reports/tu-referrals")
      .set("X-Internal-Job-Token", "secret-token")
      .send({ month: "2026-03", cadence: "monthly" });
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.month).toBe("2026-03");
    expect(getMetricsMock).toHaveBeenCalledWith("2026-03");
  });

  it("uses rendered email template when recipients are configured", async () => {
    process.env.TU_REPORT_RECIPIENTS = "ops@example.com";
    process.env.EMAIL_FROM = "no-reply@example.com";
    const app = await createApp();
    const res = await request(app)
      .post("/api/internal/reports/tu-referrals")
      .set("X-Internal-Job-Token", "secret-token")
      .send({ month: "2026-03", cadence: "monthly" });

    expect(res.status).toBe(200);
    expect(renderEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "[RentChain] TransUnion Referral Metrics — 2026-03",
        text: "email-body",
      })
    );
  });
});
