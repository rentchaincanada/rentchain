import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const {
  dbMock,
  resetDb,
  seedCollection,
  getCollection,
} = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let generatedId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        doc: (id?: string) => {
          const resolvedId = id || `generated-${++generatedId}`;
          return {
            id: resolvedId,
            async get() {
              const entry = ensureCollection(name).get(resolvedId);
              return {
                id: resolvedId,
                exists: Boolean(entry),
                data: () => entry?.data,
              };
            },
            async set(payload: any, options?: { merge?: boolean }) {
              const col = ensureCollection(name);
              if (options?.merge && col.has(resolvedId)) {
                const existing = col.get(resolvedId)!;
                col.set(resolvedId, { id: resolvedId, data: { ...(existing.data || {}), ...(payload || {}) } });
                return;
              }
              col.set(resolvedId, { id: resolvedId, data: payload || {} });
            },
          };
        },
        where: (field: string, _op: string, value: any) => ({
          async get() {
            const docs = Array.from(ensureCollection(name).values())
              .filter((entry) => entry.data?.[field] === value)
              .map((entry) => ({
                id: entry.id,
                data: () => entry.data,
              }));
            return { docs };
          },
        }),
      }),
    },
    resetDb: () => {
      collections.clear();
      generatedId = 0;
    },
    seedCollection: (name: string, id: string, data: any) => {
      ensureCollection(name).set(id, { id, data });
    },
    getCollection: (name: string) => ensureCollection(name),
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));
vi.mock("../../middleware/rateLimit", () => ({
  rateLimitPublicApply: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, _res: any, next: any) => {
    req.user = {
      id: "landlord-1",
      landlordId: "landlord-1",
      role: "landlord",
    };
    next();
  },
}));

