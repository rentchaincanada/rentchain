import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leaseService } from "../../services/leaseService";
import { clearLeaseAutomationTasks } from "../../services/automationScheduler/leaseAutomationTaskStore";
import * as leaseDraftsService from "../../services/leaseDraftsService";

type DocShape = { id: string; data: any };

const store = new Map<string, Map<string, DocShape>>();
let idSeq = 0;

function ensureCollection(name: string) {
  if (!store.has(name)) store.set(name, new Map());
  return store.get(name)!;
}

const fakeDb = {
  collection: (name: string) => ({
    doc: (id?: string) => {
      const actualId = id || `doc_${++idSeq}`;
      const col = ensureCollection(name);
      return {
        id: actualId,
        set: async (value: any) => {
          col.set(actualId, { id: actualId, data: value });
        },
        get: async () => {
          const entry = col.get(actualId);
          return {
            id: actualId,
            exists: Boolean(entry),
            data: () => entry?.data,
          };
        },
      };
    },
  }),
};

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, _res: any, next: any) => {
    req.user = {
      id: "landlord-1",
      landlordId: "landlord-1",
      role: "landlord",
      name: "Demo Landlord",
    };
    next();
  },
}));

vi.mock("../../services/leaseDraftsService", async () => {
  const actual: any = await vi.importActual("../../services/leaseDraftsService");
  return {
    ...actual,
    generateScheduleA: vi.fn(async () => ({
      file: {
        kind: "schedule-a-pdf",
        url: "https://example.invalid/schedule-a.pdf",
        sha256: "abc123",
        sizeBytes: 1024,
        bucket: "test-bucket",
        objectKey: "leases/landlord-1/draft/schedule-a-v1.pdf",
      },
      pdfBuffer: Buffer.from("pdf"),
      sha256: "abc123",
      sizeBytes: 1024,
    })),
  };
});

describe("lease draft routes", () => {
  beforeEach(() => {
    store.clear();
    idSeq = 0;
    leaseService.getAll().splice(0);
    clearLeaseAutomationTasks();
  });

  const payload = {
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantIds: ["tenant-1"],
    province: "NS",
    termType: "fixed",
    startDate: "2026-03-01",
    endDate: "2027-02-28",
    baseRentCents: 185000,
    parkingCents: 10000,
    dueDay: 1,
    paymentMethod: "etransfer",
    nsfFeeCents: 4500,
    utilitiesIncluded: ["heat", "water"],
    depositCents: 92500,
    additionalClauses: "No smoking in common areas.",
  };

  it("create draft then generate snapshot with URL", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const createRes = await request(app).post("/drafts").send(payload);
    expect(createRes.status).toBe(201);
    expect(createRes.body?.ok).toBe(true);
    const draftId = String(createRes.body?.draftId || "");
    expect(draftId).toBeTruthy();

    const generateRes = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/generate`)
      .send({
        tenantNames: ["Tenant One"],
        propertyAddress: "123 Main St, Halifax, NS",
        unitLabel: "Unit 2A",
      });
    expect(generateRes.status).toBe(201);
    expect(generateRes.body?.ok).toBe(true);
    expect(generateRes.body?.scheduleAUrl).toContain("https://example.invalid");
    expect(String(generateRes.body?.snapshotId || "")).toBeTruthy();
  }, 30000);

  it("returns inline PDF when storage upload is unavailable", async () => {
    vi.spyOn(leaseDraftsService, "generateScheduleA").mockResolvedValueOnce({
      file: null,
      pdfBuffer: Buffer.from("%PDF-1.4 inline"),
      sha256: "inline123",
      sizeBytes: 15,
    });

    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const createRes = await request(app).post("/drafts").send(payload);
    expect(createRes.status).toBe(201);
    const draftId = String(createRes.body?.draftId || "");

    const generateRes = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/generate`)
      .send({
        tenantNames: ["Tenant One"],
        propertyAddress: "123 Main St, Halifax, NS",
        unitLabel: "Unit 2A",
      });

    expect(generateRes.status).toBe(200);
    expect(generateRes.headers["content-type"]).toContain("application/pdf");
    expect(generateRes.headers["content-disposition"]).toContain("schedule-a.pdf");
  });

  it("regenerates and lists automation tasks for a lease", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const lease = leaseService.create({
      tenantId: "tenant-2",
      propertyId: "prop-2",
      unitNumber: "2A",
      monthlyRent: 1800,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    const regenerateRes = await request(app).post(
      `/${encodeURIComponent(lease.id)}/automation/tasks/regenerate`
    );
    expect(regenerateRes.status).toBe(200);
    expect(regenerateRes.body?.ok).toBe(true);
    expect(Array.isArray(regenerateRes.body?.tasks)).toBe(true);
    expect(regenerateRes.body?.tasks).toHaveLength(3);

    const listRes = await request(app).get(`/${encodeURIComponent(lease.id)}/automation/tasks`);
    expect(listRes.status).toBe(200);
    expect(listRes.body?.ok).toBe(true);
    expect(Array.isArray(listRes.body?.tasks)).toBe(true);
    expect(listRes.body?.tasks).toHaveLength(3);
  });
});
