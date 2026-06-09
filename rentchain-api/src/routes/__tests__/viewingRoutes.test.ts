import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildEmailHtmlMock, buildEmailTextMock, sendEmailMock } = vi.hoisted(() => ({
  buildEmailHtmlMock: vi.fn(() => "<p>email</p>"),
  buildEmailTextMock: vi.fn(() => "email"),
  sendEmailMock: vi.fn(),
}));

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

vi.mock("../../firebase", () => ({ db: dbMock }));
vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));
vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: buildEmailHtmlMock,
  buildEmailText: buildEmailTextMock,
}));
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

async function createRouter() {
  return (await import("../viewingRoutes")).default;
}

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
}) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: {},
      params: {},
      query: {},
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

describe("viewingRoutes", () => {
  beforeEach(() => {
    resetDb();
    buildEmailHtmlMock.mockClear();
    buildEmailTextMock.mockClear();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";
    seedCollection("properties", "property-1", {
      id: "property-1",
      landlordId: "landlord-1",
      name: "Harbour House",
      managerEmail: "manager@example.com",
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
    const router = await createRouter();
    const res = await invokeRouter(router, { method: "POST", url: "/viewings/request", body: {
      unitId: "unit-1",
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
      applicantPhone: "5555550100",
      requestedMessage: "Looking for an evening showing.",
    }});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("requested");
    expect(res.body.landlordId).toBe("landlord-1");
    expect(Array.isArray(res.body.proposedSlots)).toBe(true);
    expect(res.body.proposedSlots).toHaveLength(0);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the viewing request when email delivery fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("mail_failed"));
    const router = await createRouter();
    const res = await invokeRouter(router, { method: "POST", url: "/viewings/request", body: {
      unitId: "unit-1",
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
    }});

    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(getCollection("viewingRequests").size).toBe(1);
  });

  it("rejects an invalid viewing request payload", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, { method: "POST", url: "/viewings/request", body: {
      applicantName: "Jordan Lee",
      applicantEmail: "jordan@example.com",
    }});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("proposes slots successfully", async () => {
    const router = await createRouter();
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

    const res = await invokeRouter(router, { method: "POST", url: "/viewings/view-1/propose-slots", body: {
      proposedSlots: [
        {
          id: "slot-1",
          startAt: "2026-04-02T18:00:00.000Z",
          endAt: "2026-04-02T18:30:00.000Z",
          note: "Front entrance",
        },
      ],
    }});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("slots_proposed");
    expect(res.body.proposedSlots).toHaveLength(1);
    expect(res.body.slotsProposedAt).toBeTruthy();
  });

  it("rejects invalid proposed slot ranges", async () => {
    const router = await createRouter();
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

    const res = await invokeRouter(router, { method: "POST", url: "/viewings/view-2/propose-slots", body: {
      proposedSlots: [
        {
          id: "slot-1",
          startAt: "2026-04-02T18:30:00.000Z",
          endAt: "2026-04-02T18:00:00.000Z",
        },
      ],
    }});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_failed");
  });

  it("selects a proposed slot successfully", async () => {
    const router = await createRouter();
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

    const res = await invokeRouter(router, { method: "POST", url: "/viewings/view-3/select-slot", body: { slotId: "slot-1" } });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("scheduled");
    expect(res.body.selectedSlotId).toBe("slot-1");
    expect(res.body.selectedSlot).toEqual(expect.objectContaining({
      id: "slot-1",
      startAt: "2026-04-02T18:00:00.000Z",
      endAt: "2026-04-02T18:30:00.000Z",
    }));
    expect(res.body.proposedSlots[0].isSelected).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "jordan@example.com",
      from: "noreply@example.com",
      replyTo: "noreply@example.com",
      subject: "Viewing confirmed for Harbour House • Unit 2A",
    }));
    expect(buildEmailTextMock).toHaveBeenCalledWith(expect.objectContaining({
      intro: "Your viewing time has been confirmed.",
      bullets: [
        "When: 2026-04-02 from 18:00 to 18:30 UTC",
        "Location: Harbour House • Unit 2A",
        "Note: Front entrance",
      ],
      ctaText: "Open viewings",
      ctaUrl: "https://www.rentchain.ai/viewings",
    }));
    expect(buildEmailHtmlMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Viewing time confirmed",
      preheader: "Viewing confirmed for 2026-04-02 from 18:00 to 18:30 UTC.",
    }));
  });

  it("schedules a selected slot without notification when applicant email is missing", async () => {
    const router = await createRouter();
    seedCollection("viewingRequests", "view-missing-email", {
      id: "view-missing-email",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: null,
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

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/viewings/view-missing-email/select-slot",
      body: { slotId: "slot-1" },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("scheduled");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("schedules a selected slot without notification when applicant email is invalid", async () => {
    const router = await createRouter();
    seedCollection("viewingRequests", "view-invalid-email", {
      id: "view-invalid-email",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: null,
      applicantName: "Jordan Lee",
      applicantEmail: "not-an-email",
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

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/viewings/view-invalid-email/select-slot",
      body: { slotId: "slot-1" },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("scheduled");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("keeps selected slot scheduling when confirmation email delivery fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("mail_failed"));
    const router = await createRouter();
    seedCollection("viewingRequests", "view-email-failure", {
      id: "view-email-failure",
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
          note: null,
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

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/viewings/view-email-failure/select-slot",
      body: { slotId: "slot-1" },
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("scheduled");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(getCollection("viewingRequests").get("view-email-failure")?.data?.status).toBe("scheduled");
  });

  it("uses safe generic location text when property and unit labels are unavailable", async () => {
    const router = await createRouter();
    seedCollection("viewingRequests", "view-generic-location", {
      id: "view-generic-location",
      landlordId: "landlord-1",
      propertyId: "property-missing",
      unitId: "unit-missing",
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

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/viewings/view-generic-location/select-slot",
      body: { slotId: "slot-1" },
    });

    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Viewing confirmed for the requested property",
    }));
    expect(buildEmailTextMock).toHaveBeenCalledWith(expect.objectContaining({
      bullets: [
        "When: 2026-04-02 from 18:00 to 18:30 UTC",
        "Location: the requested property",
      ],
    }));
  });

  it("rejects selection of an unknown slot", async () => {
    const router = await createRouter();
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

    const res = await invokeRouter(router, { method: "POST", url: "/viewings/view-4/select-slot", body: { slotId: "missing-slot" } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_slot_selection");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("only completes from scheduled", async () => {
    const router = await createRouter();
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

    const invalid = await invokeRouter(router, { method: "POST", url: "/viewings/view-5/complete", body: {} });
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

    const valid = await invokeRouter(router, { method: "POST", url: "/viewings/view-6/complete", body: {} });
    expect(valid.status).toBe(200);
    expect(valid.body.status).toBe("completed");
  });

  it("cancels from allowed states", async () => {
    const router = await createRouter();
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

    const res = await invokeRouter(router, { method: "POST", url: "/viewings/view-7/cancel", body: {
      cancelledReason: "Applicant no longer available",
    }});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.cancelledReason).toBe("Applicant no longer available");
  });

  it("lists only landlord-owned viewing requests", async () => {
    const router = await createRouter();
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

    const res = await invokeRouter(router, { method: "GET", url: "/viewings" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("view-a");
    expect(getCollection("viewingRequests").size).toBe(2);
  });
});
