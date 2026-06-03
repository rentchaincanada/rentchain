import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { leaseService } from "../../services/leaseService";
import { clearLeaseAutomationTasks } from "../../services/automationScheduler/leaseAutomationTaskStore";
import * as leaseDraftsService from "../../services/leaseDraftsService";

type DocShape = { id: string; data: any };
const sendEmailMock = vi.fn(async () => undefined);

const { store, fakeDb, resetFakeDb } = vi.hoisted(() => {
  const store = new Map<string, Map<string, DocShape>>();
  let idSeq = 0;

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: DocShape, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      if (op === "array-contains") return Array.isArray(actual) && actual.includes(value);
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      orderBy: () => makeQuery(name, filters),
      limit: () => makeQuery(name, filters),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id?: string) => makeDoc(name, id),
    };
  }

  function makeDoc(name: string, id?: string) {
    const actualId = id || `doc_${++idSeq}`;
    const col = ensureCollection(name);
    return {
      id: actualId,
      set: async (value: any, options?: { merge?: boolean }) => {
        const current = col.get(actualId)?.data || {};
        col.set(actualId, { id: actualId, data: options?.merge ? { ...current, ...value } : value });
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
  }

  const fakeDb = {
    collection: (name: string) => ({
      where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
      orderBy: () => makeQuery(name),
      limit: () => makeQuery(name),
      get: async () => makeQuery(name).get(),
      doc: (id?: string) => makeDoc(name, id),
    }),
  };

  return {
    store,
    fakeDb,
    resetFakeDb: () => {
      store.clear();
      idSeq = 0;
    },
  };
});

vi.mock("../../firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const auth = String(req.headers?.authorization || "");
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
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

vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));

