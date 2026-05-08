import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }
  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    if (req.user?.role !== "admin") return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    return next();
  },
}));

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      user: options.user || null,
      query: {},
      params: {},
    };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

function seedTelemetry(id: string, data: any) {
  if (!collections.has("telemetry_events")) collections.set("telemetry_events", new Map<string, any>());
  collections.get("telemetry_events")!.set(id, data);
}

describe("adminPdfExportObservabilityRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("returns admin-scoped PDF diagnostics with whitelisted metadata", async () => {
    seedTelemetry("telemetry-1", {
      eventName: "pdf_export_completed",
      createdAt: Date.parse("2026-05-08T10:00:00.000Z"),
      eventProps: {
        exportType: "screening_report",
        renderingPath: "backend_pdfkit",
        status: "completed",
        byteSize: 4096,
        tenantName: "Sensitive Tenant",
      },
    });
    seedTelemetry("telemetry-2", {
      eventName: "nudge_clicked",
      createdAt: Date.parse("2026-05-08T10:01:00.000Z"),
      eventProps: {},
    });

    const router = (await import("../adminPdfExportObservabilityRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/pdf-export-observability",
      user: { id: "admin-1", role: "admin" },
    });

    expect(res.status).toBe(200);
    expect(res.body.summary.totalEvents).toBe(1);
    expect(res.body.summary.completed).toBe(1);
    expect(res.body.sensitiveContentLogged).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain("Sensitive Tenant");
  });

  it("blocks non-admin diagnostics access", async () => {
    const router = (await import("../adminPdfExportObservabilityRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/pdf-export-observability",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(res.status).toBe(403);
  });
});
