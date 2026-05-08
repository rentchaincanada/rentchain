import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  let autoId = 0;
  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }
  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        add: async (payload: any) => {
          const id = `auto_${++autoId}`;
          ensureCollection(name).set(id, payload);
          return { id };
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
    if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    return next();
  },
}));

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      user: options.user || null,
      body: options.body || {},
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

describe("telemetryRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("accepts PDF export telemetry and redacts sensitive keys", async () => {
    const router = (await import("../telemetryRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/telemetry",
      user: { id: "user-1", role: "landlord", landlordId: "landlord-1" },
      body: {
        eventName: "pdf_export_completed",
        eventProps: {
          exportType: "lease_summary",
          renderingPath: "frontend_pdf_builder",
          durationMs: 22,
          tenantName: "Private Tenant",
          documentText: "not a reserved key but should be short metadata only",
        },
      },
    });

    expect(res.status).toBe(200);
    const stored = Array.from(collections.get("telemetry_events")?.values() || []);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      userId: "user-1",
      landlordId: "landlord-1",
      role: "landlord",
      eventName: "pdf_export_completed",
    });
    expect(stored[0].eventProps.tenantName).toBeUndefined();
    expect(stored[0].eventProps.documentText).toBeUndefined();
    expect(stored[0].governance).toMatchObject({
      sensitivity: "confidential",
      retentionCategory: "export_metadata",
      metadataOnly: true,
      redactionApplied: true,
    });
  });

  it("continues rejecting unrelated telemetry event families", async () => {
    const router = (await import("../telemetryRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/telemetry",
      user: { id: "user-1", role: "landlord" },
      body: { eventName: "tenant_profile_opened", eventProps: {} },
    });

    expect(res.status).toBe(400);
  });
});
