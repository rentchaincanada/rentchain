import { beforeEach, describe, expect, it, vi } from "vitest";
import { leaseService } from "../../services/leaseService";

const getSignedDownloadUrlMock = vi.fn(async () => "https://signed.example.com/lease.pdf");
const sendEmailMock = vi.fn(async () => undefined);
const writeCanonicalEventMock = vi.fn(async () => undefined);

const { fakeDb, listDocs, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let idSeq = 0;

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
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
        const col = ensureCollection(name);
        const docs = Array.from(col.values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn), size: docs.length };
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
        return { id: actualId, exists: Boolean(entry), data: () => entry?.data };
      },
    };
  }

  return {
    resetFakeDb: () => {
      store.clear();
      idSeq = 0;
    },
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    listDocs: (name: string) => Array.from(ensureCollection(name).values()).map((doc) => ({ id: doc.id, data: doc.data })),
    fakeDb: {
      runTransaction: async (callback: any) =>
        callback({
          get: async (ref: any) => ref.get(),
          set: async (ref: any, value: any, options?: any) => ref.set(value, options),
        }),
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        orderBy: () => makeQuery(name),
        limit: () => makeQuery(name),
        get: async () => makeQuery(name).get(),
        doc: (id?: string) => makeDoc(name, id),
      }),
    },
  };
});

