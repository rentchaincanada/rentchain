import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedEvent } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        add: async (payload: any) => {
          const id = `auto_${++autoId}`;
          ensureCollection(name).set(id, { id, data: payload });
          return { id };
        },
        get: async () => {
          const docs = Array.from(ensureCollection(name).values()).map((entry) => ({
            id: entry.id,
            data: () => entry.data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
    resetDb: () => {
      collections.clear();
      autoId = 0;
    },
    seedEvent: (id: string, data: any) => {
      ensureCollection("events").set(id, { id, data });
    },
  };
});

const telemetryMocks = vi.hoisted(() => ({
  incrementCounter: vi.fn(async () => undefined),
}));

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../services/telemetryService", () => ({
  incrementCounter: telemetryMocks.incrementCounter,
}));

async function createApp(user?: Record<string, unknown>) {
  const router = (await import("../eventsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req: any, _res: any, next: any) => {
    req.user = user || null;
    next();
  });
  app.use("/api/events", router);
  return app;
}

describe("eventsRoutes", () => {
  beforeEach(() => {
    resetDb();
    telemetryMocks.incrementCounter.mockReset();
  });

  it("accepts registry pricing-funnel events through the lightweight tracker", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/events/track")
      .send({
        name: "registry_ready_created",
        props: {
          propertyId: "prop-1",
          source: "google",
          medium: "cpc",
          campaign: "halifax-ready",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(telemetryMocks.incrementCounter).toHaveBeenCalledWith({ name: "registry_ready_created" });
  });

  it("returns a grouped registry funnel report for admins", async () => {
    seedEvent("event-1", {
      name: "registry_landing_cta_clicked",
      ts: Date.parse("2026-04-01T10:00:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
      },
    });
    seedEvent("event-2", {
      name: "registry_ready_created",
      ts: Date.parse("2026-04-01T11:00:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
      },
    });
    seedEvent("event-3", {
      name: "registry_upgrade_prompt_viewed",
      ts: Date.parse("2026-04-01T12:00:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        variant: "B",
      },
    });
    seedEvent("event-4", {
      name: "registry_upgrade_clicked",
      ts: Date.parse("2026-04-01T12:05:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        variant: "B",
      },
    });
    seedEvent("event-5", {
      name: "registry_upgrade_converted",
      ts: Date.parse("2026-04-02T08:00:00.000Z"),
      props: {
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        variant: "B",
      },
    });

    const app = await createApp({ id: "admin-1", role: "admin" });
    const res = await request(app)
      .get("/api/events/registry-funnel-report?from=2026-04-01T00:00:00.000Z&to=2026-04-03T00:00:00.000Z")
      .send();

    expect(res.status).toBe(200);
    expect(res.body?.totals).toEqual({
      landingEntries: 1,
      readinessCreated: 1,
      filingGateHits: 0,
      upgradePromptViews: 1,
      upgradeClicks: 1,
      upgradeConversions: 1,
    });
    expect(res.body?.bySource).toEqual([
      expect.objectContaining({
        source: "google",
        medium: "cpc",
        campaign: "halifax-ready",
        counts: expect.objectContaining({
          landingEntries: 1,
          readinessCreated: 1,
          upgradePromptViews: 1,
          upgradeClicks: 1,
          upgradeConversions: 1,
        }),
      }),
    ]);
    expect(res.body?.byVariant).toEqual([
      expect.objectContaining({
        variant: "B",
        promptViews: 1,
        clicks: 1,
        conversions: 1,
        clickThroughRate: 1,
        conversionRateFromClick: 1,
      }),
    ]);
    expect(res.body?.byDate).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-04-01",
          counts: expect.objectContaining({
            landingEntries: 1,
            readinessCreated: 1,
            upgradePromptViews: 1,
            upgradeClicks: 1,
          }),
        }),
      ])
    );
  });

  it("blocks the funnel report for non-admin users", async () => {
    const app = await createApp({ id: "landlord-1", role: "landlord" });
    const res = await request(app).get("/api/events/registry-funnel-report").send();
    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("forbidden");
  });
});
