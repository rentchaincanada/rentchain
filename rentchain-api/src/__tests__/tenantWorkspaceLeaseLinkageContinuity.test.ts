import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildLifecycleContinuityLease,
  buildLifecycleContinuityLeaseDocument,
  buildLifecycleContinuityProperty,
  buildLifecycleContinuityTenant,
  buildLifecycleContinuityUnits,
  lifecycleContinuityDates,
  lifecycleContinuityIds,
} from "./fixtures/lifecycleContinuityFixtures";

const getSignedDownloadUrlMock = vi.fn();
const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));
const { stripeCheckoutCreateMock } = vi.hoisted(() => ({
  stripeCheckoutCreateMock: vi.fn(),
}));

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function applyMerge(current: any, incoming: any) {
  return { ...(current || {}), ...clone(incoming || {}) };
}

function getNestedValue(data: any, field: string) {
  return String(field || "")
    .split(".")
    .reduce((current, key) => (current == null ? undefined : current[key]), data);
}

function applyFilters(rows: Array<[string, any]>, filters: Array<{ field: string; op: string; value: any }>) {
  return rows.filter(([, data]) =>
    filters.every((filter) => {
      const current = getNestedValue(data, filter.field);
      if (filter.op === "==") return current === filter.value;
      if (filter.op === "array-contains") return Array.isArray(current) && current.includes(filter.value);
      return false;
    }),
  );
}

function makeSnapshot(name: string, filters: Array<{ field: string; op: string; value: any }>, limitCount?: number) {
  const docs = applyFilters(Array.from(ensureCollection(name).entries()), filters)
    .slice(0, typeof limitCount === "number" ? limitCount : undefined)
    .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
  return { docs, empty: docs.length === 0, size: docs.length };
}

function createQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
  const api: any = {
    where(field: string, op: string, value: any) {
      return createQuery(name, [...filters, { field, op, value }]);
    },
    orderBy() {
      return api;
    },
    limit(count: number) {
      return {
        get: async () => makeSnapshot(name, filters, count),
      };
    },
    get: async () => makeSnapshot(name, filters),
  };
  return api;
}