vi.mock("../../firebase", () => ({
  db: fakeDb,
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const header = String(req.headers?.["x-test-user"] || "").trim();
    req.user = header
      ? JSON.parse(header)
      : { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    if (req.user.role !== "landlord" && req.user.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    req.user.landlordId = req.user.landlordId || req.user.id;
    next();
  },
}));

vi.mock("../../services/leaseDraftsService", () => ({
  NS_PROVINCE: "NS",
  NS_TEMPLATE_VERSION: "ns-schedule-a-v1",
  applyPatch: vi.fn((existing: any) => existing),
  validateCreateInput: vi.fn(),
  getDraftById: vi.fn(),
  getSnapshotById: vi.fn(),
  generateScheduleA: vi.fn(),
}));

vi.mock("../../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: getSignedDownloadUrlMock,
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("../../lib/events/buildEvent", () => ({
  writeCanonicalEvent: writeCanonicalEventMock,
}));

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => true,
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
    const headers: Record<string, any> = {};
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      user: { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
    };
    const res: any = {
      statusCode: 200,
      setHeader: (key: string, value: any) => {
        headers[key.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("leaseRoutes GET /active", () => {
  beforeEach(() => {
    resetFakeDb();
    leaseService.getAll().splice(0);
    getSignedDownloadUrlMock.mockClear();
    sendEmailMock.mockClear();
    writeCanonicalEventMock.mockClear();
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";
    process.env.SIGNING_PROVIDER = "mock";
    process.env.PUBLIC_APP_URL = "http://localhost:5173";
  });

  it("requires landlord authority before generic lease and ledger handlers execute", async () => {
    const router = (await import("../leaseRoutes")).default;
    const tenantHeaders = {
      "x-test-user": JSON.stringify({ id: "tenant-1", tenantId: "tenant-1", role: "tenant" }),
    };
    const requests = [
      { method: "GET", url: "/" },
      { method: "POST", url: "/", body: { tenantId: "tenant-1", propertyId: "prop-1", unitNumber: "101", monthlyRent: 1000, startDate: "2026-01-01" } },
      { method: "PUT", url: "/lease-1", body: { monthlyRent: 1100 } },
      { method: "POST", url: "/lease-1/end", body: {} },
      { method: "GET", url: "/lease-1/ledger" },
      { method: "POST", url: "/lease-1/ledger/charge", body: { amountCents: 1000, date: "2026-01-01", type: "rent" } },
      { method: "POST", url: "/lease-1/ledger/payment", body: { amountCents: 1000, date: "2026-01-01", method: "cash" } },
      { method: "GET", url: "/lease-1/ledger/export.csv" },
      { method: "GET", url: "/lease-1/ledger/export.pdf" },
    ];

    for (const item of requests) {
      const res = await invokeRouter(router, { ...item, headers: tenantHeaders });
      expect(res.status).toBe(403);
    }
  });

  it("returns landlord-scoped active leases with tenant and document details", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View", province: "NS" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leaseDrafts", "draft-1", { landlordId: "landlord-1", lastGeneratedSnapshotId: "snapshot-1" });
    seedDoc("leaseSnapshots", "snapshot-1", {
      landlordId: "landlord-1",
      generatedFiles: [{ url: "https://files.example.com/lease.pdf" }],
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      dueDay: 1,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      tenantSignature: {
        signedAt: "2026-01-05T12:00:00.000Z",
        signatureMethod: "typed",
        signatureDisplayName: "Jane Tenant",
        drawnDataUrl: "data:image/png;base64,should-not-leak",
      },
      landlordSignature: {
        signedAt: "2026-01-05T13:00:00.000Z",
      },
      sourceDraftId: "draft-1",
      createdAt: 1,
      updatedAt: 2,
    });
    seedDoc("leases", "lease-2", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-2",
      unitNumber: "102",
      monthlyRent: 1500,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "ended",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.leases).toHaveLength(1);
    expect(res.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        id: "lease-1",
        propertyName: "Harbour View",
        tenantName: "Jane Tenant",
        tenantEmail: "jane@example.com",
        documentUrl: "https://files.example.com/lease.pdf",
        signatureStatus: "signed",
        signatureReadinessLabel: "Lease signing complete",
        tenantSignature: {
          signedAt: "2026-01-05T12:00:00.000Z",
          signatureMethod: "typed",
          signatureDisplayName: "Jane Tenant",
        },
        leasePdfStatus: "available",
        leaseExecution: expect.objectContaining({
          executionStatus: "fully_executed",
          executionLabel: "Lease fully executed",
          requiredNextAction: "none",
        }),
        paymentReadiness: expect.objectContaining({
          readinessStatus: "ready_to_configure",
          readinessLabel: "Rent terms ready for future setup",
          paymentSetup: {
            processorConnected: false,
            moneyMovementEnabled: false,
            storedPaymentMethod: false,
          },
        }),
        rentPaymentSummary: expect.objectContaining({
          paymentRail: {
            enabled: false,
            enabledAt: null,
            processor: null,
            blockedReason: null,
          },
          latestPayment: null,
          paymentExperience: {
            history: [],
            latestStatus: null,
            retryAvailable: false,
            receiptSummary: {
              available: false,
              label: "No payment summary available yet",
              amountCents: null,
              paidAt: null,
              leaseReference: null,
            },
          },
        }),
        stateCoherence: expect.objectContaining({
          coherenceStatus: "coherent",
          leaseExecutionState: "executed",
          leaseOperationalState: "active",
          occupancyState: "occupied",
          flags: expect.objectContaining({
            hasStateConflict: false,
            requiresReview: false,
          }),
        }),
        leaseLifecycleSummary: expect.objectContaining({
          lifecycleStatus: "active",
          lifecycleLabel: "Active",
          requiredNextAction: "none",
        }),
        jurisdictionProvince: "NS",
        jurisdictionPolicies: expect.arrayContaining([
          expect.objectContaining({
            jurisdiction: "NS",
            policyKey: "rent_increase_workflow_availability",
            legalAdvice: false,
          }),
        ]),
        derivedLifecycleState: "active",
        derivedLifecycleReasons: ["signed_current_term"],
        derivedLifecycleRequiresReview: false,
        derivedLifecycleIsCurrent: true,
        derivedLifecycleIsOccupancyActive: true,
      })
    );
    expect(res.body?.leases?.[0]?.tenantSignature?.drawnDataUrl).toBeUndefined();
    expect(res.body?.leases?.[0]?.paymentMethod).toBeUndefined();
  });

  it("does not project an active lease as signed without signature metadata", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leaseDrafts", "draft-1", { landlordId: "landlord-1", lastGeneratedSnapshotId: "snapshot-1" });
    seedDoc("leaseSnapshots", "snapshot-1", {
      landlordId: "landlord-1",
      generatedFiles: [{ url: "https://files.example.com/lease.pdf" }],
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      sourceDraftId: "draft-1",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(res.status).toBe(200);
    expect(res.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        signatureStatus: "not_started",
        signatureReadinessLabel: "Lease available",
        leaseExecution: expect.objectContaining({
          executionStatus: "draft",
          requiredNextAction: "complete_lease_details",
        }),
        stateCoherence: expect.objectContaining({
          coherenceStatus: "review_required",
          coherenceReason: "lease_status_active_but_execution_incomplete",
          leaseOperationalState: "draft",
          flags: expect.objectContaining({
            leaseMarkedActiveBeforeExecution: true,
          }),
        }),
      })
    );
  });

  it("refreshes storage-backed lease document URLs for landlord lease responses and explicit refresh requests", async () => {
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/fresh-list.pdf");
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/fresh-click.pdf");
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      documentUrl: "https://storage.googleapis.com/signed-expired.pdf",
      leaseDocument: {
        bucket: "lease-documents",
        path: "leases/landlord-1/lease-1/lease-v1.pdf",
        fileName: "lease-v1.pdf",
      },
    });

    const router = (await import("../leaseRoutes")).default;
    const listRes = await invokeRouter(router, { method: "GET", url: "/active" });
    expect(listRes.status).toBe(200);
    expect(listRes.body?.leases?.[0]?.documentUrl).toBe("https://signed.example.com/fresh-list.pdf");
    expect(JSON.stringify(listRes.body)).not.toContain("signed-expired.pdf");

    const refreshRes = await invokeRouter(router, { method: "GET", url: "/lease-1/document-url" });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toEqual(
      expect.objectContaining({
        ok: true,
        documentUrl: "https://signed.example.com/fresh-click.pdf",
        refreshMode: "signed_url",
        expiresInSeconds: 1800,
      })
    );
    expect(refreshRes.body?.documentRef).toEqual(
      expect.objectContaining({
        source: "leaseDocument",
        bucket: "lease-documents",
        path: "leases/landlord-1/lease-1/lease-v1.pdf",
        internalReferenceOnly: true,
      })
    );
    expect(getSignedDownloadUrlMock).toHaveBeenCalledWith({
      bucket: "lease-documents",
      path: "leases/landlord-1/lease-1/lease-v1.pdf",
      expiresMinutes: 30,
    });
    expect(JSON.stringify(refreshRes.body)).not.toContain("signed-expired.pdf");
  });

  it("refreshes legacy persisted GCS signed URLs instead of returning stale URLs", async () => {
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/fresh-legacy-list.pdf");
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/fresh-legacy-click.pdf");
    const staleUrl =
      "https://storage.googleapis.com/lease-documents/leases/landlord-1/lease-legacy/lease-v1.pdf?X-Goog-Expires=1&X-Goog-Signature=expired";
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Centre Suites" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Bailey Blinkers", email: "hello+central1@rentchain.ai" });
    seedDoc("leases", "lease-legacy", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      documentUrl: staleUrl,
    });

    const router = (await import("../leaseRoutes")).default;
    const listRes = await invokeRouter(router, { method: "GET", url: "/active" });
    expect(listRes.status).toBe(200);
    expect(listRes.body?.leases?.[0]?.documentUrl).toBe("https://signed.example.com/fresh-legacy-list.pdf");
    expect(JSON.stringify(listRes.body)).not.toContain(staleUrl);

    const refreshRes = await invokeRouter(router, { method: "GET", url: "/lease-legacy/document-url" });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toEqual(
      expect.objectContaining({
        ok: true,
        documentUrl: "https://signed.example.com/fresh-legacy-click.pdf",
        refreshMode: "signed_url",
      })
    );
    expect(refreshRes.body?.documentRef).toEqual(
      expect.objectContaining({
        source: "lease.documentUrl",
        bucket: "lease-documents",
        path: "leases/landlord-1/lease-legacy/lease-v1.pdf",
        internalReferenceOnly: true,
      })
    );
    expect(JSON.stringify(refreshRes.body)).not.toContain(staleUrl);
  });

  it("keeps Schedule A separate from the primary lease document action", async () => {
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/schedule-a-list.pdf");
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/schedule-a-click.pdf");
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Coburg Rd" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Chip Milo", email: "hello+cob6tenant@rentchain.ai" });
    seedDoc("leases", "lease-schedule-only", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      unitId: "unit-6",
      unitNumber: "6",
      monthlyRent: 1800,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      sourceDraftId: "draft-1",
    });
    seedDoc("leaseDrafts", "draft-1", { landlordId: "landlord-1", lastGeneratedSnapshotId: "snapshot-1" });
    seedDoc("leaseSnapshots", "snapshot-1", {
      landlordId: "landlord-1",
      generatedFiles: [
        {
          kind: "schedule-a-pdf",
          bucket: "lease-documents",
          path: "leases/landlord-1/draft-1/schedule-a-v1.pdf",
          url: "https://storage.googleapis.com/lease-documents/leases/landlord-1/draft-1/schedule-a-v1.pdf?X-Goog-Expires=1",
        },
      ],
    });

    const router = (await import("../leaseRoutes")).default;
    const listRes = await invokeRouter(router, { method: "GET", url: "/active" });
    expect(listRes.status).toBe(200);
    expect(listRes.body?.leases?.[0]?.documentUrl).toBeNull();
    expect(listRes.body?.leases?.[0]?.scheduleAUrl).toBe("https://signed.example.com/schedule-a-list.pdf");

    const primaryRes = await invokeRouter(router, { method: "GET", url: "/lease-schedule-only/document-url" });
    expect(primaryRes.status).toBe(404);
    expect(primaryRes.body?.error).toBe("lease_document_not_found");

    const scheduleRes = await invokeRouter(router, { method: "GET", url: "/lease-schedule-only/document-url?document=schedule-a" });
    expect(scheduleRes.status).toBe(200);
    expect(scheduleRes.body).toEqual(
      expect.objectContaining({
        ok: true,
        documentUrl: "https://signed.example.com/schedule-a-click.pdf",
        documentKind: "schedule-a",
      })
    );
    expect(scheduleRes.body?.documentRef).toEqual(
      expect.objectContaining({
        source: "leaseSnapshots/snapshot-1",
        bucket: "lease-documents",
        path: "leases/landlord-1/draft-1/schedule-a-v1.pdf",
        internalReferenceOnly: true,
      })
    );
  });

  it("prefers primary lease PDFs when both lease PDF and Schedule A are present", async () => {
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/lease-list.pdf");
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/schedule-a-list.pdf");
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/lease-click.pdf");
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/schedule-a-click.pdf");
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Coburg Rd" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Chip Milo", email: "hello+cob6tenant@rentchain.ai" });
    seedDoc("leases", "lease-both", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      unitId: "unit-6",
      unitNumber: "6",
      monthlyRent: 1800,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      sourceDraftId: "draft-both",
    });
    seedDoc("leaseDrafts", "draft-both", { landlordId: "landlord-1", lastGeneratedSnapshotId: "snapshot-both" });
    seedDoc("leaseSnapshots", "snapshot-both", {
      landlordId: "landlord-1",
      generatedFiles: [
        {
          kind: "lease-pdf",
          bucket: "lease-documents",
          path: "leases/landlord-1/draft-both/lease-v1.pdf",
          url: "https://storage.googleapis.com/lease-documents/leases/landlord-1/draft-both/lease-v1.pdf?X-Goog-Expires=1",
        },
        {
          kind: "schedule-a-pdf",
          bucket: "lease-documents",
          path: "leases/landlord-1/draft-both/schedule-a-v1.pdf",
          url: "https://storage.googleapis.com/lease-documents/leases/landlord-1/draft-both/schedule-a-v1.pdf?X-Goog-Expires=1",
        },
      ],
    });

    const router = (await import("../leaseRoutes")).default;
    const listRes = await invokeRouter(router, { method: "GET", url: "/active" });
    expect(listRes.status).toBe(200);
    expect(listRes.body?.leases?.[0]?.documentUrl).toBe("https://signed.example.com/lease-list.pdf");
    expect(listRes.body?.leases?.[0]?.scheduleAUrl).toBe("https://signed.example.com/schedule-a-list.pdf");

    const primaryRes = await invokeRouter(router, { method: "GET", url: "/lease-both/document-url" });
    expect(primaryRes.status).toBe(200);
    expect(primaryRes.body).toEqual(
      expect.objectContaining({
        documentUrl: "https://signed.example.com/lease-click.pdf",
        documentKind: "lease",
      })
    );

    const scheduleRes = await invokeRouter(router, { method: "GET", url: "/lease-both/document-url?document=schedule-a" });
    expect(scheduleRes.status).toBe(200);
    expect(scheduleRes.body).toEqual(
      expect.objectContaining({
        documentUrl: "https://signed.example.com/schedule-a-click.pdf",
        documentKind: "schedule-a",
      })
    );
  });

  it("keeps primary and Schedule A unavailable when no document metadata exists", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Coburg Rd" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Chip Milo", email: "hello+cob6tenant@rentchain.ai" });
    seedDoc("leases", "lease-no-doc", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      unitId: "unit-6",
      unitNumber: "6",
      monthlyRent: 1800,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const listRes = await invokeRouter(router, { method: "GET", url: "/active" });
    expect(listRes.status).toBe(200);
    expect(listRes.body?.leases?.[0]?.documentUrl).toBeNull();
    expect(listRes.body?.leases?.[0]?.scheduleAUrl).toBeNull();

    const primaryRes = await invokeRouter(router, { method: "GET", url: "/lease-no-doc/document-url" });
    expect(primaryRes.status).toBe(404);
    expect(primaryRes.body?.error).toBe("lease_document_not_found");

    const scheduleRes = await invokeRouter(router, { method: "GET", url: "/lease-no-doc/document-url?document=schedule-a" });
    expect(scheduleRes.status).toBe(404);
    expect(scheduleRes.body?.error).toBe("schedule_a_document_not_found");
  });

  it("does not use app-domain lease PDF paths as document URL fallback", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Coburg Rd" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Chip Milo", email: "hello+cob6tenant@rentchain.ai" });
    seedDoc("leases", "lease-app-domain", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      unitId: "unit-6",
      unitNumber: "6",
      monthlyRent: 1800,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      documentUrl: "https://preview.rentchain.ai/leases/PXbRIbJdZpV2eBjzNmLaISgDa852/nkzRYxdZ49p0IGdXD3mS/schedule-a-v1.pdf",
    });

    const router = (await import("../leaseRoutes")).default;
    const listRes = await invokeRouter(router, { method: "GET", url: "/active" });
    expect(listRes.status).toBe(200);
    expect(listRes.body?.leases?.[0]?.documentUrl).toBeNull();

    const refreshRes = await invokeRouter(router, { method: "GET", url: "/lease-app-domain/document-url" });
    expect(refreshRes.status).toBe(404);
    expect(JSON.stringify(refreshRes.body)).not.toContain("/leases/PXbRIbJdZpV2eBjzNmLaISgDa852");
  });

  it("surfaces ledger payment activity separately from provider payment setup", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", status: "active" });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "occupied",
      occupancyStatus: "occupied",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      dueDay: 1,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      tenantSignature: { signedAt: "2026-01-05T12:00:00.000Z" },
      landlordSignature: { signedAt: "2026-01-05T13:00:00.000Z" },
      createdAt: 1,
      updatedAt: 2,
    });
    seedDoc("ledgerEntries", "ledger-payment-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "payment",
      amountCents: 15000,
      effectiveDate: "2026-05-15",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(res.status).toBe(200);
    expect(res.body?.leases?.[0]?.stateCoherence).toEqual(
      expect.objectContaining({
        paymentReadinessState: "recorded_activity_present",
        coherenceReason: "ledger_payment_activity_without_provider_payment_setup",
        flags: expect.objectContaining({
          paymentActivityWithoutProviderSetup: true,
          requiresReview: true,
        }),
      })
    );
  });

  it("sends a non-blocking lease available email after creating a persisted lease", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-1", unitNumber: "101", status: "vacant", occupancyStatus: "vacant" }],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/",
      body: {
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitNumber: "101",
        monthlyRent: 1850,
        startDate: "2026-05-01",
        endDate: "2027-04-30",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.leaseNotification).toEqual(expect.objectContaining({ attempted: true, sent: true }));
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        subject: "Lease available in RentChain",
      })
    );
  });

  it("does not send lease creation email when recipient context is missing", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-1", unitNumber: "101", status: "vacant", occupancyStatus: "vacant" }],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant" });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/",
      body: {
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitNumber: "101",
        monthlyRent: 1850,
        startDate: "2026-05-01",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.leaseNotification).toEqual(
      expect.objectContaining({ attempted: false, sent: false, reason: "tenant_email_missing" })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends a lease signing request for a landlord-scoped lease and records governed signing events", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      documentUrl: "https://files.example.com/lease-1.pdf",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/send-for-signature",
      body: { tenantEmails: ["tenant@example.com"], message: "Please sign." },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data).toEqual(
      expect.objectContaining({
        signingStatus: "pending_signature",
        signingProviderId: "mock",
        derivedLeaseState: "pending_signature",
      })
    );

    const requests = listDocs("leaseSigningRequests");
    expect(requests).toHaveLength(1);
    expect(requests[0].data).toEqual(
      expect.objectContaining({
        leaseId: "lease-1",
        landlordId: "landlord-1",
        providerId: "mock",
        documentUrl: "https://files.example.com/lease-1.pdf",
        rawIdsIncluded: false,
        payloadIncluded: false,
      })
    );
    expect(requests[0].data.tenantEmailHashes).toHaveLength(1);
    expect(requests[0].data.providerRequestRef).toMatch(/^mock_ref_/);
    expect(requests[0].data.providerRequestRef).not.toContain("lease-1");

    const events = listDocs("leaseSigningEvents");
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual(
      expect.objectContaining({
        leaseId: "lease-1",
        landlordId: "landlord-1",
        providerId: "mock",
        type: "sent",
        actorRole: "landlord",
      })
    );
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signing_sent",
        actor: expect.objectContaining({ role: "landlord", type: "landlord" }),
        resource: { id: "lease-1", type: "lease" },
        status: "sent",
      })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejects invalid lease signing recipients without dispatching or writing events", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      status: "active",
      documentUrl: "https://files.example.com/lease-1.pdf",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/send-for-signature",
      body: { tenantEmails: ["not-an-email"] },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "invalid_tenant_email" });
    expect(listDocs("leaseSigningRequests")).toHaveLength(0);
    expect(listDocs("leaseSigningEvents")).toHaveLength(0);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("prevents tenants and other landlords from submitting lease signing requests", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      status: "active",
      documentUrl: "https://files.example.com/lease-1.pdf",
    });
    const router = (await import("../leaseRoutes")).default;

    const tenantRes = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/send-for-signature",
      headers: { "x-test-user": JSON.stringify({ id: "tenant-1", tenantId: "tenant-1", role: "tenant" }) },
      body: { tenantEmails: ["tenant@example.com"] },
    });
    expect(tenantRes.status).toBe(403);

    const otherLandlordRes = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/send-for-signature",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-2", landlordId: "landlord-2", role: "landlord" }) },
      body: { tenantEmails: ["tenant@example.com"] },
    });
    expect(otherLandlordRes.status).toBe(403);
    expect(otherLandlordRes.body).toEqual({ ok: false, error: "forbidden" });
    expect(listDocs("leaseSigningRequests")).toHaveLength(0);
    expect(listDocs("leaseSigningEvents")).toHaveLength(0);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("returns landlord lease payment history and no landlord actions from the lease payment status route", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      dueDay: 1,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      paymentRailEnabled: true,
      paymentRailEnabledAt: "2026-04-27T10:00:00.000Z",
      paymentRailProcessor: "stripe",
      createdAt: 1,
      updatedAt: 2,
    });
    seedDoc("rentPayments", "rp-1", {
      id: "rp-1",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      amountCents: 185000,
      currency: "cad",
      status: "payment_pending",
      processor: "stripe",
      processorCheckoutSessionId: "cs_1",
      processorPaymentIntentId: "pi_1",
      createdAt: "2026-04-28T10:00:00.000Z",
      updatedAt: "2026-04-28T10:01:00.000Z",
      paidAt: null,
    });
    seedDoc("rentPayments", "rp-2", {
      id: "rp-2",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      amountCents: 185000,
      currency: "cad",
      status: "paid",
      processor: "stripe",
      processorCheckoutSessionId: "cs_2",
      processorPaymentIntentId: "pi_2",
      createdAt: "2026-04-27T10:00:00.000Z",
      updatedAt: "2026-04-27T10:02:00.000Z",
      paidAt: "2026-04-27T10:02:00.000Z",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/lease-1/payments" });

    expect(res.status).toBe(200);
    expect(res.body?.data?.paymentExperience?.history).toHaveLength(2);
    expect(res.body?.data?.paymentExperience?.latestStatus).toBe("pending");
    expect(res.body?.data?.paymentExperience?.retryAvailable).toBe(false);
    expect(JSON.stringify(res.body?.data || {})).not.toContain("receipt_url");
  });

  it("excludes targeted synthetic cleanup leases from landlord active lists", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant" });
    seedDoc("leases", "test_lease_quit_01", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: 2,
      updatedAt: 2,
    });
    seedDoc("leases", "lease-visible", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      primaryTenantId: "tenant-1",
      unitId: "unit-2",
      unitNumber: "102",
      monthlyRent: 1900,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      createdAt: 3,
      updatedAt: 3,
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(res.status).toBe(200);
    expect(res.body?.leases.map((lease: { id: string }) => lease.id)).toEqual(["lease-visible"]);
  });

  it("marks a direct created active lease unit occupied in embedded and standalone storage", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [
        { id: "unit-1", unitNumber: "101", status: "vacant", occupancyStatus: "vacant" },
        { id: "unit-2", unitNumber: "102", status: "vacant", occupancyStatus: "vacant" },
      ],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      label: "Unit 101",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("tenants", "tenant-1", {
      landlordId: "landlord-1",
      fullName: "Jane Tenant",
      email: "jane@example.com",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/",
      body: {
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitNumber: "unit-1",
        monthlyRent: 1850,
        startDate: "2026-01-01",
      },
    });

    expect(res.status).toBe(201);
    const leaseId = String(res.body?.lease?.id || "");
    expect(leaseId).toBeTruthy();
    expect(res.body?.lease).toEqual(
      expect.objectContaining({
        unitId: "unit-1",
        unitNumber: "101",
        unitLabel: "101",
      })
    );

    const leaseSnap = await fakeDb.collection("leases").doc(leaseId).get();
    expect(leaseSnap.data()).toEqual(
      expect.objectContaining({
        unitId: "unit-1",
        unitNumber: "101",
        unitLabel: "101",
      })
    );

    const summaryRes = await invokeRouter(router, { method: "GET", url: `/${leaseId}` });
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body?.lease).toEqual(
      expect.objectContaining({
        unitId: "unit-1",
        unitNumber: "101",
        unitLabel: "101",
      })
    );
    expect(JSON.stringify(summaryRes.body?.lease || {})).not.toContain("Unit unit-1");

    const tenantLeasesRes = await invokeRouter(router, { method: "GET", url: "/tenant/tenant-1" });
    expect(tenantLeasesRes.status).toBe(200);
    expect(tenantLeasesRes.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        unitId: "unit-1",
        unitNumber: "101",
        unitLabel: "101",
      })
    );

    const propertySnap = await fakeDb.collection("properties").doc("prop-1").get();
    expect(propertySnap.data()?.units).toEqual([
      expect.objectContaining({
        id: "unit-1",
        status: "occupied",
        occupancyStatus: "occupied",
        currentTenantId: "tenant-1",
        currentLeaseId: leaseId,
        tenantName: "Jane Tenant",
        tenantFullName: "Jane Tenant",
        currentTenantName: "Jane Tenant",
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
        tenantName: "Jane Tenant",
        tenantFullName: "Jane Tenant",
        currentTenantName: "Jane Tenant",
        occupancySource: "canonical_lease",
      })
    );
  });

  it("does not block direct lease creation when occupancy sync cannot find a unit", async () => {
    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/",
      body: {
        tenantId: "tenant-1",
        propertyId: "prop-missing",
        unitNumber: "unit-missing",
        monthlyRent: 1850,
        startDate: "2026-01-01",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.lease?.id).toBeTruthy();
  });

  it("hydrates property lease rows with canonical unit labels for display", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-raw-id-123456", unitNumber: "101", label: "Unit 101", status: "occupied" }],
    });
    seedDoc("units", "unit-raw-id-123456", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      label: "Unit 101",
      status: "occupied",
      occupancyStatus: "occupied",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-raw-id-123456",
      unitNumber: "unit-raw-id-123456",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/property/prop-1" });

    expect(res.status).toBe(200);
    expect(res.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        unitId: "unit-raw-id-123456",
        unitNumber: "101",
        unitLabel: "101",
      })
    );
  });

  it("enables rent collection for an owned eligible lease", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      dueDay: 1,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/payment-rails/enable",
      body: {},
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: {
        leaseId: "lease-1",
        paymentRail: {
          enabled: true,
          enabledAt: expect.any(String),
          processor: "stripe",
          eligibility: "eligible",
          blockedReason: null,
        },
      },
    });

    const storedLease = await fakeDb.collection("leases").doc("lease-1").get();
    expect(storedLease.data()).toEqual(
      expect.objectContaining({
        paymentRailEnabled: true,
        paymentRailEnabledAt: expect.any(String),
        paymentRailProcessor: "stripe",
      })
    );
  });

  it("returns safe blocked detail for an ineligible lease payment rail", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      dueDay: null,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/payment-rails/enable",
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: "LEASE_PAYMENT_RAIL_INELIGIBLE",
      detail: "payment_readiness_not_ready",
    });
  });

  it("returns landlord payment status summary for a lease", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      dueDay: 1,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      paymentRailEnabled: true,
      paymentRailEnabledAt: "2026-04-27T10:00:00.000Z",
      paymentRailProcessor: "stripe",
    });
    seedDoc("rentPayments", "rp-1", {
      id: "rp-1",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      amountCents: 185000,
      currency: "cad",
      status: "paid",
      processor: "stripe",
      createdAt: "2026-04-27T10:05:00.000Z",
      updatedAt: "2026-04-27T10:06:00.000Z",
      paidAt: "2026-04-27T10:06:00.000Z",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/lease-1/payments",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: {
        paymentRail: {
          enabled: true,
          enabledAt: "2026-04-27T10:00:00.000Z",
          processor: "stripe",
          blockedReason: null,
        },
        latestPayment: {
          id: "rp-1",
          paymentIntentId: null,
          amountCents: 185000,
          currency: "cad",
          status: "paid",
          createdAt: "2026-04-27T10:05:00.000Z",
          updatedAt: "2026-04-27T10:06:00.000Z",
          paidAt: "2026-04-27T10:06:00.000Z",
        },
        paymentExperience: {
          history: [
            {
              id: "rp-1",
              paymentIntentId: null,
              amountCents: 185000,
              currency: "cad",
              status: "paid",
              createdAt: "2026-04-27T10:05:00.000Z",
              updatedAt: "2026-04-27T10:06:00.000Z",
              paidAt: "2026-04-27T10:06:00.000Z",
            },
          ],
          latestStatus: "paid",
          retryAvailable: false,
          receiptSummary: {
            available: true,
            label: "Payment summary available",
            amountCents: 185000,
            paidAt: "2026-04-27T10:06:00.000Z",
            leaseReference: "lease-1",
          },
        },
      },
    });
  });

  it("records lease payments as linked canonical payments and immutable ledger entries", async () => {
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      dueDay: 1,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/ledger/payment",
      body: {
        amountCents: 185000,
        date: "2026-05-14",
        method: "etransfer",
        reference: "May rent",
        notes: "Received in full",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.ok).toBe(true);
    expect(res.headers["x-route-source"]).toBe("leaseRoutes.ts");
    expect(res.headers["x-lease-payment-write-version"]).toBe("canonical-payments-ledger-link-v1");
    expect(res.body?.routeSource).toBe("leaseRoutes.ts");
    expect(res.body?.writeVersion).toBe("canonical-payments-ledger-link-v1");

    const paymentsSnap = await fakeDb.collection("payments").get();
    const ledgerSnap = await fakeDb.collection("ledgerEntries").get();
    expect(paymentsSnap.docs).toHaveLength(1);
    expect(ledgerSnap.docs).toHaveLength(1);

    const paymentDoc = paymentsSnap.docs[0];
    const ledgerDoc = ledgerSnap.docs[0];
    const payment = paymentDoc.data();
    const entry = ledgerDoc.data();

    expect(paymentDoc.id).toBe(res.body.payment.id);
    expect(ledgerDoc.id).toBe(res.body.entry.id);
    expect(payment).toEqual(
      expect.objectContaining({
        id: paymentDoc.id,
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        amount: 1850,
        amountCents: 185000,
        method: "etransfer",
        paidAt: "2026-05-14",
        effectiveDate: "2026-05-14",
        status: "recorded",
        ledgerEntryId: ledgerDoc.id,
        createdBy: "landlord-1",
      })
    );
    expect(entry).toEqual(
      expect.objectContaining({
        id: ledgerDoc.id,
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        leaseId: "lease-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        entryType: "payment",
        category: "payment",
        amountCents: 185000,
        effectiveDate: "2026-05-14",
        method: "etransfer",
        paymentDocumentId: paymentDoc.id,
        createdBy: "landlord-1",
      })
    );
  });

  it("reconciles the affected property unit to vacant when ending a lease", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [
        { id: "unit-1", unitNumber: "101", status: "occupied" },
        { id: "unit-2", unitNumber: "102", status: "occupied" },
      ],
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: null,
      status: "active",
      createdAt: 1,
      updatedAt: 2,
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "occupied",
      occupancyStatus: "occupied",
      tenantId: "tenant-1",
      currentTenantId: "tenant-1",
      leaseId: "lease-1",
      currentLeaseId: "lease-1",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/end", body: {} });

    expect(res.status).toBe(200);
    const propertySnap = await fakeDb.collection("properties").doc("prop-1").get();
    expect(propertySnap.data()?.units).toEqual([
      expect.objectContaining({ id: "unit-1", unitNumber: "101", status: "vacant" }),
      expect.objectContaining({ id: "unit-2", unitNumber: "102", status: "occupied" }),
    ]);
    const unitSnap = await fakeDb.collection("units").doc("unit-1").get();
    expect(unitSnap.data()).toEqual(
      expect.objectContaining({
        status: "vacant",
        occupancyStatus: "vacant",
        tenantId: null,
        currentTenantId: null,
        leaseId: null,
        currentLeaseId: null,
        occupancySource: "lease_end",
      })
    );
  });

  it("restores an ended firestore lease and marks the matched unit occupied", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [
        { id: "unit-1", unitNumber: "101", status: "vacant" },
        { id: "unit-2", unitNumber: "102", status: "vacant" },
      ],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      label: "Unit 101",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("units", "unit-2", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "102",
      label: "Unit 102",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-04-01",
      status: "ended",
      createdAt: 1,
      updatedAt: 2,
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/restore-active", body: {} });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      lease: expect.objectContaining({
        id: "lease-1",
        status: "active",
        endDate: null,
      }),
    });

    const leaseSnap = await fakeDb.collection("leases").doc("lease-1").get();
    expect(leaseSnap.data()).toEqual(
      expect.objectContaining({
        status: "active",
        endDate: null,
        updatedAt: expect.any(String),
      })
    );

    const propertySnap = await fakeDb.collection("properties").doc("prop-1").get();
    expect(propertySnap.data()?.units).toEqual([
      expect.objectContaining({ id: "unit-1", unitNumber: "101", status: "occupied" }),
      expect.objectContaining({ id: "unit-2", unitNumber: "102", status: "vacant" }),
    ]);

    const unitSnap = await fakeDb.collection("units").doc("unit-1").get();
    expect(unitSnap.data()).toEqual(
      expect.objectContaining({
        status: "occupied",
        occupancyStatus: "occupied",
        updatedAt: expect.any(String),
      })
    );
  });

  it("fails to restore a lease unless it is currently ended", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-1", unitNumber: "101", status: "occupied" }],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "occupied",
      occupancyStatus: "occupied",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: null,
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/restore-active", body: {} });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: "lease_restore_requires_ended_status" });
  });

  it("fails to restore when another active lease already exists for the same unit", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-1", unitNumber: "101", status: "vacant" }],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("leases", "lease-ended", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-04-01",
      status: "ended",
    });
    seedDoc("leases", "lease-active", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-2",
      tenantIds: ["tenant-2"],
      primaryTenantId: "tenant-2",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1900,
      startDate: "2026-04-02",
      endDate: null,
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-ended/restore-active", body: {} });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      ok: false,
      error: "conflicting_active_lease_agreement",
      conflictLeaseIds: ["lease-active"],
    });

    const propertySnap = await fakeDb.collection("properties").doc("prop-1").get();
    expect(propertySnap.data()?.units).toEqual([
      expect.objectContaining({ id: "unit-1", unitNumber: "101", status: "vacant" }),
    ]);
  });

  it("fails to restore when no canonical unit match exists", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-2", unitNumber: "102", status: "vacant" }],
    });
    seedDoc("units", "unit-2", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "102",
      label: "Unit 102",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-04-01",
      status: "ended",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/restore-active", body: {} });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      ok: false,
      error: "lease_restore_unit_reconciliation_failed",
    });

    const leaseSnap = await fakeDb.collection("leases").doc("lease-1").get();
    expect(leaseSnap.data()).toEqual(
      expect.objectContaining({
        status: "ended",
        endDate: "2026-04-01",
      })
    );
  });

  it("restores by canonical unitId even when embedded property units do not match", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-x", unitNumber: "999", status: "vacant" }],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      label: "Unit 101",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-04-01",
      status: "ended",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/restore-active", body: {} });

    expect(res.status).toBe(200);

    const propertySnap = await fakeDb.collection("properties").doc("prop-1").get();
    expect(propertySnap.data()?.units).toEqual([
      expect.objectContaining({ id: "unit-x", unitNumber: "999", status: "vacant" }),
    ]);
    const unitSnap = await fakeDb.collection("units").doc("unit-1").get();
    expect(unitSnap.data()).toEqual(
      expect.objectContaining({
        status: "occupied",
        occupancyStatus: "occupied",
      })
    );
  });

  it("restores by unique normalized unit label when unitId is missing", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ unitNumber: "3", label: "Unit 3", status: "vacant" }],
    });
    seedDoc("units", "unit-3", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "3",
      label: "Unit 3",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "",
      unitNumber: "Unit 3",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-04-01",
      status: "ended",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/restore-active", body: {} });

    expect(res.status).toBe(200);
    const unitSnap = await fakeDb.collection("units").doc("unit-3").get();
    expect(unitSnap.data()).toEqual(
      expect.objectContaining({
        status: "occupied",
        occupancyStatus: "occupied",
      })
    );
    const propertySnap = await fakeDb.collection("properties").doc("prop-1").get();
    expect(propertySnap.data()?.units).toEqual([
      expect.objectContaining({ unitNumber: "3", label: "Unit 3", status: "occupied" }),
    ]);
  });

  it("fails to restore when canonical fallback matching is ambiguous", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [],
    });
    seedDoc("units", "unit-3a", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "3",
      label: "Unit 3",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("units", "unit-3b", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "Unit 3",
      label: "3",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "",
      unitNumber: "3",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-04-01",
      status: "ended",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/restore-active", body: {} });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: "lease_restore_unit_reconciliation_failed" });

    const leaseSnap = await fakeDb.collection("leases").doc("lease-1").get();
    expect(leaseSnap.data()).toEqual(expect.objectContaining({ status: "ended" }));
    expect((await fakeDb.collection("units").doc("unit-3a").get()).data()).toEqual(
      expect.objectContaining({ status: "vacant", occupancyStatus: "vacant" })
    );
    expect((await fakeDb.collection("units").doc("unit-3b").get()).data()).toEqual(
      expect.objectContaining({ status: "vacant", occupancyStatus: "vacant" })
    );
  });

  it("patches embedded property units only when a single exact embedded match exists", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [
        { id: "unit-1", unitNumber: "101", status: "vacant" },
        { id: "unit-dup", unitNumber: "102", status: "vacant" },
      ],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      label: "Unit 101",
      status: "vacant",
      occupancyStatus: "vacant",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-1",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-04-01",
      status: "ended",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/restore-active", body: {} });

    expect(res.status).toBe(200);
    const propertySnap = await fakeDb.collection("properties").doc("prop-1").get();
    expect(propertySnap.data()?.units).toEqual([
      expect.objectContaining({ id: "unit-1", unitNumber: "101", status: "occupied" }),
      expect.objectContaining({ id: "unit-dup", unitNumber: "102", status: "vacant" }),
    ]);
  });
});
