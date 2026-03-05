import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMetricsMock,
  renderTextMock,
  renderCsvMock,
  renderJsonMock,
  sendEmailMock,
  uploadBufferToGcsMock,
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
  renderCsvMock: vi.fn(() => "csv"),
  renderJsonMock: vi.fn(() => "{}"),
  sendEmailMock: vi.fn(async () => undefined),
  uploadBufferToGcsMock: vi.fn(async ({ path }: any) => ({ bucket: "b", path })),
}));

vi.mock("../../services/metrics/tuReferralReport", () => ({
  getTuReferralMetricsForMonth: getMetricsMock,
  renderTuReferralReportText: renderTextMock,
  renderTuReferralCsv: renderCsvMock,
  renderTuReferralJson: renderJsonMock,
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: uploadBufferToGcsMock,
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
});

