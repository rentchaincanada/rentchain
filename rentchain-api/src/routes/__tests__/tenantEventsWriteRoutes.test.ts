import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantDocs = new Map<string, any>();
const createdEvents: any[] = [];
let tenantEventQueryDocs: any[] = [];
let tenantEventQueryError: Error | null = null;

vi.mock("../../firebase", () => ({
  Timestamp: {
    fromMillis: (value: number) => ({ toMillis: () => value }),
    fromDate: (value: Date) => ({ toMillis: () => value.getTime() }),
  },
  db: {
    collection: (name: string) => {
      if (name === "tenants") {
        return {
          doc: (id: string) => ({
            get: async () => ({
              exists: tenantDocs.has(id),
              data: () => tenantDocs.get(id),
            }),
          }),
        };
      }
      if (name === "tenantEvents") {
        return {
          add: async (payload: any) => {
            createdEvents.push(payload);
            return { id: `event-${createdEvents.length}` };
          },
          where: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  get: async () => {
                    if (tenantEventQueryError) throw tenantEventQueryError;
                    return { docs: tenantEventQueryDocs };
                  },
                }),
              }),
            }),
          }),
        };
      }
      if (name === "tenantSummaries") {
        return {
          doc: () => ({
            set: async () => undefined,
          }),
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  },
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (_req: any, _res: any, next: any) => next(),
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
}) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [, queryString = ""] = options.url.split("?");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: {},
      query: Object.fromEntries(new URLSearchParams(queryString).entries()),
      params: {},
    };
    const res: any = {
      statusCode: 200,
      setHeader: () => undefined,
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

describe("tenantEventsWriteRoutes", () => {
  beforeEach(() => {
    tenantDocs.clear();
    createdEvents.length = 0;
    tenantEventQueryDocs = [];
    tenantEventQueryError = null;
    tenantDocs.set("tenant-1", {
      landlordId: "landlord-1",
      fullName: "Taylor Tenant",
    });
  });

  it("accepts NOTE_ADDED as an audited tenant event", async () => {
    const router = (await import("../tenantEventsWriteRoutes")).default;
    const result = await invokeRouter(router, {
      method: "POST",
      url: "/tenant-events",
      body: {
        tenantId: "tenant-1",
        type: "NOTE_ADDED",
        description: "Called tenant to confirm contact details.",
      },
    });

    expect(result.status).toBe(200);
    expect(result.body?.ok).toBe(true);
    expect(createdEvents[0]?.type).toBe("NOTE_ADDED");
    expect(createdEvents[0]?.severity).toBe("neutral");
    expect(createdEvents[0]?.title).toBe("Note added");
  });

  it("keeps tenant payment activity separate from ledger and payments writes", async () => {
    const router = (await import("../tenantEventsWriteRoutes")).default;
    const result = await invokeRouter(router, {
      method: "POST",
      url: "/tenant-events",
      body: {
        tenantId: "tenant-1",
        type: "RENT_PAID",
        amountCents: 185000,
        currency: "CAD",
        purpose: "RENT",
        description: "Timeline note only.",
      },
    });

    expect(result.status).toBe(200);
    expect(result.body?.ok).toBe(true);
    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        type: "RENT_PAID",
        title: "Rent paid",
        amountCents: 185000,
        currency: "CAD",
      })
    );
  });

  it("returns an empty page for an authorized tenant with no event history", async () => {
    const router = (await import("../tenantEventsWriteRoutes")).default;
    const result = await invokeRouter(router, {
      method: "GET",
      url: "/tenant-events?tenantId=tenant-1&limit=25",
    });

    expect(result).toEqual({
      status: 200,
      body: { ok: true, items: [], nextCursor: null },
    });
  });

  it("returns populated tenant event history", async () => {
    const createdAt = { toMillis: () => 1_725_000_000_000 };
    tenantEventQueryDocs = [
      {
        id: "event-1",
        data: () => ({ tenantId: "tenant-1", type: "NOTE_ADDED", createdAt }),
      },
    ];
    const router = (await import("../tenantEventsWriteRoutes")).default;
    const result = await invokeRouter(router, {
      method: "GET",
      url: "/tenant-events?tenantId=tenant-1&limit=25",
    });

    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([
      { id: "event-1", tenantId: "tenant-1", type: "NOTE_ADDED", createdAt },
    ]);
    expect(result.body.nextCursor).toBe(1_725_000_000_000);
  });

  it("returns a bounded error when the tenant event query fails", async () => {
    tenantEventQueryError = new Error("FAILED_PRECONDITION: query requires an index");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = (await import("../tenantEventsWriteRoutes")).default;
    const result = await invokeRouter(router, {
      method: "GET",
      url: "/tenant-events?tenantId=tenant-1&limit=25",
    });

    expect(result).toEqual({
      status: 500,
      body: { error: "Failed to load tenant events" },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[tenant-events GET /tenant-events] error",
      tenantEventQueryError
    );
    errorSpy.mockRestore();
  });
});
