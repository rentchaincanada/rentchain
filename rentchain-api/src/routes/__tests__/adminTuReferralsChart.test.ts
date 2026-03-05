import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMetricsMock } = vi.hoisted(() => ({
  getMetricsMock: vi.fn(async () => ({
    ok: true,
    month: "2026-03",
    metrics: {
      referralClicks: 5,
      completedScreenings: 3,
      activeLandlords: 2,
      screeningsPerLandlord: 1.5,
      conversionRate: 0.6,
    },
    dailyInitiated: [
      { day: "2026-03-01", count: 2 },
      { day: "2026-03-03", count: 3 },
    ],
    dailyCompleted: [
      { day: "2026-03-02", count: 1 },
      { day: "2026-03-03", count: 2 },
    ],
  })),
}));

vi.mock("../../services/metrics/tuReferralReport", () => ({
  getTuReferralMetricsForMonth: getMetricsMock,
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      where: () => ({
        where: () => ({
          get: async () => ({ empty: true, docs: [] }),
        }),
        get: async () => ({ empty: true, docs: [] }),
      }),
      get: async () => ({ empty: true, docs: [] }),
    }),
  },
}));

vi.mock("../../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/telemetryService", () => ({
  getCountersSummary: vi.fn(async () => ({ byName: {} })),
}));

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => false,
  getStripeClient: () => {
    throw new Error("not configured");
  },
}));

vi.mock("firebase-admin", () => ({
  default: {
    auth: () => ({
      createUser: vi.fn(),
    }),
    firestore: {
      FieldValue: {
        serverTimestamp: () => Date.now(),
      },
    },
  },
}));

async function createApp() {
  const router = (await import("../adminRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/admin", router);
  return app;
}

describe("GET /api/admin/metrics/tu-referrals/chart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns chart-ready daily series aligned to initiated/completed maps", async () => {
    const app = await createApp();
    const res = await request(app).get("/api/admin/metrics/tu-referrals/chart?month=2026-03");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.month).toBe("2026-03");
    expect(res.body?.totals?.referralClicks).toBe(5);
    expect(res.body?.series).toEqual([
      { day: "2026-03-01", initiated: 2, completed: 0 },
      { day: "2026-03-02", initiated: 0, completed: 1 },
      { day: "2026-03-03", initiated: 3, completed: 2 },
    ]);
  });
});
