import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignmentRecordId } from "../../lib/assignment/loadAssignmentRecord";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        doc: (id?: string) => ({
          id,
          async get() {
            return {
              id,
              exists: ensureCollection(name).has(String(id)),
              data: () => ensureCollection(name).get(String(id)),
            };
          },
        }),
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

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) {
    collections.set(collectionName, new Map<string, any>());
  }
  collections.get(collectionName)!.set(id, { id, ...data });
}

describe("supportConsoleRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("returns application support data with reconciliation", async () => {
    seedDoc("rentalApplications", "app-1", {
      applicantName: "Jamie Applicant",
      screeningMonetization: {
        quoteStatus: "generated",
        quoteGeneratedAt: "2026-04-10T09:00:00.000Z",
      },
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "application.created",
      domain: "application",
      action: "created",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-10T09:00:00.000Z",
      recordedAt: "2026-04-10T09:00:00.000Z",
      visibility: "internal",
      summary: "Application created",
    });
    seedDoc("adminAssignments", assignmentRecordId("application", "app-1"), {
      version: "v1",
      resource: { type: "application", id: "app-1" },
      currentOwner: { ownerId: "admin-1", ownerLabel: "Morgan Ops" },
      createdAt: "2026-04-10T09:05:00.000Z",
      updatedAt: "2026-04-10T09:15:00.000Z",
      history: [],
    });

    const router = (await import("../supportConsoleRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/support-console/resource?resourceType=application&resourceId=app-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        resource: expect.objectContaining({
          type: "application",
          id: "app-1",
        }),
        timeline: expect.any(Array),
        insight: expect.anything(),
        reconciliation: expect.anything(),
        sla: null,
        assignment: expect.objectContaining({
          currentOwner: expect.objectContaining({
            ownerId: "admin-1",
            ownerLabel: "Morgan Ops",
          }),
        }),
        debug: expect.objectContaining({
          canonicalEventCount: 1,
        }),
      })
    );
  });

  it("returns maintenance data without reconciliation", async () => {
    seedDoc("maintenanceRequests", "maint-1", {
      title: "Broken heater",
      status: "submitted",
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "maintenance.request_created",
      domain: "maintenance",
      action: "request_created",
      actor: { type: "tenant", role: "tenant", id: "tenant-1" },
      resource: { type: "maintenance_request", id: "maint-1" },
      occurredAt: "2026-04-11T09:00:00.000Z",
      recordedAt: "2026-04-11T09:00:00.000Z",
      visibility: "landlord",
      summary: "Maintenance request submitted",
    });

    const router = (await import("../supportConsoleRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/support-console/resource?resourceType=maintenance&resourceId=maint-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.resource?.title).toBe("Broken heater");
    expect(response.body?.reconciliation).toBeNull();
  });

  it("extracts policy and automation histories", async () => {
    seedDoc("leases", "lease-1", {
      tenantName: "Taylor Tenant",
      status: "draft",
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "policy.evaluated",
      domain: "policy",
      action: "evaluated",
      status: "allow",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "lease", id: "lease-1" },
      occurredAt: "2026-04-12T09:00:00.000Z",
      recordedAt: "2026-04-12T09:00:00.000Z",
      visibility: "internal",
      summary: "Policy evaluated for lease_notice.send_notice",
      metadata: {
        domain: "lease_notice",
        action: "send_notice",
        outcome: "allow",
        topReasonCode: "LEASE_NOTICE_READY",
      },
    });
    seedDoc("canonicalEvents", "event-2", {
      version: "v1",
      type: "automation.executed",
      domain: "system",
      action: "executed",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "lease", id: "lease-1" },
      occurredAt: "2026-04-12T09:01:00.000Z",
      recordedAt: "2026-04-12T09:01:00.000Z",
      visibility: "internal",
      summary: "Automation executed for lease.auto_send_notice",
      metadata: {
        action: "lease.auto_send_notice",
        executed: true,
        skipped: false,
      },
    });

    const router = (await import("../supportConsoleRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/support-console/resource?resourceType=lease&resourceId=lease-1",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body?.policyDecisions).toEqual([
      expect.objectContaining({
        action: "send_notice",
        outcome: "allow",
        reasonCodes: ["LEASE_NOTICE_READY"],
      }),
    ]);
    expect(response.body?.automation).toEqual([
      expect.objectContaining({
        action: "lease.auto_send_notice",
        executed: true,
      }),
    ]);
  });

  it("returns a stable response for a missing resource", async () => {
    const router = (await import("../supportConsoleRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/support-console/resource?resourceType=lease&resourceId=missing",
      user: { id: "admin-1", role: "admin" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        resource: expect.objectContaining({
          id: "missing",
        }),
        timeline: [],
        policyDecisions: [],
        automation: [],
        sla: null,
        assignment: null,
      })
    );
  });

  it("enforces admin-only access and safe validation errors", async () => {
    const router = (await import("../supportConsoleRoutes")).default;
    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/support-console/resource?resourceType=application&resourceId=app-1",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body?.error).toBe("FORBIDDEN");

    const invalid = await invokeRouter(router, {
      method: "GET",
      url: "/support-console/resource?resourceType=unknown&resourceId=res-1",
      user: { id: "admin-1", role: "admin" },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body?.error).toBe("RESOURCE_TYPE_UNSUPPORTED");
  });
});
