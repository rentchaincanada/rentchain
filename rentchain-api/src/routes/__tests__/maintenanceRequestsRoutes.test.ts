import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadBufferToGcsMock = vi.fn();
const getSignedDownloadUrlMock = vi.fn();

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) {
    collections.set(name, new Map<string, any>());
  }
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function applyMerge(current: any, incoming: any) {
  const next = { ...(current || {}) };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && (value as any).__op === "arrayUnion") {
      const existing = Array.isArray(next[key]) ? next[key] : [];
      next[key] = [...existing, ...(value as any).values.map((entry: any) => clone(entry))];
      return;
    }
    next[key] = clone(value);
  });
  return next;
}

const dbMock = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      id,
      get: async () => ({
        id,
        exists: ensureCollection(name).has(id),
        data: () => clone(ensureCollection(name).get(id)),
      }),
      set: async (value: any, opts?: { merge?: boolean }) => {
        const current = ensureCollection(name).get(id);
        ensureCollection(name).set(id, opts?.merge ? applyMerge(current, value) : clone(value));
      },
      update: async (value: any) => {
        const current = ensureCollection(name).get(id) || {};
        ensureCollection(name).set(id, applyMerge(current, value));
      },
    }),
  }),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
    arrayUnion: (...values: any[]) => ({ __op: "arrayUnion", values }),
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) {
      req.user = JSON.parse(header);
    }
    next();
  },
}));

vi.mock("../../auth/jwt", () => ({
  verifyAuthToken: vi.fn(),
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("multer", () => {
  const factory = Object.assign(
    () => ({
      single: () => (req: any, _res: any, next: any) => next(),
    }),
    {
      memoryStorage: () => ({}),
    }
  );
  return { default: factory };
});

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: uploadBufferToGcsMock,
}));

vi.mock("../../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: getSignedDownloadUrlMock,
}));