const dbMock = {
  collection: (name: string) => ({
    get: async () => makeSnapshot(name, []),
    doc: (id?: string) => {
      const docId = id || `doc_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: ensureCollection(name).has(docId),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(docId) || {};
          ensureCollection(name).set(docId, opts?.merge ? applyMerge(current, value) : clone(value));
        },
      };
    },
    where: (field: string, op: string, value: any) => createQuery(name, [{ field, op, value }]),
  }),
  runTransaction: async (handler: (tx: any) => Promise<any>) => {
    const tx = {
      get: async (docRef: any) => docRef.get(),
      set: async (docRef: any, value: any, opts?: { merge?: boolean }) => docRef.set(value, opts),
    };
    return handler(tx);
  },
};

vi.mock("../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
    arrayUnion: (...values: any[]) => ({ __op: "arrayUnion", values }),
  },
}));

vi.mock("../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("../config/requiredEnv", () => ({
  getEnvFlags: () => ({ emailConfigured: true, emailProvider: "mailgun" }),
}));

vi.mock("../services/stripeService", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({
    checkout: {
      sessions: {
        create: stripeCheckoutCreateMock,
      },
    },
  }),
}));

vi.mock("../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) req.user = JSON.parse(header);
    next();
  },
}));

vi.mock("../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: getSignedDownloadUrlMock,
}));

async function invokeRouter(
  router: any,
  options: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  },
) {
  return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
    const headers: Record<string, any> = {};
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      query: {},
      params: {},
    };
    const res: any = {
      statusCode: 200,
      setHeader(key: string, value: any) {
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

function tenantHeaders(tenantId = lifecycleContinuityIds.activeTenantId, email = "john.smith@example.test") {
  return {
    "x-test-user": JSON.stringify({
      id: `user_${tenantId}`,
      email,
      role: "tenant",
      tenantId,
    }),
  };
}

function seedBaseLifecycleDocuments() {
  const property = buildLifecycleContinuityProperty();
  ensureCollection("properties").set(lifecycleContinuityIds.propertyId, {
    ...property,
    rc_prop_id: "rc-lc-north-towers",
    street1: "10 Harbour Road",
    city: "Halifax",
    province: "NS",
    postalCode: "B3H1A1",
  });

  for (const unit of buildLifecycleContinuityUnits()) {
    ensureCollection("units").set(String(unit.id), unit);
  }

  ensureCollection("tenants").set(
    lifecycleContinuityIds.activeTenantId,
    buildLifecycleContinuityTenant("active", {
      leaseId: lifecycleContinuityIds.activeLeaseId,
      currentLeaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
    }),
  );
  ensureCollection("tenants").set(
    lifecycleContinuityIds.upcomingTenantId,
    buildLifecycleContinuityTenant("upcoming", {
      leaseId: lifecycleContinuityIds.upcomingLeaseId,
      currentLeaseId: lifecycleContinuityIds.upcomingLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit103Id,
    }),
  );
  ensureCollection("tenants").set(
    lifecycleContinuityIds.archivedTenantId,
    buildLifecycleContinuityTenant("archived", {
      leaseId: lifecycleContinuityIds.archivedLeaseId,
      currentLeaseId: lifecycleContinuityIds.archivedLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
    }),
  );

  ensureCollection("leases").set(
    lifecycleContinuityIds.activeLeaseId,
    buildLifecycleContinuityLease("active", {
      fullyExecutedAt: lifecycleContinuityDates.now,
      tenantSignedAt: lifecycleContinuityDates.now,
      landlordSignedAt: lifecycleContinuityDates.now,
      signedDocumentId: lifecycleContinuityIds.signedDocumentId,
      signedDocumentUrl: "https://example.test/docs/signed-active-lease.pdf",
      documentUrl: "https://example.test/docs/generated-active-lease.pdf",
      updatedAt: 2000,
    }),
  );
  ensureCollection("leases").set(
    lifecycleContinuityIds.upcomingLeaseId,
    buildLifecycleContinuityLease("upcoming", {
      status: "ready_for_signature",
      documentUrl: null,
      approvedDocumentUrl: null,
      documentRef: null,
      updatedAt: 1500,
    }),
  );
  ensureCollection("leases").set(
    lifecycleContinuityIds.archivedLeaseId,
    buildLifecycleContinuityLease("archived", {
      documentUrl: "https://example.test/docs/archived-lease.pdf",
      updatedAt: 100,
    }),
  );
}

async function tenantRouter() {
  return (await import("../routes/tenantPortalRoutes")).default;
}

describe("tenant workspace lease linkage continuity", () => {
  beforeEach(() => {
    vi.resetModules();
    collections.clear();
    sendEmailMock.mockReset();
    stripeCheckoutCreateMock.mockReset();
    getSignedDownloadUrlMock.mockReset();
    getSignedDownloadUrlMock.mockImplementation(async ({ path }: { path: string }) => `https://signed.example/${path}`);
    seedBaseLifecycleDocuments();
  });

  it("shows the same active lease as current in tenant workspace and tenant profile", async () => {
    const router = await tenantRouter();

    const workspace = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
      headers: tenantHeaders(),
    });
    const profile = await invokeRouter(router, {
      method: "GET",
      url: "/profile",
      headers: tenantHeaders(),
    });

    expect(workspace.status).toBe(200);
    expect(profile.status).toBe(200);
    expect(workspace.body.data.lease).toEqual(
      expect.objectContaining({
        leaseId: lifecycleContinuityIds.activeLeaseId,
        status: "active",
        startDate: lifecycleContinuityDates.activeLeaseStart,
        endDate: lifecycleContinuityDates.activeLeaseEnd,
      }),
    );
    expect(profile.body.data.profile.lease).toEqual(
      expect.objectContaining({
        leaseId: expect.stringMatching(/^lease-ref-/),
        status: "active",
        startDate: lifecycleContinuityDates.activeLeaseStart,
        endDate: lifecycleContinuityDates.activeLeaseEnd,
      }),
    );
    const serializedProfileLease = JSON.stringify(profile.body.data.profile.lease);
    expect(serializedProfileLease).not.toContain(lifecycleContinuityIds.activeLeaseId);
    expect(serializedProfileLease).not.toContain(lifecycleContinuityIds.tenantId);
    expect(serializedProfileLease).not.toContain(lifecycleContinuityIds.propertyId);
    expect(serializedProfileLease).not.toContain(lifecycleContinuityIds.unit101Id);
  });

  it("resolves tenant lease route to the canonical lease context without raw ID display labels", async () => {
    const router = await tenantRouter();

    const lease = await invokeRouter(router, {
      method: "GET",
      url: "/lease",
      headers: tenantHeaders(),
    });

    expect(lease.status).toBe(200);
    expect(lease.body.data).toEqual(
      expect.objectContaining({
        leaseId: lifecycleContinuityIds.activeLeaseId,
      }),
    );
    expect(lease.body.data.leaseDocumentContext).toEqual(
      expect.objectContaining({
        propertyId: lifecycleContinuityIds.propertyId,
        unitId: lifecycleContinuityIds.unit101Id,
      }),
    );
    expect(lease.body.data.leaseDocumentContext.displayLabel).toBe("Signed lease document");
    expect(lease.body.data.leaseDocumentContext.displayLabel).not.toContain(lifecycleContinuityIds.activeLeaseId);
  });

  it("prefers signed lease document fields when a generated lease package is also available", async () => {
    const generated = buildLifecycleContinuityLeaseDocument("generated", {
      id: "lc_generated_same_lease",
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      url: "https://example.test/docs/generated-attachment.pdf",
      createdAt: 9999,
      category: "Lease",
      purpose: "LEASE",
      purposeLabel: "Lease",
      title: "Lease document",
      ledgerItemId: lifecycleContinuityIds.activeLeaseId,
      source: "lease_pdf_generation",
    });
    ensureCollection("ledgerAttachments").set(String(generated.id), generated);
    const router = await tenantRouter();

    const lease = await invokeRouter(router, {
      method: "GET",
      url: "/lease",
      headers: tenantHeaders(),
    });

    expect(lease.status).toBe(200);
    expect(lease.body.data.documentUrl).toBe("https://example.test/docs/signed-active-lease.pdf");
    expect(lease.body.data.leaseDocumentContext).toEqual(
      expect.objectContaining({
        leaseId: lifecycleContinuityIds.activeLeaseId,
        documentStatus: "signed",
        documentUrl: "https://example.test/docs/signed-active-lease.pdf",
        source: "lease_signed_document",
        confidence: "high",
      }),
    );
  });

  it("uses generated unsigned lease package attachments when no signed document exists", async () => {
    ensureCollection("leases").set(
      lifecycleContinuityIds.activeLeaseId,
      buildLifecycleContinuityLease("active", {
        status: "ready_for_signature",
        signedDocumentUrl: null,
        documentUrl: null,
        approvedDocumentUrl: null,
        documentRef: null,
      }),
    );
    const generated = buildLifecycleContinuityLeaseDocument("generated", {
      id: lifecycleContinuityIds.generatedDocumentId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      url: "https://example.test/docs/generated-active-lease.pdf",
      createdAt: 900,
      category: "Lease",
      purpose: "LEASE",
      purposeLabel: "Lease",
      title: "Lease document",
      ledgerItemId: lifecycleContinuityIds.activeLeaseId,
      source: "lease_pdf_generation",
    });
    ensureCollection("ledgerAttachments").set(String(generated.id), generated);
    const router = await tenantRouter();

    const lease = await invokeRouter(router, {
      method: "GET",
      url: "/lease",
      headers: tenantHeaders(),
    });

    expect(lease.status).toBe(200);
    expect(lease.body.data.leaseDocumentContext).toEqual(
      expect.objectContaining({
        leaseId: lifecycleContinuityIds.activeLeaseId,
        documentStatus: "generated",
        documentUrl: "https://example.test/docs/generated-active-lease.pdf",
        displayLabel: "Generated lease package",
        source: "ledgerAttachments",
      }),
    );
  });

  it("shows a safe missing document fallback when no tenant-safe lease document exists", async () => {
    ensureCollection("leases").set(
      lifecycleContinuityIds.activeLeaseId,
      buildLifecycleContinuityLease("active", {
        status: "active",
        signedDocumentUrl: null,
        documentUrl: null,
        approvedDocumentUrl: null,
        documentRef: null,
        documentStatus: null,
      }),
    );
    const router = await tenantRouter();

    const lease = await invokeRouter(router, {
      method: "GET",
      url: "/lease",
      headers: tenantHeaders(),
    });

    expect(lease.status).toBe(200);
    expect(lease.body.data.leaseDocumentContext).toEqual(
      expect.objectContaining({
        documentStatus: "missing",
        displayLabel: "No lease document available yet",
        source: "missing_document",
      }),
    );
  });

  it("does not show archived lease references as the current tenant workspace lease", async () => {
    ensureCollection("tenants").set(
      lifecycleContinuityIds.activeTenantId,
      buildLifecycleContinuityTenant("active", {
        leaseId: lifecycleContinuityIds.archivedLeaseId,
        currentLeaseId: lifecycleContinuityIds.archivedLeaseId,
        propertyId: lifecycleContinuityIds.propertyId,
        unitId: lifecycleContinuityIds.unit101Id,
      }),
    );
    const router = await tenantRouter();

    const workspace = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
      headers: tenantHeaders(),
    });

    expect(workspace.status).toBe(200);
    expect(workspace.body.data.lease.leaseId).toBe(lifecycleContinuityIds.activeLeaseId);
    expect(workspace.body.data.lease.leaseId).not.toBe(lifecycleContinuityIds.archivedLeaseId);
  });

  it("resolves multiple generated lease attachments deterministically by current lease and recency", async () => {
    ensureCollection("leases").set(
      lifecycleContinuityIds.activeLeaseId,
      buildLifecycleContinuityLease("active", {
        status: "ready_for_signature",
        signedDocumentUrl: null,
        documentUrl: null,
        approvedDocumentUrl: null,
        documentRef: null,
      }),
    );
    ensureCollection("ledgerAttachments").set("older-generated", {
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      ledgerItemId: lifecycleContinuityIds.activeLeaseId,
      title: "Lease document",
      category: "Lease",
      purpose: "LEASE",
      purposeLabel: "Lease",
      url: "https://example.test/docs/older-generated.pdf",
      createdAt: 100,
    });
    ensureCollection("ledgerAttachments").set("newer-generated", {
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      ledgerItemId: lifecycleContinuityIds.activeLeaseId,
      title: "Lease document",
      category: "Lease",
      purpose: "LEASE",
      purposeLabel: "Lease",
      url: "https://example.test/docs/newer-generated.pdf",
      createdAt: 200,
    });
    const router = await tenantRouter();

    const lease = await invokeRouter(router, {
      method: "GET",
      url: "/lease",
      headers: tenantHeaders(),
    });

    expect(lease.status).toBe(200);
    expect(lease.body.data.leaseDocumentContext).toEqual(
      expect.objectContaining({
        documentUrl: "https://example.test/docs/newer-generated.pdf",
        source: "ledgerAttachments",
      }),
    );
  });

  it("does not expose another tenant's lease document through tenant workspace attachments", async () => {
    ensureCollection("leases").set(
      lifecycleContinuityIds.activeLeaseId,
      buildLifecycleContinuityLease("active", {
        status: "ready_for_signature",
        signedDocumentUrl: null,
        documentUrl: null,
        approvedDocumentUrl: null,
        documentRef: null,
      }),
    );
    ensureCollection("ledgerAttachments").set("foreign-tenant-lease-doc", {
      tenantId: lifecycleContinuityIds.upcomingTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      ledgerItemId: lifecycleContinuityIds.activeLeaseId,
      title: "Lease document",
      category: "Lease",
      purpose: "LEASE",
      purposeLabel: "Lease",
      url: "https://example.test/docs/foreign-tenant.pdf",
      createdAt: 999,
    });
    const router = await tenantRouter();

    const lease = await invokeRouter(router, {
      method: "GET",
      url: "/lease",
      headers: tenantHeaders(),
    });
    const attachments = await invokeRouter(router, {
      method: "GET",
      url: "/attachments",
      headers: tenantHeaders(),
    });

    expect(lease.status).toBe(200);
    expect(attachments.status).toBe(200);
    expect(JSON.stringify(lease.body)).not.toContain("foreign-tenant.pdf");
    expect(JSON.stringify(attachments.body)).not.toContain("foreign-tenant.pdf");
    expect(lease.body.data.leaseDocumentContext.documentStatus).toBe("pending");
  });

  it("keeps raw lease IDs out of primary display labels", async () => {
    const router = await tenantRouter();

    const workspace = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
      headers: tenantHeaders(),
    });
    const lease = await invokeRouter(router, {
      method: "GET",
      url: "/lease",
      headers: tenantHeaders(),
    });
    const profile = await invokeRouter(router, {
      method: "GET",
      url: "/profile",
      headers: tenantHeaders(),
    });

    const labels = [
      workspace.body.data.lease.leaseDocumentContext.displayLabel,
      lease.body.data.leaseDocumentContext.displayLabel,
      profile.body.data.profile.lease.leaseDocumentContext.displayLabel,
      lease.body.data.leasePdfLabel,
    ];

    expect(labels).toEqual(expect.arrayContaining(["Signed lease document"]));
    labels.forEach((label) => {
      expect(label).toBeTruthy();
      expect(String(label)).not.toContain(lifecycleContinuityIds.activeLeaseId);
    });
  });
});