async function createApp() {
  const router = (await import("../viewingRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("viewingRoutes", () => {
  beforeEach(() => {
    resetDb();
    seedCollection("properties", "property-1", {
      id: "property-1",
      landlordId: "landlord-1",
      name: "Harbour House",
    });
    seedCollection("properties", "property-2", {
      id: "property-2",
      landlordId: "landlord-2",
      name: "North Point",
    });
    seedCollection("units", "unit-1", {
      id: "unit-1",
      propertyId: "property-1",
      landlordId: "landlord-1",
      unitNumber: "2A",
    });
  });

  it("creates a viewing request successfully", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/viewings/request").send({
      unitId: "unit-1",
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: "5555550100",
      requestedMessage: "Looking for an evening showing.",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("requested");
    expect(res.body.landlordId).toBe("landlord-1");
    expect(Array.isArray(res.body.proposedSlots)).toBe(true);
    expect(res.body.proposedSlots).toHaveLength(0);
  });

  it("rejects an invalid viewing request payload", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/viewings/request").send({
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("proposes slots successfully", async () => {
    const app = await createApp();
    seedCollection("viewingRequests", "view-1", {
      id: "view-1",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "requested",
      proposedSlots: [],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:00:00.000Z",
    });

    const res = await request(app).post("/api/viewings/view-1/propose-slots").send({
      proposedSlots: [
        {
          id: "slot-1",
          startAt: "2026-04-02T18:00:00.000Z",
          endAt: "2026-04-02T18:30:00.000Z",
          note: "Front entrance",
        },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("slots_proposed");
    expect(res.body.proposedSlots).toHaveLength(1);
    expect(res.body.slotsProposedAt).toBeTruthy();
  });

  it("rejects invalid proposed slot ranges", async () => {
    const app = await createApp();
    seedCollection("viewingRequests", "view-2", {
      id: "view-2",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "requested",
      proposedSlots: [],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:00:00.000Z",
    });

    const res = await request(app).post("/api/viewings/view-2/propose-slots").send({
      proposedSlots: [
        {
          id: "slot-1",
          startAt: "2026-04-02T18:30:00.000Z",
          endAt: "2026-04-02T18:00:00.000Z",
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("selects a proposed slot successfully", async () => {
    const app = await createApp();
    seedCollection("viewingRequests", "view-3", {
      id: "view-3",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "slots_proposed",
      proposedSlots: [
        {
          id: "slot-1",
          startAt: "2026-04-02T18:00:00.000Z",
          endAt: "2026-04-02T18:30:00.000Z",
          note: "Front entrance",
          isSelected: false,
        },
      ],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      slotsProposedAt: "2026-03-28T11:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T11:00:00.000Z",
    });

    const res = await request(app).post("/api/viewings/view-3/select-slot").send({ slotId: "slot-1" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("scheduled");
    expect(res.body.selectedSlotId).toBe("slot-1");
    expect(res.body.proposedSlots[0].isSelected).toBe(true);
  });

  it("rejects selection of an unknown slot", async () => {
    const app = await createApp();
    seedCollection("viewingRequests", "view-4", {
      id: "view-4",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "slots_proposed",
      proposedSlots: [
        {
          id: "slot-1",
          startAt: "2026-04-02T18:00:00.000Z",
          endAt: "2026-04-02T18:30:00.000Z",
          isSelected: false,
        },
      ],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      slotsProposedAt: "2026-03-28T11:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T11:00:00.000Z",
    });

    const res = await request(app).post("/api/viewings/view-4/select-slot").send({ slotId: "missing-slot" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_slot_selection");
  });

  it("only completes from scheduled", async () => {
    const app = await createApp();
    seedCollection("viewingRequests", "view-5", {
      id: "view-5",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "slots_proposed",
      proposedSlots: [],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:00:00.000Z",
    });

    const invalid = await request(app).post("/api/viewings/view-5/complete").send({});
    expect(invalid.status).toBe(409);

    seedCollection("viewingRequests", "view-6", {
      id: "view-6",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "scheduled",
      proposedSlots: [
        {
          id: "slot-1",
          startAt: "2026-04-02T18:00:00.000Z",
          endAt: "2026-04-02T18:30:00.000Z",
          isSelected: true,
        },
      ],
      selectedSlotId: "slot-1",
      selectedSlot: {
        id: "slot-1",
        startAt: "2026-04-02T18:00:00.000Z",
        endAt: "2026-04-02T18:30:00.000Z",
      },
      requestedAt: "2026-03-28T10:00:00.000Z",
      slotsProposedAt: "2026-03-28T11:00:00.000Z",
      scheduledAt: "2026-03-28T12:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T12:00:00.000Z",
    });

    const valid = await request(app).post("/api/viewings/view-6/complete").send({});
    expect(valid.status).toBe(200);
    expect(valid.body.status).toBe("completed");
  });

  it("cancels from allowed states", async () => {
    const app = await createApp();
    seedCollection("viewingRequests", "view-7", {
      id: "view-7",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "requested",
      proposedSlots: [],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:00:00.000Z",
    });

    const res = await request(app).post("/api/viewings/view-7/cancel").send({
      cancelledReason: "Applicant no longer available",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.cancelledReason).toBe("Applicant no longer available");
  });

  it("lists only landlord-owned viewing requests", async () => {
    const app = await createApp();
    seedCollection("viewingRequests", "view-a", {
      id: "view-a",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "requested",
      proposedSlots: [],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:00:00.000Z",
    });
    seedCollection("viewingRequests", "view-b", {
      id: "view-b",
      landlordId: "landlord-2",
      propertyId: "property-2",
      unitId: null,
      applicationId: null,
      applicantName: "Alex Doe",
      applicantEmail: "alex@example.com",
      applicantPhone: null,
      requestedMessage: null,
      status: "requested",
      proposedSlots: [],
      selectedSlotId: null,
      selectedSlot: null,
      requestedAt: "2026-03-28T10:00:00.000Z",
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T10:00:00.000Z",
    });

    const res = await request(app).get("/api/viewings");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("view-a");
    expect(getCollection("viewingRequests").size).toBe(2);
  });
});
