import { beforeEach, describe, expect, it, vi } from "vitest";
import { leaseService } from "../../services/leaseService";

const getSignedDownloadUrlMock = vi.fn(async () => "https://signed.example.com/lease.pdf");
const sendEmailMock = vi.fn(async () => undefined);
const writeCanonicalEventMock = vi.fn(async () => undefined);
const getPrimaryLeaseDocumentSummaryMock = vi.fn(async () => null);
const generatePrimaryLeaseDocumentMock = vi.fn();
const lockPrimaryLeaseDocumentForSigningMock = vi.fn();

const { clearWriteLog, fakeDb, listDocs, resetFakeDb, seedDoc, writeLog } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  const writes: Array<{ collection: string; id: string }> = [];
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
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data, ref: makeDoc(name, doc.id) }));
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
        writes.push({ collection: name, id: actualId });
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
      writes.splice(0);
      idSeq = 0;
    },
    clearWriteLog: () => writes.splice(0),
    writeLog: writes,
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    listDocs: (name: string) => Array.from(ensureCollection(name).values()).map((doc) => ({ id: doc.id, data: doc.data })),
    fakeDb: {
      runTransaction: async (callback: any) =>
        callback({
          get: async (ref: any) => ref.get(),
          create: async (ref: any, value: any) => ref.set(value),
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

vi.mock("../../services/leaseDocuments/leaseDocumentService", () => ({
  getPrimaryLeaseDocumentSummary: getPrimaryLeaseDocumentSummaryMock,
  generatePrimaryLeaseDocument: generatePrimaryLeaseDocumentMock,
  lockPrimaryLeaseDocumentForSigning: lockPrimaryLeaseDocumentForSigningMock,
}));

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => true,
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  user?: any;
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
      user: Object.prototype.hasOwnProperty.call(options, "user")
        ? options.user
        : { id: "landlord-1", landlordId: "landlord-1", role: "landlord" },
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
    getPrimaryLeaseDocumentSummaryMock.mockReset();
    getPrimaryLeaseDocumentSummaryMock.mockResolvedValue(null);
    generatePrimaryLeaseDocumentMock.mockReset();
    lockPrimaryLeaseDocumentForSigningMock.mockReset();
    lockPrimaryLeaseDocumentForSigningMock.mockRejectedValue(Object.assign(new Error("signing_document_url_required"), { status: 400 }));
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";
    process.env.JWT_SECRET = "test-secret";
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

  it("keeps pending-signing leases out of current leases while making them discoverable for signing", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View", province: "NS" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Pending Tenant", email: "pending@example.invalid" });
    seedDoc("leases", "lease-current-pending", {
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
      status: "pending",
      executionStatus: "draft",
      signingStatus: "not_started",
    });
    seedDoc("leases", "lease-future-pending", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      unitId: "unit-future",
      unitNumber: "103",
      monthlyRent: 1950,
      startDate: "2099-01-01",
      endDate: "2099-12-31",
      status: "pending",
      executionStatus: "draft",
      signingStatus: "not_started",
    });
    seedDoc("leases", "lease-active", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-2",
      unitId: "unit-2",
      unitNumber: "102",
      monthlyRent: 1750,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
    });
    seedDoc("leases", "lease-other-landlord-pending", {
      landlordId: "landlord-2",
      propertyId: "prop-2",
      status: "pending",
    });

    const router = (await import("../leaseRoutes")).default;
    const pendingRes = await invokeRouter(router, { method: "GET", url: "/pending-signing" });
    const activeRes = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body?.leases).toHaveLength(2);
    expect(pendingRes.body?.leases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "lease-current-pending",
        status: "pending",
        tenantName: "Pending Tenant",
        leaseExecution: expect.objectContaining({ executionStatus: "draft" }),
      }),
      expect.objectContaining({
        id: "lease-future-pending",
        status: "pending",
        startDate: "2099-01-01",
        leaseExecution: expect.objectContaining({ executionStatus: "draft" }),
      }),
    ]));
    expect(activeRes.status).toBe(200);
    expect(activeRes.body?.leases.map((lease: any) => lease.id)).toEqual(["lease-active"]);
  });

  it("returns lifecycle summary on landlord-scoped single lease detail responses", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View", province: "NS" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
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
      nextNoticeDueAt: "2099-10-01T00:00:00.000Z",
      createdAt: 1,
      updatedAt: 2,
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/lease-1" });

    expect(res.status).toBe(200);
    expect(res.body?.lease).toEqual(
      expect.objectContaining({
        id: "lease-1",
        propertyName: "Harbour View",
        tenantName: "Jane Tenant",
        leaseLifecycleSummary: expect.objectContaining({
          lifecycleStatus: "active",
          lifecycleLabel: "Active",
          requiredNextAction: "none",
          daysUntilExpiry: expect.any(Number),
        }),
        jurisdictionProvince: "NS",
        jurisdictionPolicies: expect.arrayContaining([
          expect.objectContaining({
            jurisdiction: "NS",
            legalAdvice: false,
          }),
        ]),
      })
    );
    expect(res.body?.lease?.leaseLifecycleSummary?.daysUntilExpiry).toBeGreaterThan(0);
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
        signatureReadinessLabel: "Lease signing not started",
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

  it("keeps a canonically executed linked lease coherent when signing artifacts are absent", async () => {
    seedDoc("properties", "prop-link", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-link", {
      landlordId: "landlord-1",
      fullName: "Linked Tenant",
      propertyId: "prop-link",
      unitId: "unit-link",
      currentLeaseId: "lease-link",
      status: "Current",
    });
    seedDoc("units", "unit-link", {
      landlordId: "landlord-1",
      propertyId: "prop-link",
      unitNumber: "101",
      status: "occupied",
      occupancyStatus: "occupied",
      tenantId: "tenant-link",
      currentTenantId: "tenant-link",
      leaseId: "lease-link",
      currentLeaseId: "lease-link",
    });
    seedDoc("leases", "lease-link", {
      landlordId: "landlord-1",
      propertyId: "prop-link",
      tenantId: "tenant-link",
      tenantIds: ["tenant-link"],
      primaryTenantId: "tenant-link",
      unitId: "unit-link",
      unitNumber: "101",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2099-12-31",
      status: "active",
      executionStatus: "fully_executed",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(res.status).toBe(200);
    expect(res.body?.leases?.[0]).toEqual(expect.objectContaining({
      id: "lease-link",
      canonicalState: expect.objectContaining({
        occupancyState: "occupied",
        tenantRelationshipState: "current_occupant",
        supportingLeaseId: "lease-link",
      }),
      leaseExecution: expect.objectContaining({ executionStatus: "fully_executed" }),
      stateCoherence: expect.objectContaining({
        coherenceStatus: "coherent",
        leaseOperationalState: "active",
        occupancyState: "occupied",
        flags: expect.objectContaining({ requiresReview: false }),
      }),
    }));
  });

  it("projects generated primary lease document availability from leaseDocuments metadata", async () => {
    getPrimaryLeaseDocumentSummaryMock.mockResolvedValueOnce({
      id: "ldoc_generated",
      leaseId: "lease-primary-doc",
      landlordId: "landlord-1",
      documentType: "primary_lease",
      jurisdictionCode: "CA_NS",
      templateVersion: "ca-ns-primary-lease-draft-v1",
      counselReviewStatus: "draft",
      status: "generated",
      documentHash: "doc_hash_generated",
      manifestHash: "manifest_hash_generated",
      storageRef: null,
      previewUrl: "https://signed.example.com/primary-generated-preview.pdf",
    });
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View", province: "NS" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leases", "lease-primary-doc", {
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
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(res.status).toBe(200);
    expect(res.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        documentUrl: "https://signed.example.com/primary-generated-preview.pdf",
        leasePdfStatus: "available",
        leasePdfLabel: "Lease document available",
        signatureStatus: "not_started",
        leaseExecution: expect.objectContaining({
          executionStatus: "draft",
          pdfStatus: "generated",
        }),
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("lease-documents/");
  });

  it("projects pending signature state from the current signing request", async () => {
    getPrimaryLeaseDocumentSummaryMock.mockResolvedValueOnce({
      id: "ldoc_pending",
      leaseId: "lease-pending-signature",
      landlordId: "landlord-1",
      documentType: "primary_lease",
      jurisdictionCode: "CA_NS",
      templateVersion: "ca-ns-primary-lease-draft-v1",
      counselReviewStatus: "draft",
      status: "locked",
      documentHash: "doc_hash_pending",
      manifestHash: "manifest_hash_pending",
      storageRef: null,
      previewUrl: "https://signed.example.com/primary-pending-preview.pdf",
    });
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View", province: "NS" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leases", "lease-pending-signature", {
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
    });
    seedDoc("leaseSigningRequests", "request-pending", {
      leaseId: "lease-pending-signature",
      landlordId: "landlord-1",
      currentSigningStatus: "pending_signature",
      currentStatusAt: "2026-01-02T12:00:00.000Z",
      sentAt: "2026-01-02T12:00:00.000Z",
      documentId: "ldoc_pending",
      documentHash: "doc_hash_pending",
      manifestHash: "manifest_hash_pending",
      jurisdictionCode: "CA_NS",
      templateVersion: "ca-ns-primary-lease-draft-v1",
      providerDispatchMode: "sandbox",
      providerDispatchStatus: "accepted",
      providerTestMode: true,
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(res.status).toBe(200);
    expect(res.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        signatureStatus: "awaiting_tenant_signature",
        signatureReadinessLabel: "Awaiting tenant signature",
        leaseExecution: expect.objectContaining({
          executionStatus: "ready_for_tenant_signature",
          executionLabel: "Waiting for tenant signature",
          requiredNextAction: "tenant_signature",
        }),
        stateCoherence: expect.objectContaining({
          leaseOperationalState: "pending_execution",
          flags: expect.objectContaining({
            leaseMarkedActiveBeforeExecution: true,
          }),
        }),
      })
    );
  });

  it("projects signed provider lifecycle and Form P rent terms from the primary document", async () => {
    getPrimaryLeaseDocumentSummaryMock.mockResolvedValueOnce({
      id: "ldoc_signed",
      leaseId: "lease-signed-provider",
      landlordId: "landlord-1",
      documentType: "primary_lease",
      jurisdictionCode: "CA_NS",
      templateVersion: "ca-ns-primary-lease-draft-v1",
      counselReviewStatus: "draft",
      status: "locked",
      documentHash: "doc_hash_signed",
      manifestHash: "manifest_hash_signed",
      storageRef: null,
      previewUrl: "https://signed.example.com/primary-signed-preview.pdf",
      formPFields: {
        rent_payments: {
          due_day: {
            label: "Due day",
            status: "provided",
            value: 1,
          },
        },
      },
    });
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View", province: "NS" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leases", "lease-signed-provider", {
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
    });
    seedDoc("leaseSigningRequests", "request-signed", {
      leaseId: "lease-signed-provider",
      landlordId: "landlord-1",
      currentSigningStatus: "signed",
      currentStatusAt: "2026-01-03T12:00:00.000Z",
      sentAt: "2026-01-02T12:00:00.000Z",
      documentId: "ldoc_signed",
      documentHash: "doc_hash_signed",
      manifestHash: "manifest_hash_signed",
      jurisdictionCode: "CA_NS",
      templateVersion: "ca-ns-primary-lease-draft-v1",
      providerAccessUrlExpiresAt: "2026-01-02T16:00:00.000Z",
      providerDispatchMode: "sandbox",
      providerDispatchStatus: "accepted",
      providerTestMode: true,
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/active" });

    expect(res.status).toBe(200);
    expect(res.body?.leases?.[0]).toEqual(
      expect.objectContaining({
        signatureStatus: "signed",
        signatureReadinessLabel: "Lease signing complete",
        leaseExecution: expect.objectContaining({
          executionStatus: "fully_executed",
          executionLabel: "Lease fully executed",
          requiredNextAction: "none",
          completedAt: "2026-01-03T12:00:00.000Z",
        }),
        stateCoherence: expect.objectContaining({
          coherenceStatus: "coherent",
          leaseExecutionState: "executed",
          leaseOperationalState: "active",
          flags: expect.objectContaining({
            leaseMarkedActiveBeforeExecution: false,
            requiresReview: false,
          }),
        }),
        paymentReadiness: expect.objectContaining({
          readinessStatus: "ready_to_configure",
          rentTerms: expect.objectContaining({
            dueDateAvailable: true,
            leaseExecuted: true,
          }),
        }),
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("providerRequestId");
    expect(JSON.stringify(res.body)).not.toContain("X-Goog-Signature");
    expect(JSON.stringify(res.body)).not.toContain("lease-documents/");
    expect(res.body?.leases?.[0]?.jurisdictionPolicies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyKey: "lease_execution_readiness",
        }),
      ])
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

  it("refreshes signed lease document URLs from signing request storage metadata without exposing storage refs", async () => {
    getSignedDownloadUrlMock.mockResolvedValueOnce("https://signed.example.com/fresh-signed-lease.pdf");
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Harbour View" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Jane Tenant", email: "jane@example.com" });
    seedDoc("leases", "lease-signed", {
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
      leaseDocument: {
        bucket: "lease-documents",
        path: "leases/landlord-1/lease-signed/primary.pdf",
      },
    });
    seedDoc("leaseSigningRequests", "request-signed", {
      leaseId: "lease-signed",
      landlordId: "landlord-1",
      providerId: "dropbox_sign",
      providerRequestId: "raw-provider-request-id",
      providerRequestRef: "dropbox_sign_ref_safe",
      currentSigningStatus: "signed",
      signedDocument: {
        bucket: "signed-lease-documents",
        path: "lease-signing/landlord-1/request-signed/signed.pdf",
        internalReferenceOnly: true,
      },
      signedDocumentHash: "signed_doc_hash",
      signedDocumentStoredAt: "2026-01-02T00:10:00.000Z",
      signedDocumentUrl: "https://storage.googleapis.com/signed-lease-documents/lease-signing/landlord-1/request-signed/signed.pdf?X-Goog-Signature=stale",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    seedDoc("leaseSigningEvents", "event-signed", {
      requestId: "request-signed",
      leaseId: "lease-signed",
      landlordId: "landlord-1",
      type: "signed",
      occurredAt: "2026-01-02T00:05:00.000Z",
      actorRole: "provider",
    });

    const router = (await import("../leaseRoutes")).default;
    const refreshRes = await invokeRouter(router, { method: "GET", url: "/lease-signed/document-url" });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toEqual(
      expect.objectContaining({
        ok: true,
        documentUrl: "https://signed.example.com/fresh-signed-lease.pdf",
        refreshMode: "signed_url",
        expiresInSeconds: 1800,
        documentKind: "signed-lease",
        documentHash: "signed_doc_hash",
        signedDocumentStoredAt: "2026-01-02T00:10:00.000Z",
      })
    );
    expect(refreshRes.body?.documentRef).toEqual({
      source: "signedDocument",
      internalReferenceOnly: true,
    });
    expect(getSignedDownloadUrlMock).toHaveBeenCalledWith({
      bucket: "signed-lease-documents",
      path: "lease-signing/landlord-1/request-signed/signed.pdf",
      expiresMinutes: 30,
    });
    expect(JSON.stringify(refreshRes.body)).not.toContain("signed-lease-documents");
    expect(JSON.stringify(refreshRes.body)).not.toContain("lease-signing/landlord-1");
    expect(JSON.stringify(refreshRes.body)).not.toContain("raw-provider-request-id");
    expect(JSON.stringify(refreshRes.body)).not.toContain("X-Goog-Signature");
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

  it("returns primary lease document summaries without projecting raw storage refs", async () => {
    getPrimaryLeaseDocumentSummaryMock.mockResolvedValueOnce({
      id: "ldoc_1",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      documentType: "primary_lease",
      jurisdictionCode: "CA_NS",
      templateVersion: "ca-ns-primary-lease-draft-v1",
      counselReviewStatus: "draft",
      status: "generated",
      documentHash: "doc_hash",
      manifestHash: "manifest_hash",
      storageRef: null,
      previewUrl: "https://signed.example.com/primary-preview.pdf",
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/lease-1/primary-document" });

    expect(res.status).toBe(200);
    expect(res.body?.document).toEqual(expect.objectContaining({ id: "ldoc_1", storageRef: null }));
    expect(getPrimaryLeaseDocumentSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ leaseId: "lease-1", landlordId: "landlord-1", includePreviewUrl: false })
    );
    expect(JSON.stringify(res.body)).not.toContain("lease-documents/");
  });

  it("generates primary lease document metadata through the lease route", async () => {
    generatePrimaryLeaseDocumentMock.mockResolvedValueOnce({
      id: "ldoc_2",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      documentType: "primary_lease",
      jurisdictionCode: "CA_NS",
      templateVersion: "ca-ns-primary-lease-draft-v1",
      counselReviewStatus: "draft",
      status: "generated",
      documentHash: "doc_hash",
      manifestHash: "manifest_hash",
      storageRef: null,
    });
    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Coburg Rd", province: "NS" });
    seedDoc("units", "unit-6", { landlordId: "landlord-1", propertyId: "prop-1", unitNumber: "6" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Chip Milo", email: "hello+cob6tenant@rentchain.ai" });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      unitId: "unit-6",
      unitNumber: "6",
      province: "NS",
      status: "active",
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-1/primary-document/generate" });

    expect(res.status).toBe(201);
    expect(res.body?.document).toEqual(expect.objectContaining({ id: "ldoc_2", storageRef: null }));
    expect(generatePrimaryLeaseDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseId: "lease-1",
        lease: expect.objectContaining({ id: "lease-1", landlordId: "landlord-1" }),
        property: expect.objectContaining({ id: "prop-1", name: "Coburg Rd" }),
        unit: expect.objectContaining({ id: "unit-6", unitNumber: "6" }),
        tenants: [expect.objectContaining({ id: "tenant-1", email: "hello+cob6tenant@rentchain.ai" })],
      })
    );
    expect(JSON.stringify(res.body)).not.toContain("lease-documents/");
    expect(sendEmailMock).not.toHaveBeenCalled();
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

  it("does not send a lease available email after creating a persisted lease without a tenant-safe document", async () => {
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
      headers: { "idempotency-key": "active-create-no-document" },
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
    expect(res.body?.leaseNotification).toEqual(
      expect.objectContaining({ attempted: false, sent: false, reason: "lease_document_not_available" })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not send a lease available email after occupied-unit conversion without a primary lease document", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-1", unitId: "unit-1", unitNumber: "101", status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-1", currentTenantId: "tenant-1" }],
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "occupied",
      occupancyStatus: "occupied",
      occupantName: "Recovered Tenant",
      rent: 1850,
      leaseDocument: {
        fileName: "lease.pdf",
        bucket: "bucket-1",
        path: "leases/supporting-reference.pdf",
      },
      tenantId: "tenant-1",
      currentTenantId: "tenant-1",
      executionStatus: "fully_executed",
    });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", fullName: "Recovered Tenant", email: "recovered@example.com", currentLeaseId: null });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/reconciliation-candidates/unit-1/convert",
      headers: { "idempotency-key": "active-conversion-no-document" },
      body: {
        occupantName: "Recovered Tenant",
        tenantEmail: "recovered@example.com",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1850,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.leaseNotification).toEqual(
      expect.objectContaining({ attempted: false, sent: false, reason: "lease_document_not_available" })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejects lease creation when the start date is after the end date", async () => {
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

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/",
      headers: { "idempotency-key": "active-create-invalid-date" },
      body: {
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitNumber: "101",
        monthlyRent: 1850,
        startDate: "2026-09-01",
        endDate: "2026-08-31",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: "lease_date_range_invalid",
        message: "Lease start date must be on or before the end date.",
      })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not inspect recipient context or send availability email during internal lease creation", async () => {
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
      headers: { "idempotency-key": "active-create-recipient" },
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
      expect.objectContaining({ attempted: false, sent: false, reason: "lease_document_not_available" })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends a lease signing request for a landlord-scoped lease and records governed signing events", async () => {
    lockPrimaryLeaseDocumentForSigningMock.mockResolvedValueOnce({
      providerDocumentUrl: "https://signed.example.com/provider-lease.pdf",
      document: {
        id: "ldoc_1",
        documentHash: "doc_hash",
        manifestHash: "manifest_hash",
        templateVersion: "ca-ns-primary-lease-draft-v1",
        jurisdictionCode: "CA_NS",
        providerAccessUrlExpiresAt: "2026-01-01T04:00:00.000Z",
        signingFieldPlacement: {
          provider: "dropbox_sign",
          placementVersion: "dropbox_sign_form_fields_v1",
          fields: [
            {
              apiId: "tenant_signature",
              type: "signature",
              signerRole: "tenant",
              signerIndex: 0,
              documentIndex: 0,
              page: 2,
              x: 170,
              y: 165,
              width: 270,
              height: 52,
              required: true,
            },
          ],
        },
      },
    });
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
    expect(res.headers["x-lease-signing-route-version"]).toBe("lease-signing-dispatch-metadata-v1");
    expect(res.body?.data).toEqual(
      expect.objectContaining({
        signingStatus: "pending_signature",
        signingProviderId: "mock",
        providerDispatchMode: "mock",
        providerDispatchStatus: "mocked_no_email",
        routeVersion: "lease-signing-dispatch-metadata-v1",
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
        documentId: "ldoc_1",
        documentHash: "doc_hash",
        manifestHash: "manifest_hash",
        providerAccessUrlExpiresAt: "2026-01-01T04:00:00.000Z",
        providerDispatchMode: "mock",
        providerDispatchStatus: "mocked_no_email",
        rawIdsIncluded: false,
        payloadIncluded: false,
      })
    );
    expect(requests[0].data.documentUrl).toBeUndefined();
    expect(JSON.stringify(requests)).not.toContain("https://signed.example.com/provider-lease.pdf");
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
        providerDispatchMode: "mock",
        providerDispatchStatus: "mocked_no_email",
      })
    );
    expect(writeCanonicalEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signing_sent",
        actor: expect.objectContaining({ role: "landlord", type: "landlord" }),
        resource: { id: "lease-1", type: "lease" },
        status: "sent",
        metadata: expect.objectContaining({
          providerDispatchMode: "mock",
          providerDispatchStatus: "mocked_no_email",
        }),
      })
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("resolves storage-backed primary lease documents before sending for signature", async () => {
    lockPrimaryLeaseDocumentForSigningMock.mockResolvedValueOnce({
      providerDocumentUrl: "https://signed.example.com/provider-readable-lease.pdf",
      document: {
        id: "ldoc_storage",
        documentHash: "doc_hash",
        manifestHash: "manifest_hash",
        templateVersion: "ca-ns-primary-lease-draft-v1",
        jurisdictionCode: "CA_NS",
        providerAccessUrlExpiresAt: "2026-01-01T04:00:00.000Z",
      },
    });
    seedDoc("leases", "lease-storage-doc", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      monthlyRent: 1850,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      documentUrl: "https://storage.googleapis.com/lease-documents/leases/landlord-1/lease-storage-doc/lease-v1.pdf?X-Goog-Expires=1",
      leaseDocument: {
        bucket: "lease-documents",
        path: "leases/landlord-1/lease-storage-doc/lease-v1.pdf",
      },
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-storage-doc/send-for-signature",
      body: { tenantEmails: ["tenant@example.com"], message: "Please sign." },
    });

    expect(res.status).toBe(200);
    expect(lockPrimaryLeaseDocumentForSigningMock).toHaveBeenCalledWith(
      expect.objectContaining({ leaseId: "lease-storage-doc", landlordId: "landlord-1" })
    );
    const requests = listDocs("leaseSigningRequests");
    expect(requests).toHaveLength(1);
    expect(requests[0].data).toEqual(
      expect.objectContaining({
        leaseId: "lease-storage-doc",
        providerId: "mock",
        documentId: "ldoc_storage",
        providerAccessUrlExpiresAt: "2026-01-01T04:00:00.000Z",
      })
    );
    expect(requests[0].data.documentUrl).toBeUndefined();
    expect(requests[0].data.signingFieldPlacement).toBeUndefined();
    expect(JSON.stringify(requests)).not.toContain("https://signed.example.com/provider-readable-lease.pdf");
    expect(JSON.stringify(requests)).not.toContain("X-Goog-Expires=1");
    expect(writeCanonicalEventMock).toHaveBeenCalledTimes(1);
  });

  it("does not use Schedule A alone as the primary signing document", async () => {
    seedDoc("leases", "lease-schedule-only", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      status: "active",
      scheduleADocument: {
        bucket: "lease-documents",
        path: "leases/landlord-1/lease-schedule-only/schedule-a-v1.pdf",
      },
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-schedule-only/send-for-signature",
      body: { tenantEmails: ["tenant@example.com"] },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "signing_document_url_required" });
    expect(lockPrimaryLeaseDocumentForSigningMock).toHaveBeenCalledWith(
      expect.objectContaining({ leaseId: "lease-schedule-only", landlordId: "landlord-1" })
    );
    expect(listDocs("leaseSigningRequests")).toHaveLength(0);
    expect(writeCanonicalEventMock).not.toHaveBeenCalled();
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
      headers: { "idempotency-key": "active-create-occupancy" },
      body: {
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitNumber: "unit-1",
        monthlyRent: 1850,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        executionStatus: "fully_executed",
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
        occupancySource: "canonical_lease_start",
      })
    );
  });

  it("projects canonical current evidence for both participants in a coherent multi-party tenant lease", async () => {
    const unit = {
      id: "unit-multi-projection",
      unitNumber: "501",
      status: "occupied",
      occupancyStatus: "occupied",
      currentTenantId: "tenant-b",
      tenantId: "tenant-b",
      currentLeaseId: "lease-multi-projection",
    };
    seedDoc("properties", "prop-multi-projection", {
      landlordId: "landlord-1",
      name: "Harbour View",
      address: "123 Harbour Street",
      units: [unit],
    });
    seedDoc("units", "unit-multi-projection", {
      ...unit,
      landlordId: "landlord-1",
      propertyId: "prop-multi-projection",
    });
    seedDoc("tenants", "tenant-a", { landlordId: "landlord-1", status: "current", currentLeaseId: "lease-multi-projection" });
    seedDoc("tenants", "tenant-b", { landlordId: "landlord-1", status: "current", currentLeaseId: "lease-multi-projection" });
    seedDoc("leases", "lease-multi-projection", {
      landlordId: "landlord-1",
      propertyId: "prop-multi-projection",
      unitId: "unit-multi-projection",
      unitNumber: "501",
      tenantId: "tenant-a",
      primaryTenantId: "tenant-a",
      tenantIds: ["tenant-a", "tenant-b"],
      status: "active",
      executionStatus: "fully_executed",
      occupancyEffective: true,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: 2100,
    });
    seedDoc("leases", "lease-cross-landlord", {
      landlordId: "landlord-2",
      propertyId: "prop-foreign",
      unitId: "unit-foreign",
      tenantId: "tenant-b",
      tenantIds: ["tenant-b"],
      status: "active",
      executionStatus: "fully_executed",
      occupancyEffective: true,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    const router = (await import("../leaseRoutes")).default;
    for (const tenantId of ["tenant-a", "tenant-b"]) {
      const res = await invokeRouter(router, { method: "GET", url: `/tenant/${tenantId}` });
      expect(res.status).toBe(200);
      expect(res.body?.leases).toHaveLength(1);
      expect(res.body.leases[0]).toEqual(expect.objectContaining({
        id: "lease-multi-projection",
        occupancyEffective: true,
        tenantIds: ["tenant-a", "tenant-b"],
        canonicalState: expect.objectContaining({
          leaseTermState: "active",
          occupancyState: "occupied",
          tenantRelationshipState: "current_occupant",
          supportingLeaseId: "lease-multi-projection",
          reasons: [],
        }),
      }));
    }
  });

  it("keeps non-current and ambiguous tenant lease projections fail closed", async () => {
    const units = [
      { id: "unit-pending", unitNumber: "101", status: "vacant", occupancyStatus: "vacant" },
      { id: "unit-future", unitNumber: "102", status: "vacant", occupancyStatus: "vacant" },
      { id: "unit-ended", unitNumber: "103", status: "vacant", occupancyStatus: "vacant" },
      { id: "unit-review", unitNumber: "104", status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-stale", currentTenantId: "tenant-1" },
      { id: "unit-multiple", unitNumber: "105", status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-multiple-a", currentTenantId: "tenant-1" },
      { id: "unit-resolved", unitNumber: "106", status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-resolved-selected", currentTenantId: "tenant-1" },
    ];
    seedDoc("properties", "prop-projection-states", { landlordId: "landlord-1", name: "Projection House", units });
    for (const unit of units) {
      seedDoc("units", unit.id, { ...unit, landlordId: "landlord-1", propertyId: "prop-projection-states" });
    }
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", status: "current", currentLeaseId: "lease-multiple-a" });
    const lease = (id: string, unitId: string, patch: Record<string, unknown>) => seedDoc("leases", id, {
      landlordId: "landlord-1",
      propertyId: "prop-projection-states",
      unitId,
      tenantId: "tenant-1",
      tenantIds: ["tenant-1"],
      primaryTenantId: "tenant-1",
      monthlyRent: 1800,
      ...patch,
    });
    lease("lease-pending", "unit-pending", { status: "pending", executionStatus: "not_started", occupancyEffective: false, startDate: "2026-01-01", endDate: "2026-12-31" });
    lease("lease-future", "unit-future", { status: "active", executionStatus: "fully_executed", occupancyEffective: false, startDate: "2099-01-01", endDate: "2099-12-31" });
    lease("lease-ended", "unit-ended", { status: "ended", executionStatus: "fully_executed", occupancyEffective: false, startDate: "2025-01-01", endDate: "2025-12-31", endedAt: "2025-12-31T00:00:00.000Z" });
    lease("lease-review", "unit-review", { status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-01-01", endDate: "2026-12-31" });
    lease("lease-multiple-a", "unit-multiple", { status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-01-01", endDate: "2026-12-31" });
    lease("lease-multiple-b", "unit-multiple", { status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-02-01", endDate: "2026-11-30" });
    lease("lease-resolved-selected", "unit-resolved", { status: "active", executionStatus: "fully_executed", occupancyEffective: true, startDate: "2026-01-01", endDate: "2026-12-31" });
    lease("lease-resolved-excluded", "unit-resolved", {
      status: "active",
      executionStatus: "fully_executed",
      occupancyEffective: false,
      startDate: "2026-02-01",
      endDate: "2026-11-30",
      occupancyDisposition: {
        status: "excluded_from_current_occupancy_by_resolution",
        reason: "multiple_current_resolution",
        resolutionEventId: "occupancy_resolution:resolved-projection",
        selectedLeaseId: "lease-resolved-selected",
        excludedAt: "2026-08-22T12:00:00.000Z",
      },
    });

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/tenant/tenant-1" });
    expect(res.status).toBe(200);
    const byId = new Map(res.body.leases.map((item: any) => [item.id, item]));
    expect((byId.get("lease-pending") as any)?.canonicalState).toEqual(expect.objectContaining({ leaseTermState: "draft", occupancyState: "vacant" }));
    expect((byId.get("lease-future") as any)?.canonicalState).toEqual(expect.objectContaining({ leaseTermState: "upcoming", occupancyState: "vacant" }));
    expect((byId.get("lease-ended") as any)?.canonicalState).toEqual(expect.objectContaining({ leaseTermState: "ended", occupancyState: "vacant" }));
    expect((byId.get("lease-review") as any)?.canonicalState).toEqual(expect.objectContaining({ occupancyState: "review_needed", tenantRelationshipState: "occupancy_unresolved" }));
    for (const id of ["lease-multiple-a", "lease-multiple-b"]) {
      expect((byId.get(id) as any)?.canonicalState).toEqual(expect.objectContaining({
        occupancyState: "review_needed",
        tenantRelationshipState: "occupancy_unresolved",
        supportingLeaseId: null,
        reasons: expect.arrayContaining(["MULTIPLE_CURRENT_LEASES"]),
      }));
    }
    expect((byId.get("lease-resolved-selected") as any)?.canonicalState).toEqual(expect.objectContaining({
      occupancyState: "occupied",
      tenantRelationshipState: "current_occupant",
      supportingLeaseId: "lease-resolved-selected",
      reasons: [],
    }));
    expect(byId.has("lease-resolved-excluded")).toBe(true);
    expect((byId.get("lease-resolved-excluded") as any)?.canonicalState).toEqual(expect.objectContaining({
      occupancyState: "occupied",
      supportingLeaseId: "lease-resolved-selected",
      reasons: [],
    }));
  });

  it("fails closed when direct lease creation cannot resolve canonical unit context", async () => {
    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/",
      headers: { "idempotency-key": "active-create-missing-unit" },
      body: {
        tenantId: "tenant-1",
        propertyId: "prop-missing",
        unitNumber: "unit-missing",
        monthlyRent: 1850,
        startDate: "2026-01-01",
      },
    });

    expect(res.status).toBe(409);
    expect(res.body?.error).toBe("lease_start_context_ambiguous");
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
        {
          id: "unit-1",
          unitNumber: "101",
          status: "occupied",
          tenantId: "tenant-1",
          currentTenantId: "tenant-1",
          leaseId: "lease-1",
          currentLeaseId: "lease-1",
        },
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
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1", status: "current", relationshipStatus: "current", currentLeaseId: "lease-1" });
    seedDoc("tenancies", "tenancy-1", { landlordId: "landlord-1", propertyId: "prop-1", unitId: "unit-1", tenantId: "tenant-1", leaseId: "lease-1", status: "active" });

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
    expect((await fakeDb.collection("leases").doc("lease-1").get()).data()).toMatchObject({ status: "ended", occupancyEffective: false });
    expect((await fakeDb.collection("tenants").doc("tenant-1").get()).data()).toMatchObject({ status: "Past", relationshipStatus: "past", currentLeaseId: null });
    expect((await fakeDb.collection("tenancies").doc("tenancy-1").get()).data()).toMatchObject({ status: "inactive" });
    expect(listDocs("canonicalEvents")).toHaveLength(1);
    expect(listDocs("canonicalEvents")[0].data).toMatchObject({
      type: "lease.occupancy_ended",
      action: "occupancy_ended",
      appendOnly: true,
      immutable: true,
    });

    const replay = await invokeRouter(router, { method: "POST", url: "/lease-1/end", body: {} });
    expect(replay.status).toBe(200);
    expect(listDocs("canonicalEvents")).toHaveLength(1);
    expect((await fakeDb.collection("tenancies").doc("tenancy-1").get()).data()).toMatchObject({ status: "inactive" });
  });

  it("fails closed when multiple active tenancies claim the lease being ended", async () => {
    seedDoc("properties", "prop-tenancy-conflict", { landlordId: "landlord-1", units: [{ id: "unit-tenancy-conflict", unitNumber: "401", status: "occupied", tenantId: "tenant-conflict", currentLeaseId: "lease-tenancy-conflict" }] });
    seedDoc("units", "unit-tenancy-conflict", { landlordId: "landlord-1", propertyId: "prop-tenancy-conflict", unitNumber: "401", status: "occupied", tenantId: "tenant-conflict", currentLeaseId: "lease-tenancy-conflict" });
    seedDoc("tenants", "tenant-conflict", { landlordId: "landlord-1", currentLeaseId: "lease-tenancy-conflict" });
    seedDoc("leases", "lease-tenancy-conflict", { landlordId: "landlord-1", propertyId: "prop-tenancy-conflict", unitId: "unit-tenancy-conflict", unitNumber: "401", tenantId: "tenant-conflict", status: "active" });
    for (const id of ["tenancy-a", "tenancy-b"]) seedDoc("tenancies", id, { landlordId: "landlord-1", propertyId: "prop-tenancy-conflict", unitId: "unit-tenancy-conflict", tenantId: "tenant-conflict", leaseId: "lease-tenancy-conflict", status: "active" });
    const router = (await import("../leaseRoutes")).default;

    const res = await invokeRouter(router, { method: "POST", url: "/lease-tenancy-conflict/end", body: {} });

    expect(res.status).toBe(409);
    expect((await fakeDb.collection("leases").doc("lease-tenancy-conflict").get()).data()).toMatchObject({ status: "active" });
    expect((await fakeDb.collection("units").doc("unit-tenancy-conflict").get()).data()).toMatchObject({ status: "occupied" });
    expect(listDocs("canonicalEvents")).toHaveLength(0);
  });

  it("ends every participating tenancy and clears every matching tenant pointer for a multi-party lease", async () => {
    seedDoc("properties", "prop-multi-party", { landlordId: "landlord-1", units: [{ id: "unit-multi-party", unitNumber: "501", status: "occupied", tenantId: "tenant-b", currentTenantId: "tenant-b", currentLeaseId: "lease-multi-party" }] });
    seedDoc("units", "unit-multi-party", { landlordId: "landlord-1", propertyId: "prop-multi-party", unitNumber: "501", status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-b", currentTenantId: "tenant-b", leaseId: "lease-multi-party", currentLeaseId: "lease-multi-party" });
    seedDoc("tenants", "tenant-a", { landlordId: "landlord-1", status: "current", relationshipStatus: "current", currentLeaseId: "lease-multi-party" });
    seedDoc("tenants", "tenant-b", { landlordId: "landlord-1", status: "current", relationshipStatus: "current", currentLeaseId: "lease-multi-party" });
    seedDoc("leases", "lease-multi-party", { landlordId: "landlord-1", propertyId: "prop-multi-party", unitId: "unit-multi-party", unitNumber: "501", tenantId: "tenant-a", primaryTenantId: "tenant-a", tenantIds: ["tenant-a", "tenant-b", "tenant-a", ""], status: "active" });
    seedDoc("tenancies", "tenancy-a", { landlordId: "landlord-1", propertyId: "prop-multi-party", unitId: "unit-multi-party", tenantId: "tenant-a", leaseId: "lease-multi-party", status: "active" });
    seedDoc("tenancies", "tenancy-b", { landlordId: "landlord-1", propertyId: "prop-multi-party", unitId: "unit-multi-party", tenantId: "tenant-b", leaseId: "lease-multi-party", status: "active" });
    seedDoc("tenancies", "unrelated-tenancy", { landlordId: "landlord-1", propertyId: "prop-multi-party", unitId: "unit-multi-party", tenantId: "tenant-a", leaseId: "lease-other", status: "active" });
    const router = (await import("../leaseRoutes")).default;

    const res = await invokeRouter(router, { method: "POST", url: "/lease-multi-party/end", body: {} });

    expect(res.status).toBe(200);
    expect((await fakeDb.collection("leases").doc("lease-multi-party").get()).data()).toMatchObject({ status: "ended", occupancyEffective: false });
    expect((await fakeDb.collection("units").doc("unit-multi-party").get()).data()).toMatchObject({ status: "vacant", currentLeaseId: null });
    expect((await fakeDb.collection("properties").doc("prop-multi-party").get()).data()?.units[0]).toMatchObject({ status: "vacant", currentLeaseId: null });
    expect((await fakeDb.collection("tenants").doc("tenant-a").get()).data()).toMatchObject({ status: "Past", relationshipStatus: "past", currentLeaseId: null });
    expect((await fakeDb.collection("tenants").doc("tenant-b").get()).data()).toMatchObject({ status: "Past", relationshipStatus: "past", currentLeaseId: null });
    expect((await fakeDb.collection("tenancies").doc("tenancy-a").get()).data()).toMatchObject({ status: "inactive" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-b").get()).data()).toMatchObject({ status: "inactive" });
    expect((await fakeDb.collection("tenancies").doc("unrelated-tenancy").get()).data()).toMatchObject({ status: "active" });
    expect(listDocs("canonicalEvents")).toHaveLength(1);
    expect(listDocs("canonicalEvents")[0].data?.metadata?.tenantRefs).toHaveLength(2);

    const replay = await invokeRouter(router, { method: "POST", url: "/lease-multi-party/end", body: {} });
    expect(replay.status).toBe(200);
    expect(listDocs("canonicalEvents")).toHaveLength(1);
    expect((await fakeDb.collection("tenancies").doc("tenancy-a").get()).data()).toMatchObject({ status: "inactive" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-b").get()).data()).toMatchObject({ status: "inactive" });
    expect((await fakeDb.collection("tenancies").doc("unrelated-tenancy").get()).data()).toMatchObject({ status: "active" });
  });

  it("derives End Lease relationship status independently for each participant", async () => {
    seedDoc("properties", "prop-mixed-participants", { landlordId: "landlord-1", units: [{ id: "unit-mixed-participants", unitNumber: "511", status: "occupied", tenantId: "tenant-b", currentTenantId: "tenant-b", currentLeaseId: "lease-mixed-participants" }] });
    seedDoc("units", "unit-mixed-participants", { landlordId: "landlord-1", propertyId: "prop-mixed-participants", unitNumber: "511", status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-b", currentTenantId: "tenant-b", leaseId: "lease-mixed-participants", currentLeaseId: "lease-mixed-participants" });
    seedDoc("tenants", "tenant-a", { landlordId: "landlord-1", status: "current", relationshipStatus: "current", currentLeaseId: "lease-mixed-participants" });
    seedDoc("tenants", "tenant-b", { landlordId: "landlord-1", status: "current", relationshipStatus: "current", currentLeaseId: "lease-mixed-participants" });
    seedDoc("leases", "lease-mixed-participants", { landlordId: "landlord-1", propertyId: "prop-mixed-participants", unitId: "unit-mixed-participants", unitNumber: "511", tenantId: "tenant-a", primaryTenantId: "tenant-a", tenantIds: ["tenant-a", "tenant-b"], status: "active" });
    seedDoc("leases", "lease-tenant-b-current", { landlordId: "landlord-1", propertyId: "prop-tenant-b-current", unitId: "unit-tenant-b-current", unitNumber: "512", tenantId: "tenant-b", tenantIds: ["tenant-b"], status: "active", executionStatus: "fully_executed", startDate: "2026-02-01", endDate: "2027-02-01", occupancyEffective: true });
    seedDoc("tenancies", "tenancy-mixed-a", { landlordId: "landlord-1", propertyId: "prop-mixed-participants", unitId: "unit-mixed-participants", tenantId: "tenant-a", leaseId: "lease-mixed-participants", status: "active" });
    seedDoc("tenancies", "tenancy-mixed-b", { landlordId: "landlord-1", propertyId: "prop-mixed-participants", unitId: "unit-mixed-participants", tenantId: "tenant-b", leaseId: "lease-mixed-participants", status: "active" });
    const router = (await import("../leaseRoutes")).default;

    const res = await invokeRouter(router, { method: "POST", url: "/lease-mixed-participants/end", body: { endDate: "2026-08-23T12:00:00.000Z" } });

    expect(res.status).toBe(200);
    expect((await fakeDb.collection("tenants").doc("tenant-a").get()).data()).toMatchObject({ status: "Past", relationshipStatus: "past", currentLeaseId: null });
    expect((await fakeDb.collection("tenants").doc("tenant-b").get()).data()).toMatchObject({ status: "current", relationshipStatus: "current", currentLeaseId: "lease-tenant-b-current" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-mixed-a").get()).data()).toMatchObject({ status: "inactive" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-mixed-b").get()).data()).toMatchObject({ status: "inactive" });
  });

  it("preserves another canonical current lease when ending one participant lease", async () => {
    seedDoc("properties", "prop-ending", { landlordId: "landlord-1", units: [{ id: "unit-ending", unitNumber: "601", status: "occupied", currentTenantId: "tenant-shared", currentLeaseId: "lease-ending" }] });
    seedDoc("properties", "prop-current", { landlordId: "landlord-1", units: [{ id: "unit-current", unitNumber: "602", status: "occupied", currentTenantId: "tenant-shared", currentLeaseId: "lease-current" }] });
    seedDoc("units", "unit-ending", { landlordId: "landlord-1", propertyId: "prop-ending", unitNumber: "601", status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-shared", currentTenantId: "tenant-shared", leaseId: "lease-ending", currentLeaseId: "lease-ending" });
    seedDoc("units", "unit-current", { landlordId: "landlord-1", propertyId: "prop-current", unitNumber: "602", status: "occupied", occupancyStatus: "occupied", tenantId: "tenant-shared", currentTenantId: "tenant-shared", leaseId: "lease-current", currentLeaseId: "lease-current" });
    seedDoc("tenants", "tenant-shared", { landlordId: "landlord-1", status: "current", relationshipStatus: "current", currentLeaseId: "lease-ending" });
    seedDoc("leases", "lease-ending", { landlordId: "landlord-1", propertyId: "prop-ending", unitId: "unit-ending", unitNumber: "601", tenantId: "tenant-shared", tenantIds: ["tenant-shared"], status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2027-01-01", occupancyEffective: true });
    seedDoc("leases", "lease-current", { landlordId: "landlord-1", propertyId: "prop-current", unitId: "unit-current", unitNumber: "602", tenantId: "tenant-shared", tenantIds: ["tenant-shared"], status: "active", executionStatus: "fully_executed", startDate: "2026-02-01", endDate: "2027-02-01", occupancyEffective: true });
    seedDoc("tenancies", "tenancy-ending", { landlordId: "landlord-1", propertyId: "prop-ending", unitId: "unit-ending", tenantId: "tenant-shared", leaseId: "lease-ending", status: "active" });
    seedDoc("tenancies", "tenancy-current", { landlordId: "landlord-1", propertyId: "prop-current", unitId: "unit-current", tenantId: "tenant-shared", leaseId: "lease-current", status: "active" });
    const router = (await import("../leaseRoutes")).default;

    const res = await invokeRouter(router, { method: "POST", url: "/lease-ending/end", body: { endDate: "2026-08-23T12:00:00.000Z" } });

    expect(res.status).toBe(200);
    expect((await fakeDb.collection("leases").doc("lease-ending").get()).data()).toMatchObject({ status: "ended", occupancyEffective: false });
    expect((await fakeDb.collection("tenants").doc("tenant-shared").get()).data()).toMatchObject({ status: "current", relationshipStatus: "current", currentLeaseId: "lease-current" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-ending").get()).data()).toMatchObject({ status: "inactive" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-current").get()).data()).toMatchObject({ status: "active" });
    const tenantsRouter = (await import("../tenantsRoutes")).default;
    const detail = await invokeRouter(tenantsRouter, { method: "GET", url: "/tenant-shared" });
    expect(detail.body.lease).toMatchObject({ id: "lease-current" });
    expect(detail.body.canonicalState).toMatchObject({ supportingLeaseId: "lease-current" });
    expect(detail.body.currentLease).toMatchObject({ id: "lease-current" });
  });

  it("projects one completed End Lease postcondition through all five product paths without Review Needed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00.000Z"));
    const propertyId = "prop-end-cross-surface";
    const unitId = "unit-end-cross-surface";
    const tenantId = "tenant-end-cross-surface";
    const leaseId = "lease-end-cross-surface";
    seedDoc("properties", propertyId, {
      landlordId: "landlord-1",
      ownerUserId: "landlord-1",
      name: "End Lease House",
      units: [{ id: unitId, unitId, unitNumber: "701", status: "occupied", occupancyStatus: "occupied", tenantId, currentTenantId: tenantId, leaseId, currentLeaseId: leaseId }],
    });
    seedDoc("units", unitId, { landlordId: "landlord-1", propertyId, unitNumber: "701", status: "occupied", occupancyStatus: "occupied", tenantId, currentTenantId: tenantId, leaseId, currentLeaseId: leaseId });
    seedDoc("tenants", tenantId, { landlordId: "landlord-1", fullName: "Ended Tenant", status: "current", relationshipStatus: "current", propertyId, unitId, currentLeaseId: leaseId });
    seedDoc("leases", leaseId, { landlordId: "landlord-1", propertyId, unitId, unitNumber: "701", tenantId, primaryTenantId: tenantId, tenantIds: [tenantId], status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2027-01-01", occupancyEffective: true });
    seedDoc("tenancies", "tenancy-end-cross-surface", { landlordId: "landlord-1", propertyId, unitId, tenantId, leaseId, status: "active" });

    const leaseRouter = (await import("../leaseRoutes")).default;
    const propertiesRouter = (await import("../propertiesRoutes")).default;
    const tenantsRouter = (await import("../tenantsRoutes")).default;
    const occupancyReviewRouter = (await import("../occupancyReviewRoutes")).default;
    try {
      const ended = await invokeRouter(leaseRouter, { method: "POST", url: `/${leaseId}/end`, body: { endDate: "2099-01-01T00:00:00.000Z" } });
      expect(ended.status).toBe(200);
      expect((await fakeDb.collection("leases").doc(leaseId).get()).data()).toMatchObject({
        status: "ended",
        occupancyEffective: false,
        startDate: "2026-01-01",
        endDate: "2027-01-01",
        endedAt: "2026-08-23T12:00:00.000Z",
      });
      expect((await fakeDb.collection("tenancies").doc("tenancy-end-cross-surface").get()).data()).toMatchObject({
        status: "inactive",
        moveOutAt: "2026-08-23T12:00:00.000Z",
      });

    const properties = await invokeRouter(propertiesRouter, { method: "GET", url: "/" });
    const property = properties.body.items.find((entry: any) => entry.id === propertyId);
    expect(property.units.find((entry: any) => entry.id === unitId)).toMatchObject({ status: "vacant", occupancyStatus: "vacant", tenantId: null, currentTenantId: null, leaseId: null, currentLeaseId: null });

    const leases = await invokeRouter(leaseRouter, { method: "GET", url: `/tenant/${tenantId}` });
    const historicalLease = leases.body.leases.find((entry: any) => entry.id === leaseId);
    expect(historicalLease).toMatchObject({ status: "ended", occupancyEffective: false, canonicalState: expect.objectContaining({ leaseTermState: "ended", occupancyState: "vacant", tenantRelationshipState: "past_tenant", supportingLeaseId: null }) });

    const tenants = await invokeRouter(tenantsRouter, { method: "GET", url: "/" });
    const tenant = tenants.body.tenants.find((entry: any) => entry.id === tenantId);
    expect(tenant).toMatchObject({ status: "Past", currentLeaseId: null, canonicalState: expect.objectContaining({ occupancyState: "vacant", tenantRelationshipState: "past_tenant", supportingLeaseId: null }) });

    const detail = await invokeRouter(tenantsRouter, { method: "GET", url: `/${tenantId}` });
      expect(detail.body.tenant).toMatchObject({ status: "Past", currentLeaseId: null, leaseStart: "2026-01-01", leaseEnd: "2027-01-01" });
      expect(detail.body.canonicalState).toMatchObject({ occupancyState: "vacant", tenantRelationshipState: "past_tenant", supportingLeaseId: null });
      expect(detail.body.currentLease).toBeNull();
      expect(detail.body.lease).toMatchObject({ id: leaseId, status: "ended", leaseStart: "2026-01-01", leaseEnd: "2027-01-01" });
      expect(detail.body.workspaceLifecycle).toMatchObject({ category: "past", isArchived: false, actualEndDate: "2026-08-23T12:00:00.000Z" });
    expect((await fakeDb.collection("tenants").doc(tenantId).get()).data()).toMatchObject({ relationshipStatus: "past" });

    const review = await invokeRouter(occupancyReviewRouter, { method: "GET", url: "/" });
    expect(review.body.items.filter((item: any) => item.propertyId === propertyId || item.unitId === unitId || item.tenantId === tenantId)).toEqual([]);
      const events = listDocs("canonicalEvents");
      expect(events).toHaveLength(1);
      expect(events[0].data).toMatchObject({
        occurredAt: "2026-08-23T12:00:00.000Z",
        recordedAt: "2026-08-23T12:00:00.000Z",
        metadata: { effectiveDate: "2026-08-23T12:00:00.000Z" },
      });

      vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));
      const replay = await invokeRouter(leaseRouter, { method: "POST", url: `/${leaseId}/end`, body: { endDate: "2099-02-01T00:00:00.000Z" } });
      expect(replay.status).toBe(200);
      expect((await fakeDb.collection("leases").doc(leaseId).get()).data()).toMatchObject({ endedAt: "2026-08-23T12:00:00.000Z", endDate: "2027-01-01" });
      expect(listDocs("canonicalEvents")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["foreign tenant pointer", "tenant-c", "tenant-c"],
    ["mixed participant pointers", "tenant-a", "tenant-b"],
  ])("fails closed for %s without ending a multi-party lease", async (_label, standaloneTenantId, embeddedTenantId) => {
    seedDoc("properties", "prop-multi-pointer-conflict", { landlordId: "landlord-1", units: [{ id: "unit-multi-pointer-conflict", unitNumber: "502", status: "occupied", tenantId: embeddedTenantId, currentTenantId: embeddedTenantId, currentLeaseId: "lease-multi-pointer-conflict" }] });
    seedDoc("units", "unit-multi-pointer-conflict", { landlordId: "landlord-1", propertyId: "prop-multi-pointer-conflict", unitNumber: "502", status: "occupied", occupancyStatus: "occupied", tenantId: standaloneTenantId, currentTenantId: standaloneTenantId, leaseId: "lease-multi-pointer-conflict", currentLeaseId: "lease-multi-pointer-conflict" });
    seedDoc("tenants", "tenant-a", { landlordId: "landlord-1", currentLeaseId: "lease-multi-pointer-conflict" });
    seedDoc("tenants", "tenant-b", { landlordId: "landlord-1", currentLeaseId: "lease-multi-pointer-conflict" });
    seedDoc("leases", "lease-multi-pointer-conflict", { landlordId: "landlord-1", propertyId: "prop-multi-pointer-conflict", unitId: "unit-multi-pointer-conflict", unitNumber: "502", tenantId: "tenant-a", primaryTenantId: "tenant-a", tenantIds: ["tenant-a", "tenant-b"], status: "active" });
    seedDoc("tenancies", "tenancy-pointer-a", { landlordId: "landlord-1", propertyId: "prop-multi-pointer-conflict", unitId: "unit-multi-pointer-conflict", tenantId: "tenant-a", leaseId: "lease-multi-pointer-conflict", status: "active" });
    seedDoc("tenancies", "tenancy-pointer-b", { landlordId: "landlord-1", propertyId: "prop-multi-pointer-conflict", unitId: "unit-multi-pointer-conflict", tenantId: "tenant-b", leaseId: "lease-multi-pointer-conflict", status: "active" });
    const router = (await import("../leaseRoutes")).default;

    const res = await invokeRouter(router, { method: "POST", url: "/lease-multi-pointer-conflict/end", body: {} });

    expect(res.status).toBe(409);
    expect((await fakeDb.collection("leases").doc("lease-multi-pointer-conflict").get()).data()).toMatchObject({ status: "active" });
    expect((await fakeDb.collection("units").doc("unit-multi-pointer-conflict").get()).data()).toMatchObject({ status: "occupied" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-pointer-a").get()).data()).toMatchObject({ status: "active" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-pointer-b").get()).data()).toMatchObject({ status: "active" });
    expect(listDocs("canonicalEvents")).toHaveLength(0);
  });

  it("does not commit End Lease domain writes when canonical audit creation fails", async () => {
    seedDoc("properties", "prop-audit-failure", { landlordId: "landlord-1", units: [{ id: "unit-audit-failure", unitNumber: "402", status: "occupied", tenantId: "tenant-audit-failure", currentLeaseId: "lease-audit-failure" }] });
    seedDoc("units", "unit-audit-failure", { landlordId: "landlord-1", propertyId: "prop-audit-failure", unitNumber: "402", status: "occupied", tenantId: "tenant-audit-failure", currentLeaseId: "lease-audit-failure" });
    seedDoc("tenants", "tenant-audit-failure", { landlordId: "landlord-1", currentLeaseId: "lease-audit-failure" });
    seedDoc("tenancies", "tenancy-audit-failure", { landlordId: "landlord-1", propertyId: "prop-audit-failure", unitId: "unit-audit-failure", tenantId: "tenant-audit-failure", leaseId: "lease-audit-failure", status: "active" });
    seedDoc("leases", "lease-audit-failure", { landlordId: "landlord-1", propertyId: "prop-audit-failure", unitId: "unit-audit-failure", unitNumber: "402", tenantId: "tenant-audit-failure", status: "active" });
    vi.spyOn(fakeDb, "runTransaction").mockImplementationOnce(async (callback: any) => callback({
      get: async (ref: any) => ref.get(),
      create: () => { throw new Error("synthetic audit failure"); },
      set: async (ref: any, value: any, options?: any) => ref.set(value, options),
    }));
    const router = (await import("../leaseRoutes")).default;

    const res = await invokeRouter(router, { method: "POST", url: "/lease-audit-failure/end", body: {} });

    expect(res.status).toBe(409);
    expect((await fakeDb.collection("leases").doc("lease-audit-failure").get()).data()).toMatchObject({ status: "active" });
    expect((await fakeDb.collection("units").doc("unit-audit-failure").get()).data()).toMatchObject({ status: "occupied" });
    expect((await fakeDb.collection("tenants").doc("tenant-audit-failure").get()).data()).toMatchObject({ currentLeaseId: "lease-audit-failure" });
    expect((await fakeDb.collection("tenancies").doc("tenancy-audit-failure").get()).data()).toMatchObject({ status: "active" });
    expect(listDocs("canonicalEvents")).toHaveLength(0);
  });

  it("treats an already-ended lease as an idempotent no-op when no replacement linkage exists", async () => {
    seedDoc("properties", "prop-ended", {
      landlordId: "landlord-1",
      units: [{ id: "unit-ended", unitNumber: "301", status: "vacant", leaseId: null, currentLeaseId: null }],
    });
    seedDoc("leases", "lease-ended", {
      landlordId: "landlord-1",
      propertyId: "prop-ended",
      tenantId: "tenant-ended",
      unitId: "unit-ended",
      unitNumber: "301",
      status: "ended",
      endDate: "2026-07-01T00:00:00.000Z",
    });
    seedDoc("units", "unit-ended", {
      landlordId: "landlord-1",
      propertyId: "prop-ended",
      unitNumber: "301",
      status: "vacant",
      occupancyStatus: "vacant",
      leaseId: null,
      currentLeaseId: null,
    });

    const beforeProperty = structuredClone((await fakeDb.collection("properties").doc("prop-ended").get()).data());
    const beforeUnit = structuredClone((await fakeDb.collection("units").doc("unit-ended").get()).data());
    const beforeLease = structuredClone((await fakeDb.collection("leases").doc("lease-ended").get()).data());
    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-ended/end", body: {} });

    expect(res.status).toBe(200);
    expect((await fakeDb.collection("properties").doc("prop-ended").get()).data()).toEqual(beforeProperty);
    expect((await fakeDb.collection("units").doc("unit-ended").get()).data()).toEqual(beforeUnit);
    expect((await fakeDb.collection("leases").doc("lease-ended").get()).data()).toEqual(beforeLease);
  });

  it("rejects a repeated end when the standalone unit is linked to a replacement lease", async () => {
    seedDoc("properties", "prop-replaced", {
      landlordId: "landlord-1",
      units: [{
        id: "unit-replaced",
        unitNumber: "302",
        status: "occupied",
        tenantId: "tenant-old",
        currentTenantId: "tenant-old",
        leaseId: "lease-old",
        currentLeaseId: "lease-old",
      }],
    });
    seedDoc("leases", "lease-old", {
      landlordId: "landlord-1",
      propertyId: "prop-replaced",
      tenantId: "tenant-old",
      unitId: "unit-replaced",
      unitNumber: "302",
      status: "active",
      endDate: null,
    });
    seedDoc("tenants", "tenant-old", { landlordId: "landlord-1", currentLeaseId: "lease-old" });
    seedDoc("units", "unit-replaced", {
      landlordId: "landlord-1",
      propertyId: "prop-replaced",
      unitNumber: "302",
      status: "occupied",
      occupancyStatus: "occupied",
      tenantId: "tenant-old",
      currentTenantId: "tenant-old",
      leaseId: "lease-old",
      currentLeaseId: "lease-old",
    });

    const router = (await import("../leaseRoutes")).default;
    const first = await invokeRouter(router, { method: "POST", url: "/lease-old/end", body: {} });
    expect(first.status).toBe(200);

    seedDoc("leases", "lease-replacement", { landlordId: "landlord-1", status: "active" });
    seedDoc("tenants", "tenant-old", { landlordId: "landlord-1", currentLeaseId: "lease-replacement" });
    seedDoc("units", "unit-replaced", {
      landlordId: "landlord-1",
      propertyId: "prop-replaced",
      unitNumber: "302",
      status: "occupied",
      occupancyStatus: "occupied",
      tenantId: "tenant-new",
      currentTenantId: "tenant-new",
      leaseId: "lease-replacement",
      currentLeaseId: "lease-replacement",
    });

    const beforeProperty = structuredClone((await fakeDb.collection("properties").doc("prop-replaced").get()).data());
    const beforeUnit = structuredClone((await fakeDb.collection("units").doc("unit-replaced").get()).data());
    const beforeLease = structuredClone((await fakeDb.collection("leases").doc("lease-old").get()).data());
    const beforeTenant = structuredClone((await fakeDb.collection("tenants").doc("tenant-old").get()).data());
    const res = await invokeRouter(router, { method: "POST", url: "/lease-old/end", body: {} });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: "lease_end_occupancy_reconciliation_failed" });
    expect((await fakeDb.collection("properties").doc("prop-replaced").get()).data()).toEqual(beforeProperty);
    expect((await fakeDb.collection("units").doc("unit-replaced").get()).data()).toEqual(beforeUnit);
    expect((await fakeDb.collection("leases").doc("lease-old").get()).data()).toEqual(beforeLease);
    expect((await fakeDb.collection("tenants").doc("tenant-old").get()).data()).toEqual(beforeTenant);
    expect((await fakeDb.collection("leases").doc("lease-replacement").get()).data()).toEqual({
      landlordId: "landlord-1",
      status: "active",
    });
  });

  it("rejects lease end when the embedded property unit is linked to a replacement lease", async () => {
    seedDoc("properties", "prop-embedded-replaced", {
      landlordId: "landlord-1",
      units: [{
        id: "unit-embedded-replaced",
        unitNumber: "303",
        status: "occupied",
        tenantId: "tenant-new",
        currentTenantId: "tenant-new",
        leaseId: "lease-replacement",
        currentLeaseId: "lease-replacement",
      }],
    });
    seedDoc("leases", "lease-stale", {
      landlordId: "landlord-1",
      propertyId: "prop-embedded-replaced",
      tenantId: "tenant-old",
      unitId: "unit-embedded-replaced",
      unitNumber: "303",
      status: "active",
      endDate: null,
    });
    seedDoc("units", "unit-embedded-replaced", {
      landlordId: "landlord-1",
      propertyId: "prop-embedded-replaced",
      unitNumber: "303",
      status: "occupied",
      occupancyStatus: "occupied",
    });
    seedDoc("tenants", "tenant-old", { landlordId: "landlord-1", currentLeaseId: "lease-stale" });

    const beforeProperty = structuredClone((await fakeDb.collection("properties").doc("prop-embedded-replaced").get()).data());
    const beforeUnit = structuredClone((await fakeDb.collection("units").doc("unit-embedded-replaced").get()).data());
    const beforeLease = structuredClone((await fakeDb.collection("leases").doc("lease-stale").get()).data());
    const beforeTenant = structuredClone((await fakeDb.collection("tenants").doc("tenant-old").get()).data());
    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-stale/end", body: {} });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: "lease_end_occupancy_reconciliation_failed" });
    expect((await fakeDb.collection("properties").doc("prop-embedded-replaced").get()).data()).toEqual(beforeProperty);
    expect((await fakeDb.collection("units").doc("unit-embedded-replaced").get()).data()).toEqual(beforeUnit);
    expect((await fakeDb.collection("leases").doc("lease-stale").get()).data()).toEqual(beforeLease);
    expect((await fakeDb.collection("tenants").doc("tenant-old").get()).data()).toEqual(beforeTenant);
  });

  it("rejects ambiguous standalone unit aliases before attempting any lease-end write", async () => {
    seedDoc("properties", "prop-ambiguous", {
      landlordId: "landlord-1",
      units: [{
        id: "unit-logical",
        unitNumber: "QA-E",
        status: "occupied",
        occupancyStatus: "occupied",
        tenantId: "tenant-ambiguous",
        currentTenantId: "tenant-ambiguous",
        leaseId: "lease-ambiguous",
        currentLeaseId: "lease-ambiguous",
      }],
    });
    seedDoc("leases", "lease-ambiguous", {
      landlordId: "landlord-1",
      propertyId: "prop-ambiguous",
      tenantId: "tenant-ambiguous",
      unitId: "unit-logical",
      unitNumber: "QA-E",
      status: "active",
      endDate: null,
    });
    seedDoc("tenants", "tenant-ambiguous", {
      landlordId: "landlord-1",
      currentLeaseId: "lease-ambiguous",
    });
    seedDoc("units", "unit-ambiguous-1", {
      id: "unit-ambiguous-1",
      unitId: "unit-logical",
      unitNumber: "QA-E-1",
      landlordId: "landlord-1",
      propertyId: "prop-ambiguous",
      status: "occupied",
      occupancyStatus: "occupied",
      tenantId: "tenant-ambiguous",
      leaseId: "lease-ambiguous",
      currentLeaseId: "lease-ambiguous",
    });
    seedDoc("units", "unit-ambiguous-2", {
      id: "unit-ambiguous-2",
      unitId: "unit-logical",
      unitNumber: "QA-E-2",
      landlordId: "landlord-1",
      propertyId: "prop-ambiguous",
      status: "occupied",
      occupancyStatus: "occupied",
      tenantId: "tenant-ambiguous",
      leaseId: "lease-ambiguous",
      currentLeaseId: "lease-ambiguous",
    });

    const beforeProperty = structuredClone((await fakeDb.collection("properties").doc("prop-ambiguous").get()).data());
    const beforeLease = structuredClone((await fakeDb.collection("leases").doc("lease-ambiguous").get()).data());
    const beforeTenant = structuredClone((await fakeDb.collection("tenants").doc("tenant-ambiguous").get()).data());
    const beforeUnit1 = structuredClone((await fakeDb.collection("units").doc("unit-ambiguous-1").get()).data());
    const beforeUnit2 = structuredClone((await fakeDb.collection("units").doc("unit-ambiguous-2").get()).data());
    const transactionSet = vi.fn();
    vi.spyOn(fakeDb, "runTransaction").mockImplementationOnce(async (callback: any) =>
      callback({
        get: async (ref: any) => ref.get(),
        set: async (ref: any, value: any, options?: any) => {
          transactionSet(ref, value, options);
          return ref.set(value, options);
        },
      })
    );

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-ambiguous/end", body: {} });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: "lease_end_occupancy_reconciliation_failed" });
    expect(transactionSet).not.toHaveBeenCalled();
    expect((await fakeDb.collection("properties").doc("prop-ambiguous").get()).data()).toEqual(beforeProperty);
    expect((await fakeDb.collection("leases").doc("lease-ambiguous").get()).data()).toEqual(beforeLease);
    expect((await fakeDb.collection("tenants").doc("tenant-ambiguous").get()).data()).toEqual(beforeTenant);
    expect((await fakeDb.collection("units").doc("unit-ambiguous-1").get()).data()).toEqual(beforeUnit1);
    expect((await fakeDb.collection("units").doc("unit-ambiguous-2").get()).data()).toEqual(beforeUnit2);
  });

  it("does not commit lease end when atomic occupancy reconciliation fails", async () => {
    seedDoc("properties", "prop-rollback", {
      landlordId: "landlord-1",
      units: [{ id: "unit-rollback", unitNumber: "201", status: "occupied" }],
    });
    seedDoc("leases", "lease-rollback", {
      landlordId: "landlord-1",
      propertyId: "prop-rollback",
      tenantId: "tenant-rollback",
      unitId: "unit-rollback",
      unitNumber: "201",
      status: "active",
      endDate: null,
    });
    seedDoc("units", "unit-rollback", {
      landlordId: "landlord-1",
      propertyId: "prop-rollback",
      unitNumber: "201",
      status: "occupied",
      occupancyStatus: "occupied",
      tenantId: "tenant-rollback",
      leaseId: "lease-rollback",
    });
    vi.spyOn(fakeDb, "runTransaction").mockRejectedValueOnce(new Error("synthetic transaction failure"));

    const router = (await import("../leaseRoutes")).default;
    const res = await invokeRouter(router, { method: "POST", url: "/lease-rollback/end", body: {} });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: "lease_end_occupancy_reconciliation_failed" });
    expect((await fakeDb.collection("leases").doc("lease-rollback").get()).data()).toEqual(
      expect.objectContaining({ status: "active", endDate: null })
    );
    expect((await fakeDb.collection("units").doc("unit-rollback").get()).data()).toEqual(
      expect.objectContaining({ status: "occupied", leaseId: "lease-rollback" })
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

  it.each([
    ["eligible current", "2026-08-01", true],
    ["future ineligible", "2027-01-01", false],
  ] as const)("projects the exact %s onboarding fixture through all five product paths", async (_label, startDate, eligible) => {
    const propertyId = `property-onboarding-${eligible ? "current" : "future"}`;
    const unitId = `unit-onboarding-${eligible ? "current" : "future"}`;
    const tenantId = `tenant-onboarding-${eligible ? "current" : "future"}`;
    const leaseId = `lease-onboarding-${eligible ? "current" : "future"}`;
    const tenancyId = `tenancy-onboarding-${eligible ? "current" : "future"}`;
    const unit = {
      id: unitId,
      unitId,
      unitNumber: eligible ? "C1" : "F1",
      status: "vacant",
      occupancyStatus: "vacant",
    };
    seedDoc("properties", propertyId, {
      landlordId: "landlord-1",
      ownerUserId: "landlord-1",
      name: eligible ? "Current Onboarding House" : "Future Onboarding House",
      units: [unit],
    });
    seedDoc("units", unitId, { ...unit, landlordId: "landlord-1", propertyId });
    seedDoc("tenants", tenantId, {
      landlordId: "landlord-1",
      fullName: eligible ? "Current Onboarding Tenant" : "Future Onboarding Tenant",
      status: "invited",
      propertyId,
      unitId,
    });
    seedDoc("tenancies", tenancyId, {
      landlordId: "landlord-1",
      propertyId,
      unitId,
      tenantId,
      leaseId,
      status: "inactive",
      source: "application_conversion",
    });
    seedDoc("leases", leaseId, {
      landlordId: "landlord-1",
      propertyId,
      unitId,
      tenantId,
      tenantIds: [tenantId],
      primaryTenantId: tenantId,
      status: "active",
      executionStatus: "fully_executed",
      startDate,
      endDate: "2027-07-31",
    });

    const { syncPropertyUnitOccupancyForTenantContext } = await import("../../services/tenantPortal/tenantOccupancySyncService");
    const sync = await syncPropertyUnitOccupancyForTenantContext({
      tenantId,
      leaseId,
      applicationId: `application-${eligible ? "current" : "future"}`,
      landlordId: "landlord-1",
      propertyId,
      unitId,
      actorId: "landlord-1",
      idempotencyKey: `application-${eligible ? "current" : "future"}`,
      source: "application_conversion",
      firestore: fakeDb,
      evaluationInstant: "2026-08-23T12:00:00.000Z",
    });
    expect(sync).toMatchObject(eligible
      ? { updated: true, reason: "occupancy_effective" }
      : { updated: false, reason: "created_without_occupancy" });

    const leaseRouter = (await import("../leaseRoutes")).default;
    const propertiesRouter = (await import("../propertiesRoutes")).default;
    const tenantsRouter = (await import("../tenantsRoutes")).default;
    const occupancyReviewRouter = (await import("../occupancyReviewRoutes")).default;

    const properties = await invokeRouter(propertiesRouter, { method: "GET", url: "/" });
    expect(properties.status).toBe(200);
    const property = properties.body.items.find((entry: any) => entry.id === propertyId);
    const projectedUnit = property.units.find((entry: any) => entry.id === unitId);
    expect(projectedUnit).toMatchObject(eligible
      ? { status: "occupied", occupancyStatus: "occupied", currentLeaseId: leaseId, currentTenantId: tenantId }
      : { status: "vacant", occupancyStatus: "vacant" });
    if (!eligible) {
      expect(projectedUnit.currentLeaseId ?? null).toBeNull();
      expect(projectedUnit.currentTenantId ?? null).toBeNull();
    }

    const leases = await invokeRouter(leaseRouter, { method: "GET", url: `/tenant/${tenantId}` });
    expect(leases.status).toBe(200);
    const projectedLease = leases.body.leases.find((entry: any) => entry.id === leaseId);
    expect(projectedLease).toBeDefined();
    expect(projectedLease.canonicalState).toMatchObject(eligible
      ? { occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: leaseId, reasons: [] }
      : { leaseTermState: "upcoming", occupancyState: "vacant", supportingLeaseId: null });
    expect(leases.body.leases.filter((entry: any) =>
      entry.canonicalState?.supportingLeaseId === leaseId && entry.canonicalState?.tenantRelationshipState === "current_occupant"
    )).toHaveLength(eligible ? 1 : 0);

    const tenants = await invokeRouter(tenantsRouter, { method: "GET", url: "/" });
    expect(tenants.status).toBe(200);
    const projectedTenant = tenants.body.tenants.find((entry: any) => entry.id === tenantId);
    expect(projectedTenant).toBeDefined();
    expect(projectedTenant.currentLeaseId ?? null).toBe(eligible ? leaseId : null);
    expect(projectedTenant.canonicalState).toMatchObject(eligible
      ? { occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: leaseId }
      : { occupancyState: "vacant", supportingLeaseId: null });
    if (!eligible) expect(projectedTenant.canonicalState.tenantRelationshipState).not.toBe("current_occupant");

    const detail = await invokeRouter(tenantsRouter, { method: "GET", url: `/${tenantId}` });
    expect(detail.status).toBe(200);
    expect(detail.body.tenant.currentLeaseId ?? null).toBe(eligible ? leaseId : null);
    expect(detail.body.canonicalState).toMatchObject(eligible
      ? { occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: leaseId }
      : { occupancyState: "vacant", supportingLeaseId: null });
    if (eligible) expect(detail.body.lease).toMatchObject({ id: leaseId });
    else {
      expect(detail.body.canonicalState.tenantRelationshipState).not.toBe("current_occupant");
      expect(detail.body.lease).toMatchObject({ id: leaseId });
    }

    const review = await invokeRouter(occupancyReviewRouter, { method: "GET", url: "/" });
    expect(review.status).toBe(200);
    const fixtureReviewItems = review.body.items.filter((item: any) => item.propertyId === propertyId && item.unitId === unitId);
    expect(fixtureReviewItems).toEqual([]);
  });

  it("keeps one foreign invite account-only across Properties, Leases, Tenants, tenant detail, and Review Needed", async () => {
    const propertyId = "property-onboarding-foreign";
    const unitId = "unit-onboarding-foreign";
    const leaseId = "lease-onboarding-foreign";
    const contractualTenantId = "tenant-onboarding-contractual";
    const foreignTenantId = "tenant-onboarding-foreign";
    const applicationId = "application-onboarding-foreign";
    const occupiedUnit = {
      id: unitId,
      unitId,
      unitNumber: "X1",
      status: "occupied",
      occupancyStatus: "occupied",
      tenantId: contractualTenantId,
      currentTenantId: contractualTenantId,
      leaseId,
      currentLeaseId: leaseId,
    };
    const leaseBefore = {
      landlordId: "landlord-1",
      propertyId,
      unitId,
      tenantId: contractualTenantId,
      primaryTenantId: contractualTenantId,
      tenantIds: [contractualTenantId],
      status: "active",
      executionStatus: "fully_executed",
      executionEvidence: { provider: "synthetic", completedAt: "2026-07-31T12:00:00.000Z" },
      occupancyEffective: true,
      startDate: "2026-08-01",
      endDate: "2027-07-31",
      predecessorLeaseId: "lease-onboarding-foreign-predecessor",
      renewalSequence: 2,
    };
    seedDoc("properties", propertyId, {
      landlordId: "landlord-1",
      ownerUserId: "landlord-1",
      name: "Foreign Invite House",
      units: [occupiedUnit],
    });
    seedDoc("units", unitId, { ...occupiedUnit, landlordId: "landlord-1", propertyId });
    seedDoc("leases", leaseId, leaseBefore);
    seedDoc("tenants", contractualTenantId, {
      landlordId: "landlord-1",
      fullName: "Contractual Tenant",
      status: "current",
      currentLeaseId: leaseId,
      propertyId,
      unitId,
    });
    seedDoc("tenancies", "tenancy-onboarding-contractual", {
      landlordId: "landlord-1",
      propertyId,
      unitId,
      tenantId: contractualTenantId,
      leaseId,
      status: "active",
    });
    seedDoc("rentalApplications", applicationId, {
      id: applicationId,
      landlordId: "landlord-1",
      propertyId,
      unitId,
      leaseId,
      convertedTenantId: foreignTenantId,
      applicantEmail: "foreign-tenant@example.com",
      applicantFullName: "Foreign Invite Tenant",
      status: "converted",
    });

    const leaseRouter = (await import("../leaseRoutes")).default;
    const propertiesRouter = (await import("../propertiesRoutes")).default;
    const tenantsRouter = (await import("../tenantsRoutes")).default;
    const occupancyReviewRouter = (await import("../occupancyReviewRoutes")).default;
    const authRouter = (await import("../authRoutes")).default;
    const { createTenancyInvite } = await import("../../services/tenantPortal/tenantInviteService");

    const reviewBefore = await invokeRouter(occupancyReviewRouter, { method: "GET", url: "/" });
    expect(reviewBefore.status).toBe(200);
    const fixtureReviewBefore = reviewBefore.body.items
      .filter((item: any) => item.propertyId === propertyId && item.unitId === unitId)
      .map((item: any) => ({ reasons: item.reasons, tenantId: item.tenantId, supportingLeaseId: item.supportingLeaseId }));
    const foreignReviewBefore = reviewBefore.body.items.filter((item: any) => item.tenantId === foreignTenantId);
    const propertyBefore = JSON.parse(JSON.stringify(listDocs("properties").find((doc) => doc.id === propertyId)?.data));
    const unitBefore = JSON.parse(JSON.stringify(listDocs("units").find((doc) => doc.id === unitId)?.data));
    const canonicalEventCountBefore = listDocs("canonicalEvents").length;
    const leaseStartRequestCountBefore = listDocs("leaseStartRequests").length;

    const created = await createTenancyInvite({
      landlordId: "landlord-1",
      propertyId,
      tenantId: foreignTenantId,
      applicationId,
      unitId,
      leaseId,
      invitedEmail: "foreign-tenant@example.com",
      invitedName: "Foreign Invite Tenant",
      createdBy: "landlord-1",
    });
    clearWriteLog();
    const accepted = await invokeRouter(authRouter, {
      method: "POST",
      url: "/onboard/accept",
      body: { source: "tenant", token: created.token },
      user: null,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ ok: true, accepted: true, role: "tenant", redirectTo: "/tenant" });

    expect(listDocs("leases").find((doc) => doc.id === leaseId)?.data).toEqual(leaseBefore);
    expect(listDocs("properties").find((doc) => doc.id === propertyId)?.data).toEqual(propertyBefore);
    expect(listDocs("units").find((doc) => doc.id === unitId)?.data).toEqual(unitBefore);
    expect(listDocs("tenants").find((doc) => doc.id === foreignTenantId)?.data).toMatchObject({
      tenantId: foreignTenantId,
      leaseId: null,
    });
    expect(listDocs("tenants").find((doc) => doc.id === foreignTenantId)?.data).not.toHaveProperty("currentLeaseId");
    expect(listDocs("tenancies").filter((doc) =>
      doc.data.tenantId === foreignTenantId && doc.data.status === "active"
    )).toEqual([]);
    expect(listDocs("canonicalEvents")).toHaveLength(canonicalEventCountBefore);
    expect(listDocs("leaseStartRequests")).toHaveLength(leaseStartRequestCountBefore);
    expect(writeLog.filter((write) =>
      ["properties", "units", "leases", "canonicalEvents", "leaseStartRequests"].includes(write.collection)
    )).toEqual([]);

    const properties = await invokeRouter(propertiesRouter, { method: "GET", url: "/" });
    expect(properties.status).toBe(200);
    const property = properties.body.items.find((entry: any) => entry.id === propertyId);
    expect(property.units.find((entry: any) => entry.id === unitId)).toMatchObject({
      status: "occupied",
      occupancyStatus: "occupied",
      currentLeaseId: leaseId,
      currentTenantId: contractualTenantId,
    });
    expect(property.units.find((entry: any) => entry.id === unitId).currentTenantId).not.toBe(foreignTenantId);

    const leases = await invokeRouter(leaseRouter, { method: "GET", url: `/tenant/${foreignTenantId}` });
    expect(leases.status).toBe(200);
    expect(leases.body.leases.find((entry: any) => entry.id === leaseId)).toBeUndefined();

    const tenants = await invokeRouter(tenantsRouter, { method: "GET", url: "/" });
    expect(tenants.status).toBe(200);
    const foreignTenant = tenants.body.tenants.find((entry: any) => entry.id === foreignTenantId);
    expect(foreignTenant).toBeDefined();
    expect(foreignTenant.currentLeaseId ?? null).toBeNull();
    expect(foreignTenant.canonicalState).toMatchObject({ supportingLeaseId: null });
    expect(foreignTenant.canonicalState.tenantRelationshipState).not.toBe("current_occupant");
    expect(tenants.body.tenants.find((entry: any) => entry.id === contractualTenantId)).toMatchObject({
      currentLeaseId: leaseId,
      canonicalState: expect.objectContaining({
        occupancyState: "occupied",
        tenantRelationshipState: "current_occupant",
        supportingLeaseId: leaseId,
      }),
    });

    const detail = await invokeRouter(tenantsRouter, { method: "GET", url: `/${foreignTenantId}` });
    expect(detail.status).toBe(200);
    expect(detail.body.tenant.currentLeaseId ?? null).toBeNull();
    expect(detail.body.lease ?? null).toBeNull();
    expect(detail.body.canonicalState).toMatchObject({ supportingLeaseId: null });
    expect(detail.body.canonicalState.tenantRelationshipState).not.toBe("current_occupant");

    const reviewAfter = await invokeRouter(occupancyReviewRouter, { method: "GET", url: "/" });
    expect(reviewAfter.status).toBe(200);
    const fixtureReviewAfter = reviewAfter.body.items
      .filter((item: any) => item.propertyId === propertyId && item.unitId === unitId)
      .map((item: any) => ({ reasons: item.reasons, tenantId: item.tenantId, supportingLeaseId: item.supportingLeaseId }));
    expect(fixtureReviewAfter).toEqual(fixtureReviewBefore);
    expect(reviewAfter.body.items.filter((item: any) => item.tenantId === foreignTenantId)).toEqual(foreignReviewBefore);
    expect(fixtureReviewAfter.flatMap((item: any) => item.reasons)).not.toContain("TENANT_CURRENT_WITHOUT_CURRENT_LEASE");
    expect(fixtureReviewAfter.map((item: any) => item.tenantId)).not.toContain(foreignTenantId);
  });

  it("rejects one future explicit start with zero occupancy writes across all five product surfaces", async () => {
    const propertyId = "property-rejected-explicit-start";
    const unitId = "unit-rejected-explicit-start";
    const leaseId = "lease-rejected-explicit-start";
    const tenantId = "tenant-rejected-explicit-start";
    const unit = { id: unitId, unitId, unitNumber: "F1", status: "vacant", occupancyStatus: "vacant", updatedAt: "2026-08-23T00:00:00.000Z" };
    seedDoc("properties", propertyId, { landlordId: "landlord-1", ownerUserId: "landlord-1", name: "Future Start House", units: [unit], updatedAt: unit.updatedAt });
    seedDoc("units", unitId, { ...unit, landlordId: "landlord-1", propertyId });
    seedDoc("tenants", tenantId, { landlordId: "landlord-1", fullName: "Future Tenant", status: "past", updatedAt: unit.updatedAt });
    seedDoc("leases", leaseId, { landlordId: "landlord-1", propertyId, unitId, tenantId, primaryTenantId: tenantId, tenantIds: [tenantId], status: "active", executionStatus: "fully_executed", occupancyEffective: false, startDate: "2099-08-01", endDate: "2100-07-31", monthlyRent: 1800, updatedAt: unit.updatedAt });

    const leaseRouter = (await import("../leaseRoutes")).default;
    const propertiesRouter = (await import("../propertiesRoutes")).default;
    const tenantsRouter = (await import("../tenantsRoutes")).default;
    const occupancyReviewRouter = (await import("../occupancyReviewRoutes")).default;
    const project = async () => {
      const properties = await invokeRouter(propertiesRouter, { method: "GET", url: "/" });
      const leases = await invokeRouter(leaseRouter, { method: "GET", url: "/active" });
      const tenants = await invokeRouter(tenantsRouter, { method: "GET", url: "/" });
      const detail = await invokeRouter(tenantsRouter, { method: "GET", url: `/${tenantId}` });
      const review = await invokeRouter(occupancyReviewRouter, { method: "GET", url: "/" });
      return {
        property: properties.body.items.find((entry: any) => entry.id === propertyId),
        lease: leases.body.leases.find((entry: any) => entry.id === leaseId),
        tenant: tenants.body.tenants.find((entry: any) => entry.id === tenantId),
        detail: detail.body,
        review: review.body.items.filter((item: any) => item.propertyId === propertyId && item.unitId === unitId),
      };
    };
    const before = await project();
    const context = await invokeRouter(leaseRouter, { method: "GET", url: `/${leaseId}/occupancy-start-context` });
    expect(context.body.context).toMatchObject({ eligible: false, canonicalBlocker: "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY" });
    clearWriteLog();
    const rejected = await invokeRouter(leaseRouter, { method: "POST", url: `/${leaseId}/start-occupancy`, headers: { "idempotency-key": "rejected-explicit-cross-surface" }, body: { expectedStateToken: context.body.context.expectedStateToken, evaluationInstant: context.body.context.evaluationInstant, possessionConfirmed: true } });
    expect(rejected.status).toBe(409);
    expect(rejected.body.ok).toBe(false);
    expect(writeLog.filter((write) => ["properties", "units", "leases", "tenants", "tenancies", "canonicalEvents"].includes(write.collection))).toEqual([]);
    expect(listDocs("tenancies").filter((doc) => doc.data.leaseId === leaseId && doc.data.status === "active")).toEqual([]);
    expect(listDocs("canonicalEvents").filter((doc) => doc.data.type === "lease.occupancy_started")).toEqual([]);
    expect(await project()).toEqual(before);
  });

  it("projects current signing completion as executed but vacant through Review Needed", async () => {
    process.env.SIGNING_PROVIDER = "mock";
    process.env.PUBLIC_APP_URL = "http://localhost:5173";
    const propertyId = "property-signing-execution-only";
    const unitId = "unit-signing-execution-only";
    const leaseId = "lease-signing-execution-only";
    const tenantId = "tenant-signing-execution-only";
    const unit = { id: unitId, unitId, unitNumber: "S2", status: "vacant", occupancyStatus: "vacant" };
    seedDoc("properties", propertyId, { landlordId: "landlord-1", ownerUserId: "landlord-1", name: "Signing House", units: [unit] });
    seedDoc("units", unitId, { ...unit, landlordId: "landlord-1", propertyId });
    seedDoc("tenants", tenantId, { landlordId: "landlord-1", fullName: "Signed Tenant", status: "past" });
    seedDoc("leases", leaseId, { landlordId: "landlord-1", propertyId, unitId, tenantId, primaryTenantId: tenantId, tenantIds: [tenantId], status: "active", executionStatus: "pending_signature", occupancyEffective: false, startDate: "2026-08-01", endDate: "2027-07-31" });

    const { processSigningWebhook, sendLeaseForSignature } = await import("../../services/signing/leaseSigningService");
    const sent = await sendLeaseForSignature({ leaseId, landlordId: "landlord-1", lease: { startDate: "2026-08-01" }, tenantEmails: ["signed@example.com"] });
    const signingRequest = listDocs("leaseSigningRequests").find((doc) => doc.id === sent.signingRequestId)?.data;
    const body = { providerRequestId: signingRequest.providerRequestId, eventId: "provider-execution-only-1", type: "signed", occurredAt: "2026-08-24T12:00:00.000Z" };
    await processSigningWebhook({ providerId: "mock", headers: {}, body });
    await processSigningWebhook({ providerId: "mock", headers: {}, body });

    expect(listDocs("leases").find((doc) => doc.id === leaseId)?.data).toMatchObject({ executionStatus: "fully_executed", occupancyEffective: false });
    expect(listDocs("units").find((doc) => doc.id === unitId)?.data).toMatchObject({ status: "vacant", occupancyStatus: "vacant" });
    expect(listDocs("tenancies").filter((doc) => doc.data.leaseId === leaseId && doc.data.status === "active")).toEqual([]);
    expect(listDocs("canonicalEvents").filter((doc) => doc.data.type === "lease.occupancy_started")).toEqual([]);
    expect(listDocs("leaseSigningEvents").filter((doc) => doc.data.type === "signed")).toHaveLength(1);
    const reviewRouter = (await import("../occupancyReviewRoutes")).default;
    const review = await invokeRouter(reviewRouter, { method: "GET", url: "/" });
    expect(review.body.items.filter((item: any) => item.propertyId === propertyId && item.unitId === unitId)).toEqual([
      expect.objectContaining({ reasons: ["VACANT_WITH_CURRENT_LEASE"], supportingLeaseId: leaseId }),
    ]);
  });

  it("projects one explicit occupancy start through Properties, Leases, Tenants, tenant detail, and Review Needed", async () => {
    const propertyId = "property-explicit-start";
    const unitId = "unit-explicit-start";
    const leaseId = "lease-explicit-start";
    const tenantId = "tenant-explicit-start";
    const unit = { id: unitId, unitId, unitNumber: "S1", status: "vacant", occupancyStatus: "vacant", updatedAt: "2026-08-23T00:00:00.000Z" };
    seedDoc("properties", propertyId, { landlordId: "landlord-1", ownerUserId: "landlord-1", name: "Explicit Start House", units: [unit], updatedAt: unit.updatedAt });
    seedDoc("units", unitId, { ...unit, landlordId: "landlord-1", propertyId });
    seedDoc("tenants", tenantId, { landlordId: "landlord-1", fullName: "Explicit Tenant", status: "past", propertyId, unitId, updatedAt: unit.updatedAt });
    seedDoc("leases", leaseId, { landlordId: "landlord-1", propertyId, unitId, tenantId, primaryTenantId: tenantId, tenantIds: [tenantId], status: "active", executionStatus: "fully_executed", occupancyEffective: false, startDate: "2026-08-01", endDate: "2027-07-31", monthlyRent: 1800, updatedAt: unit.updatedAt });

    const leaseRouter = (await import("../leaseRoutes")).default;
    const propertiesRouter = (await import("../propertiesRoutes")).default;
    const tenantsRouter = (await import("../tenantsRoutes")).default;
    const occupancyReviewRouter = (await import("../occupancyReviewRoutes")).default;
    const context = await invokeRouter(leaseRouter, { method: "GET", url: `/${leaseId}/occupancy-start-context` });
    expect(context.body.context).toMatchObject({ eligible: true, availableAction: "start_occupancy" });
    const started = await invokeRouter(leaseRouter, { method: "POST", url: `/${leaseId}/start-occupancy`, headers: { "idempotency-key": "explicit-cross-surface" }, body: { expectedStateToken: context.body.context.expectedStateToken, evaluationInstant: context.body.context.evaluationInstant, possessionConfirmed: true } });
    expect(started.status).toBe(200);

    const properties = await invokeRouter(propertiesRouter, { method: "GET", url: "/" });
    expect(properties.body.items.find((entry: any) => entry.id === propertyId).units.find((entry: any) => entry.id === unitId)).toMatchObject({ status: "occupied", currentLeaseId: leaseId, currentTenantId: tenantId });
    const leases = await invokeRouter(leaseRouter, { method: "GET", url: "/active" });
    expect(leases.body.leases.find((entry: any) => entry.id === leaseId)?.canonicalState).toMatchObject({ occupancyState: "occupied", supportingLeaseId: leaseId, reasons: [] });
    const tenants = await invokeRouter(tenantsRouter, { method: "GET", url: "/" });
    expect(tenants.body.tenants.find((entry: any) => entry.id === tenantId)).toMatchObject({ currentLeaseId: leaseId, canonicalState: expect.objectContaining({ tenantRelationshipState: "current_occupant", supportingLeaseId: leaseId }) });
    const detail = await invokeRouter(tenantsRouter, { method: "GET", url: `/${tenantId}` });
    expect(detail.body).toMatchObject({ tenant: expect.objectContaining({ currentLeaseId: leaseId }), canonicalState: expect.objectContaining({ occupancyState: "occupied", supportingLeaseId: leaseId }), lease: expect.objectContaining({ id: leaseId }), currentLease: expect.objectContaining({ id: leaseId }) });
    expect(detail.body.currentLease.id).toBe(detail.body.canonicalState.supportingLeaseId);
    const review = await invokeRouter(occupancyReviewRouter, { method: "GET", url: "/" });
    expect(review.body.items.filter((item: any) => item.propertyId === propertyId && item.unitId === unitId)).toEqual([]);
    expect(listDocs("canonicalEvents").filter((doc) => doc.data.type === "lease.occupancy_started")).toHaveLength(1);
  });

  it("projects one coherent renewal handoff through Properties, Leases, Tenants, tenant detail, and Review Needed", async () => {
    const futureUnit = {
      id: "unit-renewal-future", unitNumber: "F1", status: "occupied", occupancyStatus: "occupied",
      tenantId: "tenant-future", currentTenantId: "tenant-future", leaseId: "lease-future-predecessor", currentLeaseId: "lease-future-predecessor",
    };
    const handoffUnit = {
      id: "unit-renewal", unitNumber: "R1", status: "occupied", occupancyStatus: "occupied",
      tenantId: "tenant-renewal-a", currentTenantId: "tenant-renewal-a", leaseId: "lease-predecessor", currentLeaseId: "lease-predecessor",
    };
    seedDoc("properties", "property-renewal", {
      landlordId: "landlord-1", ownerUserId: "landlord-1", name: "Renewal House", units: [futureUnit, handoffUnit],
    });
    seedDoc("units", futureUnit.id, { ...futureUnit, landlordId: "landlord-1", propertyId: "property-renewal" });
    seedDoc("units", handoffUnit.id, { ...handoffUnit, landlordId: "landlord-1", propertyId: "property-renewal" });
    seedDoc("tenants", "tenant-future", { landlordId: "landlord-1", fullName: "Future Tenant", status: "current", currentLeaseId: "lease-future-predecessor", propertyId: "property-renewal", unitId: futureUnit.id });
    seedDoc("tenants", "tenant-renewal-a", { landlordId: "landlord-1", fullName: "Renewal Tenant A", status: "current", currentLeaseId: "lease-predecessor", propertyId: "property-renewal", unitId: handoffUnit.id });
    seedDoc("tenants", "tenant-renewal-b", { landlordId: "landlord-1", fullName: "Renewal Tenant B", status: "current", currentLeaseId: "lease-predecessor", propertyId: "property-renewal", unitId: handoffUnit.id });
    seedDoc("leases", "lease-future-predecessor", {
      landlordId: "landlord-1", propertyId: "property-renewal", unitId: futureUnit.id,
      tenantId: "tenant-future", tenantIds: ["tenant-future"], status: "active", executionStatus: "fully_executed",
      occupancyEffective: true, renewedByLeaseId: "lease-future-successor", startDate: "2026-01-01", endDate: "2026-12-31",
    });
    seedDoc("leases", "lease-future-successor", {
      landlordId: "landlord-1", propertyId: "property-renewal", unitId: futureUnit.id,
      tenantId: "tenant-future", tenantIds: ["tenant-future"], status: "pending", executionStatus: "fully_executed",
      occupancyEffective: false, predecessorLeaseId: "lease-future-predecessor", startDate: "2099-01-01", endDate: "2099-12-31",
    });
    const participants = ["tenant-renewal-a", "tenant-renewal-b"];
    seedDoc("leases", "lease-predecessor", {
      landlordId: "landlord-1", propertyId: "property-renewal", unitId: handoffUnit.id,
      tenantId: participants[0], primaryTenantId: participants[0], tenantIds: participants,
      status: "active", executionStatus: "fully_executed", occupancyEffective: true,
      renewedByLeaseId: "lease-successor", startDate: "2025-08-23", endDate: "2026-08-22", monthlyRent: 1800,
    });
    seedDoc("leases", "lease-successor", {
      landlordId: "landlord-1", propertyId: "property-renewal", unitId: handoffUnit.id,
      tenantId: participants[0], primaryTenantId: participants[0], tenantIds: participants,
      status: "active", executionStatus: "fully_executed", occupancyEffective: false,
      predecessorLeaseId: "lease-predecessor", startDate: "2026-08-23", endDate: "2027-08-22", monthlyRent: 1850,
    });
    for (const tenantId of participants) {
      seedDoc("tenancies", `predecessor-${tenantId}`, {
        landlordId: "landlord-1", propertyId: "property-renewal", unitId: handoffUnit.id,
        tenantId, leaseId: "lease-predecessor", status: "active", moveOutAt: null,
      });
    }

    const leaseRouter = (await import("../leaseRoutes")).default;
    const propertiesRouter = (await import("../propertiesRoutes")).default;
    const tenantsRouter = (await import("../tenantsRoutes")).default;
    const occupancyReviewRouter = (await import("../occupancyReviewRoutes")).default;

    const futureProperties = await invokeRouter(propertiesRouter, { method: "GET", url: "/" });
    expect(futureProperties.status).toBe(200);
    const futureProperty = futureProperties.body.items.find((entry: any) => entry.id === "property-renewal");
    expect(futureProperty.units.find((entry: any) => entry.id === futureUnit.id)).toMatchObject({ currentLeaseId: "lease-future-predecessor" });
    const futureLeases = await invokeRouter(leaseRouter, { method: "GET", url: "/tenant/tenant-future" });
    expect(futureLeases.body.leases.find((entry: any) => entry.id === "lease-future-predecessor")?.canonicalState).toMatchObject({
      occupancyState: "occupied", supportingLeaseId: "lease-future-predecessor",
    });
    expect(futureLeases.body.leases.find((entry: any) => entry.id === "lease-future-successor")?.canonicalState?.supportingLeaseId).not.toBe("lease-future-successor");
    const futureTenants = await invokeRouter(tenantsRouter, { method: "GET", url: "/" });
    expect(futureTenants.status).toBe(200);
    expect(futureTenants.body.tenants.find((entry: any) => entry.id === "tenant-future")).toMatchObject({
      currentLeaseId: "lease-future-predecessor",
      canonicalState: expect.objectContaining({ supportingLeaseId: "lease-future-predecessor" }),
    });
    const futureTenant = await invokeRouter(tenantsRouter, { method: "GET", url: "/tenant-future" });
    expect(futureTenant.body?.tenant?.currentLeaseId).toBe("lease-future-predecessor");
    expect(futureTenant.body?.canonicalState).toMatchObject({
      occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: "lease-future-predecessor",
    });
    const futureReview = await invokeRouter(occupancyReviewRouter, { method: "GET", url: "/" });
    expect(futureReview.status).toBe(200);
    expect(futureReview.body.items.filter((item: any) => item.propertyId === "property-renewal" && item.unitId === futureUnit.id)).toEqual([]);

    const { getRenewalContinuityContext, handoffRenewalContinuity } = await import("../../services/leaseStart/renewalContinuityService");
    const context = await getRenewalContinuityContext({
      landlordId: "landlord-1", successorLeaseId: "lease-successor",
      evaluationInstant: "2026-08-23T12:00:00.000Z", firestore: fakeDb,
    });
    await handoffRenewalContinuity({
      landlordId: "landlord-1", successorLeaseId: "lease-successor",
      evaluationInstant: "2026-08-23T12:00:00.000Z", expectedStateToken: context.expectedStateToken,
      idempotencyKey: "renewal-cross-surface", actorId: "landlord-1", source: "cross_surface_test", firestore: fakeDb,
    });

    const properties = await invokeRouter(propertiesRouter, { method: "GET", url: "/" });
    expect(properties.status).toBe(200);
    const property = properties.body.items.find((entry: any) => entry.id === "property-renewal");
    expect(property.units.find((entry: any) => entry.id === handoffUnit.id)).toMatchObject({
      status: "occupied", occupancyStatus: "occupied", currentLeaseId: "lease-successor", currentTenantId: "tenant-renewal-a",
    });

    const activeLeases = await invokeRouter(leaseRouter, { method: "GET", url: "/active" });
    expect(activeLeases.status).toBe(200);
    expect(activeLeases.body.leases.find((entry: any) => entry.id === "lease-successor")?.canonicalState).toMatchObject({
      occupancyState: "occupied", supportingLeaseId: "lease-successor", reasons: [],
    });
    expect(activeLeases.body.leases.find((entry: any) => entry.id === "lease-predecessor")).toBeUndefined();

    const tenants = await invokeRouter(tenantsRouter, { method: "GET", url: "/" });
    expect(tenants.status).toBe(200);
    for (const tenantId of participants) {
      expect(tenants.body.tenants.find((entry: any) => entry.id === tenantId)).toMatchObject({
        currentLeaseId: "lease-successor", canonicalState: expect.objectContaining({ tenantRelationshipState: "current_occupant", supportingLeaseId: "lease-successor" }),
      });
      const detail = await invokeRouter(tenantsRouter, { method: "GET", url: `/${tenantId}` });
      expect(detail.status).toBe(200);
      expect(detail.body.tenant).toMatchObject({ currentLeaseId: "lease-successor" });
      expect(detail.body.canonicalState).toMatchObject({ occupancyState: "occupied", tenantRelationshipState: "current_occupant", supportingLeaseId: "lease-successor" });
      expect(detail.body.lease).toMatchObject({ id: "lease-successor" });

      // TenantLeasePanel consumes this route as the tenant-detail workspace's
      // current and historical lease source. It must retain the renewed
      // predecessor while classifying only the successor as current.
      const leaseHistory = await invokeRouter(leaseRouter, { method: "GET", url: `/tenant/${tenantId}` });
      expect(leaseHistory.status).toBe(200);
      expect(leaseHistory.body.leases.find((entry: any) => entry.id === "lease-successor")?.canonicalState).toMatchObject({
        occupancyState: "occupied", supportingLeaseId: "lease-successor", reasons: [],
      });
      expect(leaseHistory.body.leases.find((entry: any) => entry.id === "lease-predecessor")).toMatchObject({
        id: "lease-predecessor", status: "renewed", startDate: "2025-08-23", endDate: "2026-08-22",
        monthlyRent: 1800, occupancyEffective: false,
        canonicalState: expect.objectContaining({ occupancyState: "occupied", supportingLeaseId: "lease-successor" }),
      });
    }

    const review = await invokeRouter(occupancyReviewRouter, { method: "GET", url: "/" });
    expect(review.status).toBe(200);
    expect(review.body.items.filter((item: any) => item.propertyId === "property-renewal" && item.unitId === handoffUnit.id)).toEqual([]);
  });
});