describe("maintenanceRequestsRoutes scheduling access", () => {
  async function invokeRouter(router: any, options: {
    method: string;
    url: string;
    body?: any;
    file?: any;
    headers?: Record<string, string>;
  }) {
    return await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req: any = {
        method: options.method,
        url: options.url,
        originalUrl: options.url,
        path: options.url,
        body: options.body ?? {},
        file: options.file,
        headers: options.headers ?? {},
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

  beforeEach(() => {
    vi.clearAllMocks();
    collections.clear();
    process.env.GCS_UPLOAD_BUCKET = "test-bucket";
    uploadBufferToGcsMock.mockResolvedValue(undefined);
    getSignedDownloadUrlMock.mockImplementation(async ({ path }: { path: string }) => `https://signed.example/${path}`);
    ensureCollection("maintenanceRequests").set("maint-1", {
      id: "maint-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      title: "Broken heater",
      description: "Heat is not turning on.",
      category: "HVAC",
      priority: "urgent",
      status: "assigned",
      assignedContractorId: "contractor-1",
      assignedContractorName: "North Shore HVAC",
      tenantConfirmationStatus: "confirmed",
      tenantConfirmationUpdatedAt: 150,
      accessAcknowledgedAt: 160,
      createdAt: 100,
      updatedAt: 200,
      statusHistory: [],
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
    });
  });

  it("persists service window and access coordination through the landlord patch route", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/landlord/maintenance/maint-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        serviceWindowStartAt: 500,
        serviceWindowEndAt: 900,
        accessRequired: true,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.status).toBe("scheduled");
    expect(res.body?.item?.serviceWindowStartAt).toBe(500);
    expect(res.body?.item?.serviceWindowEndAt).toBe(900);
    expect(res.body?.item?.accessRequired).toBe(true);

    const savedMaintenance = ensureCollection("maintenanceRequests").get("maint-1");
    expect(savedMaintenance?.status).toBe("scheduled");
    expect(savedMaintenance?.tenantConfirmationStatus).toBeNull();
    expect(savedMaintenance?.accessAcknowledgedAt).toBeNull();
    expect(savedMaintenance?.statusHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "scheduled" }),
        expect.objectContaining({ message: "Service window updated." }),
        expect.objectContaining({ message: "Access coordination marked as required." }),
        expect.objectContaining({ message: "Tenant confirmation was reset because the service window changed." }),
      ])
    );

    const savedWorkOrder = ensureCollection("workOrders").get("maintenance_maint-1");
    expect(savedWorkOrder?.serviceWindowStartAt).toBe(500);
    expect(savedWorkOrder?.accessRequired).toBe(true);
  });

  it("allows a contractor to schedule service with structured execution metadata", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;

    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/contractor/jobs/maint-1/status",
      headers: {
        "x-test-user": JSON.stringify({
          id: "contractor-1",
          role: "contractor",
        }),
      },
      body: {
        status: "scheduled",
        scheduledFor: 700,
        message: "Scheduled for tomorrow morning.",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.status).toBe("scheduled");
    expect(res.body?.item?.scheduledFor).toBe(700);

    const savedMaintenance = ensureCollection("maintenanceRequests").get("maint-1");
    expect(savedMaintenance?.status).toBe("scheduled");
    expect(savedMaintenance?.scheduledFor).toBe(700);

    const savedWorkOrder = ensureCollection("workOrders").get("maintenance_maint-1");
    expect(savedWorkOrder?.status).toBe("scheduled");
    expect(savedWorkOrder?.scheduledFor).toBe(700);
    expect(savedWorkOrder?.lastExecutionUpdateAt).toBeDefined();
  });

  it("rejects blocked contractor updates without a reason", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-1", {
      ...ensureCollection("maintenanceRequests").get("maint-1"),
      status: "scheduled",
    });

    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/contractor/jobs/maint-1/status",
      headers: {
        "x-test-user": JSON.stringify({
          id: "contractor-1",
          role: "contractor",
        }),
      },
      body: {
        status: "blocked",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("BLOCKED_REASON_REQUIRED");
  });

  it("rejects completed contractor updates without a completion summary", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-1", {
      ...ensureCollection("maintenanceRequests").get("maint-1"),
      status: "in_progress",
    });

    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/contractor/jobs/maint-1/status",
      headers: {
        "x-test-user": JSON.stringify({
          id: "contractor-1",
          role: "contractor",
        }),
      },
      body: {
        status: "completed",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("COMPLETION_SUMMARY_REQUIRED");
  });

  it("persists completion metadata when a contractor completes the job", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-1", {
      ...ensureCollection("maintenanceRequests").get("maint-1"),
      status: "in_progress",
    });

    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/contractor/jobs/maint-1/status",
      headers: {
        "x-test-user": JSON.stringify({
          id: "contractor-1",
          role: "contractor",
        }),
      },
      body: {
        status: "completed",
        completionSummary: "Replaced the thermostat and verified heat output.",
        completionOutcome: "completed",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.status).toBe("completed");
    expect(res.body?.item?.completionSummary).toMatch(/Replaced the thermostat/i);

    const savedMaintenance = ensureCollection("maintenanceRequests").get("maint-1");
    expect(savedMaintenance?.status).toBe("completed");
    expect(savedMaintenance?.completionSummary).toMatch(/Replaced the thermostat/i);

    const savedWorkOrder = ensureCollection("workOrders").get("maintenance_maint-1");
    expect(savedWorkOrder?.serviceCompletedAt).toBeDefined();
    expect(savedWorkOrder?.completionSummary).toMatch(/Replaced the thermostat/i);
    expect(savedWorkOrder?.completedByActorRole).toBe("contractor");
    expect(savedWorkOrder?.completedByActorId).toBe("contractor-1");
  });

  it("allows an assigned contractor to upload evidence for their job", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/contractor/jobs/maint-1/evidence",
      headers: {
        "x-test-user": JSON.stringify({
          id: "contractor-1",
          role: "contractor",
        }),
      },
      body: {
        evidenceType: "during",
        caption: "Valve replacement in progress",
      },
      file: {
        originalname: "during.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from("photo"),
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.item?.evidence?.[0]?.caption).toBe("Valve replacement in progress");

    const savedWorkOrder = ensureCollection("workOrders").get("maintenance_maint-1");
    expect(savedWorkOrder?.evidence?.[0]?.visibility).toBe("landlord_contractor");
  });

  it("rejects contractor evidence uploads for unassigned jobs", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-1", {
      ...ensureCollection("maintenanceRequests").get("maint-1"),
      assignedContractorId: "contractor-2",
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/contractor/jobs/maint-1/evidence",
      headers: {
        "x-test-user": JSON.stringify({
          id: "contractor-1",
          role: "contractor",
        }),
      },
      body: {
        evidenceType: "during",
      },
      file: {
        originalname: "during.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from("photo"),
      },
    });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("FORBIDDEN");
  });

  it("rejects unsupported contractor evidence file types", async () => {
    const router = (await import("../maintenanceRequestsRoutes")).default;

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/contractor/jobs/maint-1/evidence",
      headers: {
        "x-test-user": JSON.stringify({
          id: "contractor-1",
          role: "contractor",
        }),
      },
      body: {
        evidenceType: "during",
      },
      file: {
        originalname: "during.txt",
        mimetype: "text/plain",
        buffer: Buffer.from("photo"),
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("UNSUPPORTED_FILE_TYPE");
  });
});
