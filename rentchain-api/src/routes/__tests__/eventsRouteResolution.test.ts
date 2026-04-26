import express from "express";
import { describe, expect, it, vi } from "vitest";
import { routeSource } from "../../middleware/routeSource";

const { dbMock, resetDb } = vi.hoisted(() => {
  const collections = new Map<string, any[]>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, []);
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        add: async (payload: any) => {
          ensureCollection(name).push(payload);
          return { id: `auto_${ensureCollection(name).length}` };
        },
        doc: () => ({
          get: async () => ({ exists: false, data: () => null }),
        }),
      }),
    },
    resetDb: () => collections.clear(),
  };
});

const screeningJobMocks = vi.hoisted(() => ({
  claimNextJob: vi.fn(async () => ({ ok: true, job: null })),
  enqueueScreeningJob: vi.fn(async () => ({ ok: true })),
  runJob: vi.fn(async () => ({ ok: true })),
}));

const telemetryMocks = vi.hoisted(() => ({
  incrementCounter: vi.fn(async () => undefined),
}));

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../services/telemetryService", () => ({
  incrementCounter: telemetryMocks.incrementCounter,
}));

vi.mock("../../services/screeningJobs", () => ({
  claimNextJob: screeningJobMocks.claimNextJob,
  enqueueScreeningJob: screeningJobMocks.enqueueScreeningJob,
  runJob: screeningJobMocks.runJob,
}));

async function invokeApp(
  app: any,
  options: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }
) {
  return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url.split("?")[0],
      query: {},
      body: options.body ?? {},
      headers: Object.fromEntries(
        Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
      ),
      get(name: string) {
        return this.headers[String(name || "").toLowerCase()];
      },
      header(name: string) {
        return this.headers[String(name || "").toLowerCase()];
      },
      cookies: {},
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, any>,
      setHeader(name: string, value: any) {
        this.headers[String(name).toLowerCase()] = value;
      },
      cookie(name: string, value: string) {
        req.cookies[name] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
      redirect(code: number, location: string) {
        this.statusCode = code;
        this.headers.location = location;
        resolve({ status: this.statusCode, body: null, headers: this.headers });
      },
    };
    const [pathOnly, rawQuery] = options.url.split("?");
    req.path = pathOnly;
    if (rawQuery) {
      req.query = Object.fromEntries(new URLSearchParams(rawQuery).entries());
    }
    app.handle(req, res, (error: any) => {
      if (error) reject(error);
      else reject(new Error(`Unhandled request: ${options.method} ${options.url}`));
    });
  });
}

describe("events route resolution", () => {
  it("resolves /api/events/track through eventsRoutes before broad /api mounts", async () => {
    resetDb();
    telemetryMocks.incrementCounter.mockReset();

    const eventsRoutes = (await import("../eventsRoutes")).default;
    const screeningJobsAdminRoutes = (await import("../screeningJobsAdminRoutes")).default;

    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      const auth = String(req.headers?.authorization || "");
      if (auth.startsWith("Bearer ")) {
        req.user = { id: "admin-1", role: "admin", landlordId: "admin-1" };
      }
      next();
    });
    app.use("/api/events", routeSource("eventsRoutes.ts"), eventsRoutes);
    app.use("/api", routeSource("screeningJobsAdminRoutes.ts"), screeningJobsAdminRoutes);

    const trackRes = await invokeApp(app, {
      method: "POST",
      url: "/api/events/track",
      body: {
        name: "billing_page_opened",
        props: { surface: "billing_page" },
      },
    });

    expect(trackRes.status).toBe(200);
    expect(trackRes.body).toEqual({ ok: true });
    expect(trackRes.headers["x-route-source"]).toBe("eventsRoutes.ts");
    expect(trackRes.headers["x-route-source"]).not.toBe("screeningJobsAdminRoutes.ts");
    expect(telemetryMocks.incrementCounter).toHaveBeenCalledWith({ name: "billing_page_opened" });

    const screeningRes = await invokeApp(app, {
      method: "POST",
      url: "/api/admin/screening-jobs/run",
      headers: { Authorization: "Bearer test-token" },
    });

    expect(screeningRes.status).toBe(200);
    expect(screeningRes.headers["x-route-source"]).toBe("screeningJobsAdminRoutes.ts");
  });
});