describe("lease draft routes", () => {
  beforeEach(() => {
    resetFakeDb();
    leaseService.getAll().splice(0);
    clearLeaseAutomationTasks();
    sendEmailMock.mockClear();
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";
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
  const auth = { Authorization: "Bearer test-token" };

  it("create draft then generate snapshot with URL", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const createRes = await request(app).post("/drafts").set(auth).send(payload);
    expect(createRes.status).toBe(201);
    expect(createRes.body?.ok).toBe(true);
    const draftId = String(createRes.body?.draftId || "");
    expect(draftId).toBeTruthy();

    const generateRes = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/generate`)
      .set(auth)
      .send({
        tenantNames: ["Tenant One"],
        propertyAddress: "123 Main St, Halifax, NS",
        unitLabel: "Unit 2A",
      });
    expect(generateRes.status).toBe(201);
    expect(generateRes.body?.ok).toBe(true);
    expect(generateRes.body?.scheduleAUrl).toContain("https://example.invalid");
    expect(String(generateRes.body?.snapshotId || "")).toBeTruthy();
    const generatedSnapshot = store.get("leaseSnapshots")?.get(String(generateRes.body?.snapshotId || ""))?.data;
    expect(generatedSnapshot).toEqual(
      expect.objectContaining({
        draftId,
        sourceDraftId: draftId,
        generatedFiles: [
          expect.objectContaining({
            url: "https://example.invalid/schedule-a.pdf",
          }),
        ],
      })
    );

    const attachmentDocsAfterGenerate = Array.from(store.get("ledgerAttachments")?.values() || []).map((doc) => doc.data);
    expect(attachmentDocsAfterGenerate).toEqual([
      expect.objectContaining({
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        leaseId: null,
        draftId,
        propertyId: "prop-1",
        category: "Lease",
        purpose: "LEASE",
        purposeLabel: "Lease",
        url: "https://example.invalid/schedule-a.pdf",
      }),
    ]);

    const activateRes = await request(app).post(`/drafts/${encodeURIComponent(draftId)}/activate`).set(auth).send({});
    expect(activateRes.status).toBe(200);
    expect(activateRes.body?.lease).toEqual(
      expect.objectContaining({
        documentUrl: "https://example.invalid/schedule-a.pdf",
        approvedDocumentUrl: "https://example.invalid/schedule-a.pdf",
        documentRef: "https://example.invalid/schedule-a.pdf",
      })
    );

    const attachmentDocsAfterActivate = Array.from(store.get("ledgerAttachments")?.values() || []).map((doc) => doc.data);
    expect(attachmentDocsAfterActivate).toHaveLength(1);
    expect(attachmentDocsAfterActivate[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        leaseId: String(activateRes.body?.leaseId || ""),
        draftId,
        propertyId: "prop-1",
        category: "Lease",
      })
    );
  }, 30000);

  it("updates one visible Lease attachment across repeated draft PDF generation", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const createRes = await request(app).post("/drafts").set(auth).send(payload);
    expect(createRes.status).toBe(201);
    const draftId = String(createRes.body?.draftId || "");

    const firstGenerateRes = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/generate`)
      .set(auth)
      .send({
        tenantNames: ["Tenant One"],
        propertyAddress: "123 Main St, Halifax, NS",
        unitLabel: "Unit 2A",
      });
    expect(firstGenerateRes.status).toBe(201);

    const secondGenerateRes = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/generate`)
      .set(auth)
      .send({
        tenantNames: ["Tenant One"],
        propertyAddress: "123 Main St, Halifax, NS",
        unitLabel: "Unit 2A",
      });
    expect(secondGenerateRes.status).toBe(201);

    const attachmentDocs = Array.from(store.get("ledgerAttachments")?.values() || []).map((doc) => doc.data);
    expect(attachmentDocs).toHaveLength(1);
    expect(attachmentDocs[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        leaseId: null,
        draftId,
        leaseSnapshotId: String(secondGenerateRes.body?.snapshotId || ""),
        category: "Lease",
        purpose: "LEASE",
        url: "https://example.invalid/schedule-a.pdf",
      })
    );
  });

  it("updates a legacy same-url Lease attachment instead of creating a visible duplicate", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    await fakeDb.collection("ledgerAttachments").doc("legacy-same-url-lease").set({
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      ledgerItemId: "legacy-ledger-item",
      title: "Lease document",
      fileName: "schedule-a-v1.pdf",
      category: "Lease",
      purpose: "LEASE",
      purposeLabel: "Lease",
      url: "https://example.invalid/schedule-a.pdf",
      createdAt: 100,
      source: "lease_pdf_generation",
    });

    const createRes = await request(app).post("/drafts").set(auth).send(payload);
    expect(createRes.status).toBe(201);
    const draftId = String(createRes.body?.draftId || "");

    const generateRes = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/generate`)
      .set(auth)
      .send({
        tenantNames: ["Tenant One"],
        propertyAddress: "123 Main St, Halifax, NS",
        unitLabel: "Unit 2A",
      });
    expect(generateRes.status).toBe(201);

    const attachmentDocs = Array.from(store.get("ledgerAttachments")?.entries() || []);
    expect(attachmentDocs).toHaveLength(1);
    expect(attachmentDocs[0][0]).toBe("legacy-same-url-lease");
    expect(attachmentDocs[0][1].data).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        leaseId: null,
        draftId,
        category: "Lease",
        purpose: "LEASE",
        url: "https://example.invalid/schedule-a.pdf",
      })
    );
  });

  it("activates a draft using the latest durable generated snapshot when the draft pointer is missing", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const draftId = "draft_without_pointer";
    await fakeDb.collection("leaseDrafts").doc(draftId).set({
      ...payload,
      landlordId: "landlord-1",
      status: "generated",
      updatedAt: 100,
    });
    await fakeDb.collection("leaseSnapshots").doc("snapshot-old").set({
      ...payload,
      landlordId: "landlord-1",
      draftId,
      sourceDraftId: draftId,
      generatedAt: 100,
      generatedFiles: [{ kind: "schedule-a-pdf", url: "https://example.invalid/old-schedule-a.pdf" }],
    });
    await fakeDb.collection("leaseSnapshots").doc("snapshot-new").set({
      ...payload,
      landlordId: "landlord-1",
      draftId,
      sourceDraftId: draftId,
      generatedAt: 200,
      generatedFiles: [{ kind: "schedule-a-pdf", url: "https://example.invalid/new-schedule-a.pdf" }],
    });

    const activateRes = await request(app).post(`/drafts/${encodeURIComponent(draftId)}/activate`).set(auth).send({});
    expect(activateRes.status).toBe(200);
    expect(activateRes.body?.lease).toEqual(
      expect.objectContaining({
        documentUrl: "https://example.invalid/new-schedule-a.pdf",
        approvedDocumentUrl: "https://example.invalid/new-schedule-a.pdf",
        documentRef: "https://example.invalid/new-schedule-a.pdf",
        latestLeaseSnapshotId: "snapshot-new",
      })
    );

    const attachmentDocs = Array.from(store.get("ledgerAttachments")?.values() || []).map((doc) => doc.data);
    expect(attachmentDocs).toHaveLength(1);
    expect(attachmentDocs[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        leaseId: String(activateRes.body?.leaseId || ""),
        draftId,
        leaseSnapshotId: "snapshot-new",
        category: "Lease",
        purpose: "LEASE",
        purposeLabel: "Lease",
        title: "Lease document",
        fileName: "schedule-a-v1.pdf",
        url: "https://example.invalid/new-schedule-a.pdf",
        source: "lease_pdf_generation",
      })
    );
  });

  it("repairs existing activated draft document linkage without duplicating the Lease attachment", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const draftId = "draft_existing_lease";
    const leaseId = "lease-existing";
    await fakeDb.collection("leaseDrafts").doc(draftId).set({
      ...payload,
      landlordId: "landlord-1",
      leaseId,
      status: "active",
    });
    await fakeDb.collection("leases").doc(leaseId).set({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
      sourceDraftId: draftId,
      startDate: "2026-03-01",
      endDate: "2027-02-28",
    });
    await fakeDb.collection("leaseSnapshots").doc("snapshot-existing").set({
      ...payload,
      landlordId: "landlord-1",
      draftId,
      sourceDraftId: draftId,
      generatedAt: 300,
      generatedFiles: [{ kind: "schedule-a-pdf", url: "https://example.invalid/existing-schedule-a.pdf" }],
    });

    const firstRes = await request(app).post(`/drafts/${encodeURIComponent(draftId)}/activate`).set(auth).send({});
    expect(firstRes.status).toBe(200);
    expect(firstRes.body?.leaseId).toBe(leaseId);
    expect(firstRes.body?.lease).toEqual(
      expect.objectContaining({
        documentUrl: "https://example.invalid/existing-schedule-a.pdf",
        approvedDocumentUrl: "https://example.invalid/existing-schedule-a.pdf",
        documentRef: "https://example.invalid/existing-schedule-a.pdf",
        latestLeaseSnapshotId: "snapshot-existing",
      })
    );

    await fakeDb.collection("leaseSnapshots").doc("snapshot-existing-new").set({
      ...payload,
      landlordId: "landlord-1",
      draftId,
      sourceDraftId: draftId,
      generatedAt: 400,
      generatedFiles: [{ kind: "schedule-a-pdf", url: "https://example.invalid/existing-schedule-a-new.pdf" }],
    });

    const secondRes = await request(app).post(`/drafts/${encodeURIComponent(draftId)}/activate`).set(auth).send({});
    expect(secondRes.status).toBe(200);
    expect(secondRes.body?.leaseId).toBe(leaseId);

    const attachmentDocs = Array.from(store.get("ledgerAttachments")?.values() || []).map((doc) => doc.data);
    expect(attachmentDocs).toHaveLength(1);
    expect(attachmentDocs[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        leaseId,
        draftId,
        leaseSnapshotId: "snapshot-existing-new",
        category: "Lease",
        url: "https://example.invalid/existing-schedule-a-new.pdf",
      })
    );
  });

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

    const createRes = await request(app).post("/drafts").set(auth).send(payload);
    expect(createRes.status).toBe(201);
    const draftId = String(createRes.body?.draftId || "");

    const generateRes = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/generate`)
      .set(auth)
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
    ).set(auth);
    expect(regenerateRes.status).toBe(200);
    expect(regenerateRes.body?.ok).toBe(true);
    expect(Array.isArray(regenerateRes.body?.tasks)).toBe(true);
    expect(regenerateRes.body?.tasks).toHaveLength(3);

    const listRes = await request(app).get(`/${encodeURIComponent(lease.id)}/automation/tasks`).set(auth);
    expect(listRes.status).toBe(200);
    expect(listRes.body?.ok).toBe(true);
    expect(Array.isArray(listRes.body?.tasks)).toBe(true);
    expect(listRes.body?.tasks).toHaveLength(3);
  });

  it("regenerates and lists automation tasks for a firestore-backed lease", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    await fakeDb.collection("leases").doc("lease-firestore").set({
      landlordId: "landlord-1",
      tenantId: "tenant-3",
      propertyId: "prop-3",
      unitNumber: "3A",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      automationEnabled: true,
      renewalStatus: "offered",
      status: "active",
    });

    const regenerateRes = await request(app)
      .post("/lease-firestore/automation/tasks/regenerate")
      .set(auth);
    expect(regenerateRes.status).toBe(200);
    expect(regenerateRes.body?.ok).toBe(true);
    expect(Array.isArray(regenerateRes.body?.tasks)).toBe(true);

    const listRes = await request(app).get("/lease-firestore/automation/tasks").set(auth);
    expect(listRes.status).toBe(200);
    expect(listRes.body?.ok).toBe(true);
    expect(Array.isArray(listRes.body?.tasks)).toBe(true);
  });

  it("activates lease from draft and tenant lease fetch includes it", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);
    await fakeDb.collection("properties").doc("prop-1").set({
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [
        { id: "unit-1", unitNumber: "101", status: "vacant", occupancyStatus: "vacant" },
        { id: "unit-2", unitNumber: "102", status: "vacant", occupancyStatus: "vacant" },
      ],
    });
    await fakeDb.collection("units").doc("unit-1").set({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    await fakeDb.collection("tenants").doc("tenant-1").set({
      landlordId: "landlord-1",
      fullName: "Tenant One",
      email: "tenant@example.com",
    });

    const createRes = await request(app).post("/drafts").set(auth).send(payload);
    expect(createRes.status).toBe(201);
    const draftId = String(createRes.body?.draftId || "");

    const activateRes = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/activate`)
      .set(auth)
      .send({});
    expect(activateRes.status).toBe(200);
    expect(activateRes.body?.ok).toBe(true);
    const leaseId = String(activateRes.body?.leaseId || "");
    expect(leaseId).toBeTruthy();
    expect(activateRes.body?.leaseNotification).toEqual(expect.objectContaining({ attempted: true, sent: true }));
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tenant@example.com",
        subject: "Lease available in RentChain",
      })
    );

    const leasesRes = await request(app).get("/tenant/tenant-1").set(auth);
    expect(leasesRes.status).toBe(200);
    expect(leasesRes.body?.ok).toBe(true);
    expect(Array.isArray(leasesRes.body?.leases)).toBe(true);
    expect(leasesRes.body.leases.length).toBeGreaterThan(0);

    const propertySnap = await fakeDb.collection("properties").doc("prop-1").get();
    expect(propertySnap.data()?.units).toEqual([
      expect.objectContaining({
        id: "unit-1",
        status: "occupied",
        occupancyStatus: "occupied",
        currentTenantId: "tenant-1",
        currentLeaseId: leaseId,
      }),
      expect.objectContaining({ id: "unit-2", status: "vacant" }),
    ]);
    const unitSnap = await fakeDb.collection("units").doc("unit-1").get();
    expect(unitSnap.data()).toEqual(
      expect.objectContaining({
        status: "occupied",
        occupancyStatus: "occupied",
        currentTenantId: "tenant-1",
        currentLeaseId: leaseId,
        occupancySource: "canonical_lease",
      })
    );
  });

  it("returns 401 for activate when unauthorized", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const res = await request(app).post("/drafts/draft-missing/activate").send({});
    expect(res.status).toBe(401);
  });

  it("returns 404 when activating unknown draft", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const res = await request(app)
      .post("/drafts/draft-missing/activate")
      .set(auth)
      .send({});
    expect(res.status).toBe(404);
    expect(res.body?.error).toBe("draft_not_found");
  });

  it("returns 400 end_date_required when fixed term draft has no end date", async () => {
    const router = (await import("../leaseRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use(router);

    const draftId = "draft_fixed_missing_end";
    await fakeDb.collection("leaseDrafts").doc(draftId).set({
      ...payload,
      landlordId: "landlord-1",
      termType: "fixed",
      endDate: null,
      status: "generated",
      templateVersion: "ns-schedule-a-v1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const res = await request(app)
      .post(`/drafts/${encodeURIComponent(draftId)}/activate`)
      .set(auth)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("end_date_required");
  });
});
