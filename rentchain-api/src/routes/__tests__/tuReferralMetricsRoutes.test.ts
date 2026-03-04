import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function buildQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) =>
        buildQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const col = ensureCollection(name);
        let rows = Array.from(col.values());
        rows = rows.filter((entry) =>
          filters.every((f) => {
            const value = entry.data?.[f.field];
            if (f.op === "==") return value === f.value;
            if (f.op === ">=") return Number(value || 0) >= Number(f.value);
            if (f.op === "<") return Number(value || 0) < Number(f.value);
            return true;
          })
        );
        return {
          empty: rows.length === 0,
          docs: rows.map((row) => ({ id: row.id, data: () => row.data })),
        };
      },
    };
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => buildQuery(name, [{ field, op, value }]),
      }),
    },
    resetDb: () => collections.clear(),
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
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

describe("GET /api/admin/metrics/tu-referrals", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("returns initiated/completed metrics for a given month", async () => {
    seedDoc("screeningReferrals", "r1", {
      provider: "transunion_referral",
      landlordIdHash: "hash-1",
      createdAtMs: Date.UTC(2026, 2, 2),
      status: "initiated",
      completedAtMs: null,
    });
    seedDoc("screeningReferrals", "r2", {
      provider: "transunion_referral",
      landlordIdHash: "hash-2",
      createdAtMs: Date.UTC(2026, 2, 3),
      status: "completed",
      completedAtMs: Date.UTC(2026, 2, 4),
    });
    seedDoc("screeningReferrals", "r3", {
      provider: "transunion_referral",
      landlordIdHash: "hash-2",
      createdAtMs: Date.UTC(2026, 1, 25),
      status: "completed",
      completedAtMs: Date.UTC(2026, 1, 26),
    });

    const app = await createApp();
    const res = await request(app).get("/api/admin/metrics/tu-referrals?month=2026-03");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.metrics?.referralClicks).toBe(2);
    expect(res.body?.metrics?.completedScreenings).toBe(1);
    expect(res.body?.metrics?.activeLandlords).toBe(2);
    expect(res.body?.metrics?.screeningsPerLandlord).toBe(0.5);
  });
});

