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

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) {
      req.user = JSON.parse(header);
    }
    next();
  },
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

describe("workOrdersRoutes execution completion", () => {
  async function invokeRouter(
    router: any,
    options: {
      method: string;
      url: string;
      body?: any;
      file?: any;
      headers?: Record<string, string>;
    }
  ) {
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
      status: "assigned",
      statusHistory: [],
      updatedAt: 100,
    });
    ensureCollection("workOrders").set("wo-1", {
      id: "wo-1",
      landlordId: "landlord-1",
      maintenanceRequestId: "maint-1",
      status: "assigned",
      title: "Broken heater",
      assignedContractorId: null,
      createdAtMs: 100,
      updatedAtMs: 100,
    });
  });

  it("writes structured metadata when a landlord completes an in-house work order", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/work-orders/wo-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        status: "completed",
        completionSummary: "Replaced the thermostat and tested the system.",
        completionOutcome: "completed",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.status).toBe("completed");

    const savedWorkOrder = ensureCollection("workOrders").get("wo-1");
    expect(savedWorkOrder?.serviceCompletedAt).toBeDefined();
    expect(savedWorkOrder?.completionSummary).toMatch(/Replaced the thermostat/i);
    expect(savedWorkOrder?.completedByActorRole).toBe("landlord");
    expect(savedWorkOrder?.completedByActorId).toBe("landlord-1");
  });

  it("confirms completion only for completed work orders", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    ensureCollection("workOrders").set("wo-1", {
      ...ensureCollection("workOrders").get("wo-1"),
      status: "completed",
      completionSummary: "Completed service visit.",
      serviceCompletedAt: 500,
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/confirm-completion",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.completionConfirmedByLandlordAt).toBeDefined();

    const savedWorkOrder = ensureCollection("workOrders").get("wo-1");
    expect(savedWorkOrder?.completionConfirmedByLandlordBy).toBe("landlord-1");
    expect(savedWorkOrder?.landlordApprovedBy).toBe("landlord-1");
    expect(savedWorkOrder?.resolutionStatus).toBe("landlord_approved");
  });

  it("rejects completion confirmation when the work order is not completed", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/confirm-completion",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("WORK_ORDER_NOT_COMPLETED");
  });

  it("approves completed work and advances to tenant signoff when a tenant is attached", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    ensureCollection("workOrders").set("wo-1", {
      ...ensureCollection("workOrders").get("wo-1"),
      tenantId: "tenant-1",
      status: "completed",
      completionSummary: "Completed service visit.",
      serviceCompletedAt: 500,
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/approve-resolution",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.resolutionStatus).toBe("tenant_pending_signoff");

    const savedWorkOrder = ensureCollection("workOrders").get("wo-1");
    expect(savedWorkOrder?.tenantSignoffStatus).toBe("pending");
    expect(savedWorkOrder?.landlordApprovedBy).toBe("landlord-1");
  });

  it("marks follow-up required for completed work with a reason", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    ensureCollection("workOrders").set("wo-1", {
      ...ensureCollection("workOrders").get("wo-1"),
      status: "completed",
      completionSummary: "Completed service visit.",
      serviceCompletedAt: 500,
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/mark-follow-up-required",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        reason: "Tenant reported the heat is still inconsistent.",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.resolutionStatus).toBe("follow_up_required");

    const savedWorkOrder = ensureCollection("workOrders").get("wo-1");
    expect(savedWorkOrder?.followUpRequired).toBe(true);
    expect(savedWorkOrder?.followUpReason).toMatch(/still inconsistent/i);
  });

  it("reopens a completed work order with a required reason", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    ensureCollection("workOrders").set("wo-1", {
      ...ensureCollection("workOrders").get("wo-1"),
      status: "completed",
      completionSummary: "Completed service visit.",
      serviceCompletedAt: 500,
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/reopen",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        reason: "Heating issue still present after the visit.",
        status: "blocked",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.status).toBe("blocked");

    const savedWorkOrder = ensureCollection("workOrders").get("wo-1");
    expect(savedWorkOrder?.reopenReason).toMatch(/Heating issue still present/i);
    expect(savedWorkOrder?.executionBlockedReason).toMatch(/Heating issue still present/i);
    expect(savedWorkOrder?.resolutionStatus).toBe("follow_up_required");
  });

  it("allows a landlord to upload evidence and update its visibility", async () => {
    const router = (await import("../workOrdersRoutes")).default;

    const uploadRes = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/evidence",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        evidenceType: "inspection",
        caption: "Inspection proof",
        visibility: "internal",
      },
      file: {
        originalname: "inspection.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from("photo"),
      },
    });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body?.item?.evidence?.[0]?.caption).toBe("Inspection proof");
    expect(uploadBufferToGcsMock).toHaveBeenCalled();

    const savedWorkOrder = ensureCollection("workOrders").get("wo-1");
    const savedEvidenceId = savedWorkOrder?.evidence?.[0]?.id;
    expect(savedEvidenceId).toBeTruthy();
    expect(Array.from(ensureCollection("workOrderUpdates").values())).toEqual(
      expect.arrayContaining([expect.objectContaining({ updateType: "photo" })])
    );

    const patchRes = await invokeRouter(router, {
      method: "PATCH",
      url: `/landlord/work-orders/wo-1/evidence/${savedEvidenceId}`,
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        visibility: "tenant_safe",
        caption: "Tenant-safe proof",
      },
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body?.item?.evidence?.[0]?.visibility).toBe("tenant_safe");
  });

  it("rejects unsupported evidence file types", async () => {
    const router = (await import("../workOrdersRoutes")).default;

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/evidence",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        evidenceType: "inspection",
        visibility: "internal",
      },
      file: {
        originalname: "notes.txt",
        mimetype: "text/plain",
        buffer: Buffer.from("hello"),
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("starts a structured rework cycle only when follow-up is required", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    ensureCollection("workOrders").set("wo-1", {
      ...ensureCollection("workOrders").get("wo-1"),
      status: "completed",
      resolutionStatus: "follow_up_required",
      followUpRequired: true,
      followUpReason: "Initial repair did not fully resolve the issue.",
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/start-rework",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.reworkCycle?.cycleNumber).toBe(1);
    expect(res.body?.item?.reworkCycle?.status).toBe("not_started");
    expect(res.body?.item?.resolutionStatus).toBe("completed_pending_review");
  });

  it("assigns and completes a rework cycle while preserving history", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    ensureCollection("workOrders").set("wo-1", {
      ...ensureCollection("workOrders").get("wo-1"),
      status: "completed",
      resolutionStatus: "follow_up_required",
      followUpRequired: true,
      reworkCycle: {
        cycleNumber: 1,
        status: "assigned",
        createdAt: 1000,
        createdBy: "landlord-1",
      },
      evidence: [{ id: "ev-1" }],
    });

    const assignRes = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/assign-rework",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        contractorId: "contractor-22",
      },
    });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body?.item?.reworkCycle?.assignedContractorId).toBe("contractor-22");

    ensureCollection("workOrders").set("wo-1", {
      ...ensureCollection("workOrders").get("wo-1"),
      status: "completed",
      reworkCycle: {
        ...ensureCollection("workOrders").get("wo-1")?.reworkCycle,
        status: "completed",
        startedAt: 1100,
        completedAt: 1200,
        completionSummary: "Balanced airflow and verified bedroom temperature.",
      },
    });

    const completeRes = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/complete-rework",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        outcome: "resolved",
        notes: "Second pass complete.",
      },
    });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body?.item?.resolutionStatus).toBe("completed_pending_review");

    const savedWorkOrder = ensureCollection("workOrders").get("wo-1");
    expect(savedWorkOrder?.reworkHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cycleNumber: 1,
          outcome: "resolved",
          notes: "Second pass complete.",
        }),
      ])
    );
  });

  it("schedules and reschedules an active rework cycle", async () => {
    const router = (await import("../workOrdersRoutes")).default;
    ensureCollection("workOrders").set("wo-1", {
      ...ensureCollection("workOrders").get("wo-1"),
      status: "completed",
      resolutionStatus: "completed_pending_review",
      reworkCycle: {
        cycleNumber: 1,
        status: "assigned",
        createdAt: 1000,
        createdBy: "landlord-1",
        assignedContractorId: "contractor-22",
        assignedAt: 1010,
        schedule: null,
      },
    });

    const scheduleRes = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/rework-schedule",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        scheduledFor: 2_000,
        requiresTenantAccess: true,
      },
    });

    expect(scheduleRes.status).toBe(200);
    expect(scheduleRes.body?.item?.reworkCycle?.schedule).toEqual(
      expect.objectContaining({
        scheduledFor: 2_000,
        status: "tenant_pending",
        requiresTenantAccess: true,
        tenantAccessStatus: "pending",
        contractorScheduleStatus: "pending",
      })
    );

    const rescheduleRes = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/work-orders/wo-1/reschedule-rework",
      headers: {
        "x-test-user": JSON.stringify({
          id: "landlord-1",
          role: "landlord",
          landlordId: "landlord-1",
        }),
      },
      body: {
        scheduledFor: 3_000,
        requiresTenantAccess: false,
        reason: "Contractor requested a different visit time.",
      },
    });

    expect(rescheduleRes.status).toBe(200);
    expect(rescheduleRes.body?.item?.reworkCycle?.schedule).toEqual(
      expect.objectContaining({
        scheduledFor: 3_000,
        status: "scheduled",
        requiresTenantAccess: false,
        tenantAccessStatus: "not_required",
        contractorScheduleStatus: "pending",
        rescheduleReason: "Contractor requested a different visit time.",
      })
    );
  });
});
