import { beforeEach, describe, expect, it, vi } from "vitest";

const getSignedDownloadUrlMock = vi.fn();
const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) {
    collections.set(name, new Map<string, any>());
  }
  return collections.get(name)!;
}

function clone(value: any) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
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

function queryCollection(name: string, filters: Array<{ field: string; op: string; value: any }>, limitCount?: number) {
  let docs = Array.from(ensureCollection(name).entries())
    .filter(([, data]) =>
      filters.every((filter) => {
        const current = data?.[filter.field];
        if (filter.op === "==") return current === filter.value;
        if (filter.op === "array-contains") return Array.isArray(current) && current.includes(filter.value);
        return false;
      })
    )
    .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));

  if (typeof limitCount === "number") {
    docs = docs.slice(0, limitCount);
  }

  return { docs, empty: docs.length === 0 };
}

const dbMock = {
  collection: (name: string) => ({
    get: async () => {
      const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
        id,
        exists: true,
        data: () => clone(data),
      }));
      return { docs, empty: docs.length === 0, size: docs.length };
    },
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
    where: (field: string, op: string, value: any) => ({
      limit: (count: number) => ({
        get: async () => queryCollection(name, [{ field, op, value }], count),
      }),
      get: async () => queryCollection(name, [{ field, op, value }]),
    }),
  }),
  runTransaction: async (handler: (tx: any) => Promise<any>) => {
    const tx = {
      get: async (docRef: any) => docRef.get(),
      set: async (docRef: any, value: any, opts?: { merge?: boolean }) => docRef.set(value, opts),
    };
    return handler(tx);
  },
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
    arrayUnion: (...values: any[]) => ({ __op: "arrayUnion", values }),
  },
}));
vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));
vi.mock("../../config/requiredEnv", () => ({
  getEnvFlags: () => ({ emailConfigured: true, emailProvider: "mailgun" }),
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

vi.mock("../../lib/gcsSignedUrl", () => ({
  getSignedDownloadUrl: getSignedDownloadUrlMock,
}));

describe("tenantPortalRoutes foundation", () => {
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

  beforeEach(() => {
    collections.clear();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";
    process.env.GCS_UPLOAD_BUCKET = "test-bucket";
    getSignedDownloadUrlMock.mockReset();
    getSignedDownloadUrlMock.mockImplementation(async ({ path }: { path: string }) => `https://signed.example/${path}`);
    ensureCollection("properties").set("prop-1", {
      rc_prop_id: "rc-prop-1",
      street1: "123 Main St",
      street2: "Unit 4",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H1A1",
      features: ["laundry", "parking"],
      internalSecret: "do-not-expose",
      landlordId: "landlord-1",
    });
    ensureCollection("applications").set("app-1", {
      applicantEmail: "tenant@example.com",
      propertyId: "prop-1",
      status: "submitted",
      missingSteps: ["upload_id"],
      nextActions: ["finish_profile"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sin: "123-45-6789",
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      dueDay: 1,
      documentUrl: "https://example.com/lease.pdf",
      tenantSignature: {
        signedAt: "2026-02-01T10:00:00.000Z",
        signatureMethod: "drawn",
        signatureDisplayName: "Taylor Tenant",
        drawnDataUrl: "data:image/png;base64,should-not-leak",
      },
      confidentialNotes: "private",
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
      phone: "902-555-0100",
      internalNotes: "do-not-expose",
    });
    ensureCollection("landlords").set("landlord-1", {
      businessName: "Harbour Homes Ltd.",
      email: "private-landlord@example.com",
      phone: "902-555-0199",
      providerSetupState: "connected",
      internalNotes: "do-not-expose",
    });
    ensureCollection("users").set("landlord-1", {
      displayName: "Morgan Landlord",
      email: "private-user@example.com",
      phone: "902-555-0110",
    });
    ensureCollection("accounts").set("landlord-1", {
      displayName: "Harbour Homes Account",
      businessName: "Harbour Homes Account Business",
      email: "private-account@example.com",
    });
    ensureCollection("maintenanceRequests").set("maint-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "submitted",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Leaky tap",
      description: "Kitchen faucet dripping",
      assignedContractorName: "North Shore Plumbing",
      contractorStatus: "assigned",
      serviceWindowStartAt: 300,
      serviceWindowEndAt: 600,
      accessRequired: true,
      tenantConfirmationStatus: null,
      tenantConfirmationUpdatedAt: null,
      accessAcknowledgedAt: null,
      statusHistory: [
        {
          status: "submitted",
          actorRole: "tenant",
          message: "Submitted from tenant workspace.",
          createdAt: 100,
        },
      ],
      createdAt: 100,
      updatedAt: 200,
      internalCost: 999,
    });
    ensureCollection("workOrders").set("maintenance_maint-1", {
      maintenanceRequestId: "maint-1",
      cost: {
        actualCostCents: 24500,
        currency: "CAD",
        submittedByRole: "contractor",
        submittedById: "contractor-1",
        submittedAt: 275,
        reviewStatus: "approved",
      },
      costLineItems: [{ id: "line-1", label: "Labor", amountCents: 24500, category: "labor" }],
      costAttachments: [
        {
          id: "invoice-1",
          storagePath: "work-orders/cost-attachments/maintenance_maint-1/invoice.pdf",
          fileName: "invoice.pdf",
          contentType: "application/pdf",
          uploadedAt: 280,
          uploadedByRole: "contractor",
          uploadedById: "contractor-1",
          visibility: "landlord_only",
        },
      ],
      evidence: [
        {
          id: "evidence-tenant",
          storagePath: "work-orders/evidence/maintenance_maint-1/tenant.jpg",
          filename: "tenant.jpg",
          contentType: "image/jpeg",
          uploadedAt: 250,
          uploadedByActorRole: "landlord",
          uploadedByActorId: "landlord-1",
          evidenceType: "completion",
          caption: "Tenant-safe completion photo",
          visibility: "tenant_safe",
        },
        {
          id: "evidence-internal",
          storagePath: "work-orders/evidence/maintenance_maint-1/internal.jpg",
          filename: "internal.jpg",
          contentType: "image/jpeg",
          uploadedAt: 260,
          uploadedByActorRole: "landlord",
          uploadedByActorId: "landlord-1",
          evidenceType: "damage",
          caption: "Internal review photo",
          visibility: "internal",
        },
      ],
    });
    ensureCollection("tenancy_invites").set("invite-1", {
      token_hash: "invite-1",
      token_preview: "abc123",
      landlord_id: "landlord-1",
      property_id: "prop-1",
      application_id: "app-1",
      invited_email: "tenant@example.com",
      status: "pending",
      created_at: Date.now(),
      expires_at: Date.now() + 10_000,
    });
    ensureCollection("ledgerAttachments").set("attachment-1", {
      tenantId: "tenant-1",
      ledgerItemId: "ledger-1",
      title: "Government ID",
      fileName: "id-card.pdf",
      purpose: "identity",
      purposeLabel: "Upload Id",
      url: "https://example.com/id-card.pdf",
      createdAt: 500,
      internalNotes: "private",
    });
    ensureCollection("tenantHistoryShares").set("share-1", {
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      createdAt: 1_000,
      expiresAt: Date.now() + 86_400_000,
      lastAccessedAt: 2_000,
      revoked: false,
    });
    ensureCollection("tenantHistoryShares").set("share-2", {
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      createdAt: 900,
      expiresAt: Date.now() + 86_400_000,
      revoked: true,
      revokedAt: 1_500,
    });
  });

  it("rejects unauthorized tenant workspace access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
    });

    expect(res.status).toBe(401);
  });

  it("rejects tenant workspace access when role or tenantId is missing", async () => {
    const router = (await import("../tenantPortalRoutes")).default;

    const roleMismatch = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "landlord",
          tenantId: "tenant-1",
        }),
      },
    });

    const missingTenantId = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
        }),
      },
    });

    expect(roleMismatch.status).toBe(401);
    expect(roleMismatch.body?.error).toBe("UNAUTHORIZED");
    expect(missingTenantId.status).toBe(401);
    expect(missingTenantId.body?.error).toBe("UNAUTHORIZED");
  });

  it("returns tenant_not_initialized when a valid tenant lacks a resolved tenancy context", async () => {
    ensureCollection("applications").clear();
    ensureCollection("leases").clear();
    ensureCollection("tenancy_invites").clear();

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      ok: false,
      error: "TENANT_NOT_INITIALIZED",
      status: "tenant_not_initialized",
    });
  });

  it("returns safe projected workspace data and writes compact events", async () => {
    ensureCollection("canonicalEvents").set("event-application-created", {
      id: "event-application-created",
      version: "v1",
      type: "application.created",
      domain: "application",
      action: "created",
      actor: { type: "tenant", id: "tenant-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-01-01T09:00:00.000Z",
      recordedAt: "2026-01-01T09:00:00.000Z",
      visibility: "tenant",
      summary: "Application created",
    });
    ensureCollection("canonicalEvents").set("event-screening-consent", {
      id: "event-screening-consent",
      version: "v1",
      type: "screening_consent_confirmed",
      domain: "screening",
      action: "screening_consent_confirmed",
      actor: { type: "tenant", id: "tenant-1" },
      resource: { type: "screening_request", id: "screening-1", parentType: "rental_application", parentId: "app-1" },
      occurredAt: "2026-01-03T09:00:00.000Z",
      recordedAt: "2026-01-03T09:00:00.000Z",
      visibility: "tenant",
      summary: "Tenant screening consent confirmed",
      metadata: {
        tenantId: "tenant-1",
        applicationId: "app-1",
        providerLabel: "TransUnion",
      },
    });
    ensureCollection("canonicalEvents").set("event-lease-signed", {
      id: "event-lease-signed",
      version: "v1",
      type: "lease.tenant_signed",
      domain: "lease",
      action: "tenant_signed",
      actor: { type: "tenant", id: "tenant-1", displayName: "Taylor Tenant" },
      resource: { type: "lease", id: "lease-1" },
      occurredAt: "2026-02-01T10:00:00.000Z",
      recordedAt: "2026-02-01T10:00:00.000Z",
      visibility: "tenant",
      summary: "Tenant signed lease",
      metadata: {
        tenantId: "tenant-1",
      },
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.property?.street1).toBe("123 Main St");
    expect(res.body?.data?.property?.internalSecret).toBeUndefined();
    expect(res.body?.data?.application?.status).toBe("submitted");
    expect(res.body?.data?.application?.sin).toBeUndefined();
    expect(res.body?.data?.lease?.monthlyRent).toBe(1800);
    expect(res.body?.data?.lease?.confidentialNotes).toBeUndefined();
    expect(res.body?.data?.lease?.signatureStatus).toBe("signed");
    expect(res.body?.data?.lease?.signatureReadinessLabel).toBe("Lease signing complete");
    expect(res.body?.data?.lease?.tenantSignature).toEqual({
      signedAt: "2026-02-01T10:00:00.000Z",
      signatureMethod: "drawn",
      signatureDisplayName: "Taylor Tenant",
    });
    expect(res.body?.data?.lease?.tenantSignature?.drawnDataUrl).toBeUndefined();
    expect(res.body?.data?.lease?.leasePdfStatus).toBe("available");
    expect(res.body?.data?.lease?.paymentReadiness).toEqual(
      expect.objectContaining({
        readinessStatus: "ready_to_configure",
        readinessLabel: "Rent terms ready for future setup",
        requiredNextAction: "confirm_payment_setup_later",
        paymentSetup: {
          processorConnected: false,
          moneyMovementEnabled: false,
          storedPaymentMethod: false,
        },
      })
    );
    expect(res.body?.data?.tenantIdentityRecord).toEqual(
      expect.objectContaining({
        identityStatus: expect.stringMatching(/incomplete|ready|verified|limited/),
        verification: expect.objectContaining({
          level: expect.stringMatching(/none|partial|strong/),
        }),
        readinessLabel: expect.any(String),
        readinessDescription: expect.any(String),
      })
    );
    expect(Array.isArray(res.body?.data?.tenantIdentityRecord?.documents?.missingCategories)).toBe(true);
    expect(res.body?.data?.maintenance?.[0]?.title).toBe("Leaky tap");
    expect(res.body?.data?.maintenance?.[0]?.assignedContractorName).toBe("North Shore Plumbing");
    expect(res.body?.data?.maintenance?.[0]?.contractorStatus).toBe("assigned");
    expect(res.body?.data?.maintenance?.[0]?.serviceWindowStartAt).toBe(300);
    expect(res.body?.data?.maintenance?.[0]?.accessRequired).toBe(true);
    expect(res.body?.data?.maintenance?.[0]?.tenantConfirmationStatus).toBeNull();
    expect(res.body?.data?.maintenance?.[0]?.statusHistory?.[0]?.message).toBe("Submitted from tenant workspace.");
    expect(res.body?.data?.maintenance?.[0]?.internalCost).toBeUndefined();
    expect(res.body?.data?.tenantIdentityRecord?.documents?.documentChecklist).toBeUndefined();
    expect(res.body?.data?.tenantIdentityRecord?.screening?.provider).toBeUndefined();
    expect(res.body?.data?.tenantCredibilitySignals).toEqual(
      expect.objectContaining({
        signals: expect.arrayContaining([
          expect.objectContaining({ key: "profile_complete" }),
          expect.objectContaining({ key: "application_reusable" }),
          expect.objectContaining({ key: "documents_available" }),
          expect.objectContaining({ key: "screening_completed" }),
          expect.objectContaining({ key: "lease_history_present" }),
        ]),
        summary: expect.objectContaining({
          completenessLevel: expect.stringMatching(/low|medium|high/),
          verificationLevel: expect.stringMatching(/none|partial|strong/),
          summaryLabel: expect.any(String),
          summaryDescription: expect.any(String),
        }),
      })
    );
    expect(res.body?.data?.portableIdentity).toEqual(
      expect.objectContaining({
        portabilityStatus: expect.stringMatching(/not_ready|ready|limited/),
        portabilityLabel: expect.any(String),
        portabilityDescription: expect.any(String),
        reusableAcrossApplications: expect.any(Boolean),
        identityReference: {
          referenceType: "tenant_identity",
          referenceStatus: expect.stringMatching(/active|limited/),
        },
        readiness: expect.objectContaining({
          identityReady: expect.any(Boolean),
          applicationReusable: expect.any(Boolean),
          credibilityReady: expect.any(Boolean),
          sharingEnabled: expect.any(Boolean),
        }),
      })
    );
    expect(res.body?.data?.identityTimeline).toEqual({
      events: [
        {
          type: "lease.tenant_signed",
          label: "Lease signed",
          description: "Tenant lease signing was recorded.",
          occurredAt: "2026-02-01T10:00:00.000Z",
        },
      ],
    });
    expect(res.body?.data?.identityTimeline?.events?.[0]?.id).toBeUndefined();
    expect(res.body?.data?.identityTimeline?.events?.[0]?.metadata).toBeUndefined();
    expect(JSON.stringify(res.body?.data?.portableIdentity || {})).not.toContain("token");
    expect(JSON.stringify(res.body?.data?.portableIdentity || {})).not.toContain("drawnDataUrl");

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_workspace_viewed")).toBe(true);
  });

  it("returns tenant-safe lease signature and PDF readiness metadata from /tenant/lease", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/lease",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.leaseId).toBe("lease-1");
    expect(res.body?.data?.signatureStatus).toBe("signed");
    expect(res.body?.data?.signatureReadinessDescription).toMatch(/current signing stage as complete/i);
    expect(res.body?.data?.tenantSignature).toEqual({
      signedAt: "2026-02-01T10:00:00.000Z",
      signatureMethod: "drawn",
      signatureDisplayName: "Taylor Tenant",
    });
    expect(res.body?.data?.tenantSignature?.drawnDataUrl).toBeUndefined();
    expect(res.body?.data?.leasePdfStatus).toBe("available");
    expect(res.body?.data?.leaseExecution).toEqual(
      expect.objectContaining({
        executionStatus: "fully_executed",
        executionLabel: "Lease fully executed",
        requiredNextAction: "none",
      })
    );
    expect(res.body?.data?.paymentReadiness).toEqual(
      expect.objectContaining({
        readinessStatus: "ready_to_configure",
        readinessLabel: "Rent terms ready for future setup",
        requiredNextAction: "confirm_payment_setup_later",
        paymentSetup: {
          processorConnected: false,
          moneyMovementEnabled: false,
          storedPaymentMethod: false,
        },
      })
    );
    expect(res.body?.lease?.tenantSignature?.drawnDataUrl).toBeUndefined();
    expect(res.body?.data?.paymentMethod).toBeUndefined();
  });

  it("records tenant lease signing metadata without storing raw signature data and stays idempotent", async () => {
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "ready_for_signature",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      monthlyRent: 1900,
      documentUrl: "https://example.com/sign-me.pdf",
      tenantSignature: null,
      tenantSignedAt: null,
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
      phone: "902-555-0100",
      propertyId: "prop-1",
      currentLeaseId: "lease-1",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const headers = {
      "x-test-user": JSON.stringify({
        id: "user-1",
        email: "tenant@example.com",
        role: "tenant",
        tenantId: "tenant-1",
        leaseId: "lease-sign-1",
      }),
    };

    const first = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/sign",
      headers,
    });
    const second = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-1/sign",
      headers,
    });

    expect(first.status).toBe(200);
    expect(first.body?.data?.tenantSignature).toEqual(
      expect.objectContaining({
        signatureMethod: "typed",
        signatureDisplayName: "Taylor Tenant",
      })
    );
    expect(first.body?.data?.tenantSignature?.drawnDataUrl).toBeUndefined();
    expect(first.body?.data?.leaseExecution).toEqual(
      expect.objectContaining({
        executionStatus: "tenant_signed",
        requiredNextAction: "landlord_signature",
      })
    );

    expect(second.status).toBe(200);
    const canonicalEvents = Array.from(ensureCollection("canonicalEvents").values());
    expect(canonicalEvents.filter((event) => event.action === "tenant_signed")).toHaveLength(1);

    const storedLease = ensureCollection("leases").get("lease-1");
    expect(storedLease?.tenantSignedAt).toBeTruthy();
    expect(storedLease?.tenantSignatureMethod).toBe("typed");
    expect(storedLease?.tenantSignatureDisplayName).toBe("Taylor Tenant");
    expect(storedLease?.tenantSignature?.drawnDataUrl).toBeUndefined();
  });

  it("forbids tenant lease signing for an unrelated lease", async () => {
    ensureCollection("leases").set("lease-other", {
      tenantId: "tenant-2",
      propertyId: "prop-1",
      status: "ready_for_signature",
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      monthlyRent: 1900,
      documentUrl: "https://example.com/sign-me.pdf",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/leases/lease-other/sign",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
          leaseId: "lease-1",
        }),
      },
    });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("FORBIDDEN");
  });

  it("creates a tenant share package without persisting a raw token", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/share-packages",
      body: { expiresInDays: 7 },
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.shareUrl).toMatch(/\/share\//);
    const shareDocs = Array.from(ensureCollection("tenantSharePackages").values());
    expect(shareDocs).toHaveLength(1);
    expect(shareDocs[0]?.tenantId).toBe("tenant-1");
    expect(shareDocs[0]?.tokenHash).toBeTruthy();
    expect(shareDocs[0]?.token).toBeUndefined();
    expect(shareDocs[0]?.permissions).toEqual({
      identitySummary: true,
      credibilitySummary: false,
      applicationSummary: false,
      documents: "none",
      leaseSummary: false,
      paymentReadinessSummary: false,
    });
    expect(shareDocs[0]?.verificationRequests).toEqual([]);
  });

  it("lists only active tenant share packages", async () => {
    ensureCollection("tenantSharePackages").set("share-1", {
      id: "share-1",
      tenantId: "tenant-1",
      tokenHash: "hash-1",
      createdAt: 100,
      expiresAt: Date.now() + 10_000,
      status: "active",
    });
    ensureCollection("tenantSharePackages").set("share-2", {
      id: "share-2",
      tenantId: "tenant-1",
      tokenHash: "hash-2",
      createdAt: 90,
      expiresAt: Date.now() - 10_000,
      status: "active",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/share-packages",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data).toEqual([
      expect.objectContaining({
        id: "share-1",
        status: "active",
        requestedItems: [],
        approvedItems: [],
        verificationRequests: [],
      }),
    ]);
  });

  it("revokes a tenant share package immediately", async () => {
    ensureCollection("tenantSharePackages").set("share-1", {
      id: "share-1",
      tenantId: "tenant-1",
      tokenHash: "hash-1",
      createdAt: 100,
      expiresAt: Date.now() + 10_000,
      status: "active",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "DELETE",
      url: "/share-packages/share-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(ensureCollection("tenantSharePackages").get("share-1")?.status).toBe("revoked");
  });

  it("lets a tenant approve requested share expansions only for their own link", async () => {
    ensureCollection("tenantSharePackages").set("share-1", {
      id: "share-1",
      tenantId: "tenant-1",
      tokenHash: "hash-1",
      createdAt: 100,
      expiresAt: Date.now() + 10_000,
      status: "active",
      permissions: {
        identitySummary: true,
        credibilitySummary: false,
        applicationSummary: false,
        documents: "none",
      },
      requestedItems: ["credibility_summary", "documents_summary"],
      approvedItems: [],
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/share-packages/share-1/respond",
      body: {
        approvedItems: ["credibility_summary", "application_summary", "documents_summary"],
      },
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(ensureCollection("tenantSharePackages").get("share-1")).toEqual(
      expect.objectContaining({
        requestedItems: [],
        approvedItems: ["credibility_summary", "documents_summary"],
        permissions: {
          identitySummary: true,
          credibilitySummary: true,
          applicationSummary: false,
          documents: "approved_only",
          leaseSummary: false,
          paymentReadinessSummary: false,
        },
      })
    );
  });

  it("lets a tenant approve and revoke verification requests only on their own share link", async () => {
    ensureCollection("tenantSharePackages").set("share-1", {
      id: "share-1",
      tenantId: "tenant-1",
      tokenHash: "hash-1",
      createdAt: 100,
      expiresAt: Date.now() + 10_000,
      status: "active",
      verificationRequests: [
        {
          requestId: "req-1",
          requestedByType: "landlord",
          requestedScopes: ["lease_summary", "payment_readiness_summary"],
          status: "requested",
          createdAt: Date.now(),
        },
      ],
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const approveRes = await invokeRouter(router, {
      method: "POST",
      url: "/share-packages/share-1/verification-requests/req-1/respond",
      body: {
        approvedScopes: ["payment_readiness_summary"],
      },
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(approveRes.status).toBe(200);
    expect(ensureCollection("tenantSharePackages").get("share-1")).toEqual(
      expect.objectContaining({
        approvedItems: ["payment_readiness_summary"],
        verificationRequests: expect.arrayContaining([
          expect.objectContaining({
            requestId: "req-1",
            status: "approved",
            requestedScopes: ["payment_readiness_summary"],
          }),
        ]),
      })
    );

    const revokeRes = await invokeRouter(router, {
      method: "POST",
      url: "/share-packages/share-1/verification-requests/req-1/revoke",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(revokeRes.status).toBe(200);
    expect(ensureCollection("tenantSharePackages").get("share-1")).toEqual(
      expect.objectContaining({
        approvedItems: [],
        verificationRequests: expect.arrayContaining([
          expect.objectContaining({
            requestId: "req-1",
            status: "revoked",
          }),
        ]),
      })
    );
  });

  it("returns a grouped tenant-safe application completion checklist", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/application-completion",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.progressPercent).toBeTypeOf("number");
    expect(Array.isArray(res.body?.data?.sections)).toBe(true);
    expect(res.body?.data?.sections?.map((section: any) => section.key)).toEqual(
      expect.arrayContaining(["identity", "documents", "profile", "readiness"])
    );
    expect(res.body?.data?.sections?.some((section: any) => Array.isArray(section.items) && section.items.length > 0)).toBe(true);
    expect(res.body?.data?.sections?.flatMap((section: any) => section.items || [])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ internalSecret: expect.anything() })])
    );
    expect(res.body?.data?.sections?.flatMap((section: any) => section.items || [])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sin: expect.anything() })])
    );
    expect(res.body?.data?.reminderTiming).toMatch(/due_now|due_soon|scheduled_later|overdue|blocked|not_applicable/);
    expect(typeof res.body?.data?.reminderTimingLabel).toBe("string");
    expect(typeof res.body?.data?.reminderTimingDescription).toBe("string");
    const documentItem = res.body?.data?.sections
      ?.flatMap((section: any) => section.items || [])
      ?.find((item: any) => item.key === "upload_id");
    expect(documentItem?.actionPath).toBe("/tenant/attachments");

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_application_completion_viewed")).toBe(true);
  });

  it("lets the tenant confirm the service window and acknowledge access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-2", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "scheduled",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Window repair",
      description: "The latch is broken.",
      serviceWindowStartAt: 1_000,
      serviceWindowEndAt: 1_600,
      accessRequired: true,
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance-requests/maint-2/confirmation",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        confirmationStatus: "confirmed",
        acknowledgeAccess: true,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.tenantConfirmationStatus).toBe("confirmed");
    expect(typeof res.body?.data?.tenantConfirmationUpdatedAt).toBe("number");
    expect(typeof res.body?.data?.accessAcknowledgedAt).toBe("number");

    const saved = ensureCollection("maintenanceRequests").get("maint-2");
    expect(saved?.tenantConfirmationStatus).toBe("confirmed");
    expect(saved?.statusHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "Tenant confirmed the scheduled service window." }),
        expect.objectContaining({ message: "Tenant acknowledged the access requirement." }),
      ])
    );
  });

  it("returns only tenant-safe maintenance evidence in the detail payload", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/maintenance-requests/maint-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.evidence).toEqual([
      expect.objectContaining({
        id: "evidence-tenant",
        caption: "Tenant-safe completion photo",
        visibility: "tenant_safe",
      }),
    ]);
    expect(JSON.stringify(res.body?.data?.evidence || [])).not.toMatch(/internal review/i);
  });

  it("does not expose internal cost data in the tenant maintenance detail payload", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/maintenance-requests/maint-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-1",
          role: "tenant",
          tenantId: "tenant-1",
          email: "tenant@example.com",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.cost).toBeUndefined();
    expect(res.body?.data?.costLineItems).toBeUndefined();
    expect(res.body?.data?.costAttachments).toBeUndefined();
    expect(res.body?.data?.costReviewHistory).toBeUndefined();
    expect(res.body?.data?.expenseLink).toBeUndefined();
    expect(JSON.stringify(res.body?.data || {})).not.toMatch(/24500|invoice\.pdf/i);
  });

  it("lets the tenant sign off a completed maintenance request as resolved", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-2", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "completed",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Window repair",
      description: "The latch is broken.",
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });
    ensureCollection("workOrders").set("maintenance_maint-2", {
      maintenanceRequestId: "maint-2",
      tenantId: "tenant-1",
      status: "completed",
      resolutionStatus: "tenant_pending_signoff",
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance/maint-2/signoff",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        decision: "resolved",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.resolutionStatus).toBe("resolved");
    expect(typeof res.body?.data?.finalResolvedAt).toBe("number");

    const savedWorkOrder = ensureCollection("workOrders").get("maintenance_maint-2");
    expect(savedWorkOrder?.tenantSignoffStatus).toBe("accepted");
    expect(savedWorkOrder?.finalResolvedAt).toBeDefined();
  });

  it("lets the tenant reopen a closed maintenance request with a required reason", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-2b", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "completed",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Window repair",
      description: "The latch failed again after closure.",
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });
    ensureCollection("workOrders").set("maintenance_maint-2b", {
      maintenanceRequestId: "maint-2b",
      tenantId: "tenant-1",
      status: "completed",
      resolutionStatus: "resolved",
      tenantSignoffStatus: "accepted",
      finalResolvedAt: 250,
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance/maint-2b/reopen",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        reason: "The latch failed again after closure.",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.resolutionStatus).toBe("follow_up_required");
    expect(res.body?.data?.reopenReason).toBe("The latch failed again after closure.");
    expect(typeof res.body?.data?.reopenedAt).toBe("number");

    const savedWorkOrder = ensureCollection("workOrders").get("maintenance_maint-2b");
    expect(savedWorkOrder?.followUpRequired).toBe(true);
    expect(savedWorkOrder?.reopenedByActorRole).toBe("tenant");
    expect(savedWorkOrder?.finalResolvedAt).toBeNull();
  });

  it("returns tenant-safe rework state and allows rework signoff again after rework completion", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-3", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "completed",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Heater follow-up",
      description: "Bedroom still cool.",
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });
    ensureCollection("workOrders").set("maintenance_maint-3", {
      maintenanceRequestId: "maint-3",
      tenantId: "tenant-1",
      status: "completed",
      resolutionStatus: "tenant_pending_signoff",
      reworkCycle: {
        cycleNumber: 1,
        status: "completed",
        createdAt: 300,
        createdBy: "landlord-1",
        startedAt: 320,
        completedAt: 360,
        completionSummary: "Balanced vents and re-tested bedroom airflow.",
      },
      reworkHistory: [
        {
          cycleNumber: 1,
          startedAt: 320,
          completedAt: 360,
          outcome: "resolved",
          notes: "Second pass complete.",
        },
      ],
      reworkReview: {
        status: "tenant_pending_signoff",
        reviewedAt: 370,
        reviewedBy: "landlord-1",
        landlordReviewNote: "Please confirm whether the return visit resolved the issue.",
        tenantSignoffStatus: "pending",
        tenantSignedOffAt: null,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        closureOutcome: null,
        closedAt: null,
      },
    });

    const detailRes = await invokeRouter(router, {
      method: "GET",
      url: "/maintenance-requests/maint-3",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(detailRes.status).toBe(200);
    expect(detailRes.body?.data?.reworkCycle).toEqual(
      expect.objectContaining({
        cycleNumber: 1,
        status: "completed",
        completionSummary: expect.stringMatching(/Balanced vents/i),
      })
    );
    expect(detailRes.body?.data?.reworkReview).toEqual(
      expect.objectContaining({
        status: "tenant_pending_signoff",
        tenantSignoffStatus: "pending",
      })
    );
    expect(detailRes.body?.data?.notifications).toEqual({
      tenant: {
        requiresAccessConfirmation: false,
        requiresSignoff: true,
        requiresReworkAwareness: false,
      },
    });

    const signoffRes = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance/maint-3/rework-signoff",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        decision: "resolved",
      },
    });

    expect(signoffRes.status).toBe(200);
    expect(signoffRes.body?.data?.resolutionStatus).toBe("resolved");
    expect(signoffRes.body?.data?.reworkReview).toEqual(
      expect.objectContaining({
        status: "closed",
        tenantSignoffStatus: "accepted",
        closureOutcome: "resolved",
      })
    );
  });

  it("requires the dedicated rework signoff route when a second-pass review is pending", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-3b", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "completed",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Heater follow-up",
      description: "Bedroom still cool.",
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });
    ensureCollection("workOrders").set("maintenance_maint-3b", {
      maintenanceRequestId: "maint-3b",
      tenantId: "tenant-1",
      status: "completed",
      resolutionStatus: "tenant_pending_signoff",
      reworkCycle: {
        cycleNumber: 1,
        status: "completed",
        createdAt: 300,
        createdBy: "landlord-1",
        completedAt: 360,
      },
      reworkReview: {
        status: "tenant_pending_signoff",
        reviewedAt: 370,
        reviewedBy: "landlord-1",
        landlordReviewNote: null,
        tenantSignoffStatus: "pending",
        tenantSignedOffAt: null,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        closureOutcome: null,
        closedAt: null,
      },
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance/maint-3b/signoff",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        decision: "resolved",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("REWORK_SIGNOFF_REQUIRED");
  });

  it("requires a reason when the tenant reports the issue is not resolved", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-2", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "completed",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Window repair",
      description: "The latch is broken.",
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });
    ensureCollection("workOrders").set("maintenance_maint-2", {
      maintenanceRequestId: "maint-2",
      tenantId: "tenant-1",
      status: "completed",
      resolutionStatus: "tenant_pending_signoff",
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance/maint-2/signoff",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        decision: "not_resolved",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("TENANT_DECLINE_REASON_REQUIRED");
  });

  it("lets the tenant confirm rework access for their own request", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-4", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "assigned",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Rework visit",
      description: "A second pass is scheduled.",
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });
    ensureCollection("workOrders").set("maintenance_maint-4", {
      maintenanceRequestId: "maint-4",
      tenantId: "tenant-1",
      status: "assigned",
      resolutionStatus: "completed_pending_review",
      reworkCycle: {
        cycleNumber: 1,
        status: "assigned",
        createdAt: 300,
        createdBy: "landlord-1",
        assignedContractorId: "contractor-1",
        assignedAt: 301,
        schedule: {
          scheduledFor: 500,
          timeWindowStart: null,
          timeWindowEnd: null,
          status: "tenant_pending",
          requiresTenantAccess: true,
          tenantAccessStatus: "pending",
          contractorScheduleStatus: "confirmed",
        },
      },
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance/maint-4/confirm-rework-access",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        decision: "confirm",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.reworkCycle?.schedule).toEqual(
      expect.objectContaining({
        status: "confirmed",
        tenantAccessStatus: "confirmed",
      })
    );
    expect(res.body?.data?.notifications).toEqual({
      tenant: {
        requiresAccessConfirmation: false,
        requiresSignoff: false,
        requiresReworkAwareness: false,
      },
    });
  });

  it("lets the tenant deny rework access and request a reschedule", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-5", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "assigned",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Rework visit",
      description: "A second pass is scheduled.",
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });
    ensureCollection("workOrders").set("maintenance_maint-5", {
      maintenanceRequestId: "maint-5",
      tenantId: "tenant-1",
      status: "assigned",
      resolutionStatus: "completed_pending_review",
      reworkCycle: {
        cycleNumber: 1,
        status: "assigned",
        createdAt: 300,
        createdBy: "landlord-1",
        assignedContractorId: "contractor-1",
        assignedAt: 301,
        schedule: {
          scheduledFor: 500,
          timeWindowStart: null,
          timeWindowEnd: null,
          status: "tenant_pending",
          requiresTenantAccess: true,
          tenantAccessStatus: "pending",
          contractorScheduleStatus: "pending",
        },
      },
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance/maint-5/confirm-rework-access",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        decision: "deny",
        note: "I will be away for the scheduled visit.",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.reworkCycle?.schedule).toEqual(
      expect.objectContaining({
        status: "reschedule_requested",
        tenantAccessStatus: "denied",
        tenantAccessNote: "I will be away for the scheduled visit.",
      })
    );
    expect(res.body?.data?.notifications).toEqual({
      tenant: {
        requiresAccessConfirmation: false,
        requiresSignoff: false,
        requiresReworkAwareness: false,
      },
    });
  });

  it("rejects rework access updates for an unrelated tenant request", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    ensureCollection("maintenanceRequests").set("maint-6", {
      tenantId: "tenant-2",
      propertyId: "prop-1",
      status: "assigned",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Rework visit",
      description: "A second pass is scheduled.",
      statusHistory: [],
      createdAt: 100,
      updatedAt: 200,
    });
    ensureCollection("workOrders").set("maintenance_maint-6", {
      maintenanceRequestId: "maint-6",
      tenantId: "tenant-2",
      status: "assigned",
      reworkCycle: {
        cycleNumber: 1,
        status: "assigned",
        createdAt: 300,
        createdBy: "landlord-1",
        schedule: {
          scheduledFor: 500,
          status: "tenant_pending",
          requiresTenantAccess: true,
          tenantAccessStatus: "pending",
          contractorScheduleStatus: "pending",
        },
      },
    });

    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance/maint-6/confirm-rework-access",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        decision: "confirm",
      },
    });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("FORBIDDEN");
  });

  it("rejects unauthorized application completion access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/application-completion",
    });

    expect(res.status).toBe(401);
  });

  it("handles missing application context safely in the completion engine", async () => {
    ensureCollection("applications").clear();

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/application-completion",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.status).toMatch(/not_started|in_progress|pending|needs_review/);
    expect(Array.isArray(res.body?.data?.sections)).toBe(true);
    expect(res.body?.data?.reminderTiming).toMatch(/due_now|overdue/);
    expect(res.body?.data?.reminderTimingLabel).toMatch(/Due now|Overdue/);
    const readinessSection = res.body?.data?.sections?.find((section: any) => section.key === "readiness");
    expect(readinessSection).toBeTruthy();
  });

  it("returns tenant-safe document states and completion guidance", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/attachments",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body?.summary?.total).toBeGreaterThan(0);
    expect(res.body?.summary?.pendingReview).toBeTypeOf("number");
    expect(res.body?.guidance?.headline).toBeTypeOf("string");
    expect(res.body?.data?.[0]?.internalNotes).toBeUndefined();
    expect(
      res.body?.data?.some((item: any) =>
        ["uploaded", "missing", "pending_review", "verified", "needs_attention", "reupload_requested"].includes(item.status)
      )
    ).toBe(true);
  });

  it("rejects unauthorized tenant attachments access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/attachments",
    });

    expect(res.status).toBe(401);
  });

  it("returns tenant-safe profile data with edit and document entry actions", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/profile",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.profile?.displayName).toBe("Taylor Tenant");
    expect(res.body?.data?.profile?.phone).toBe("902-555-0100");
    expect(res.body?.data?.profile?.internalNotes).toBeUndefined();
    expect(res.body?.data?.actions?.editableFields).toEqual(["displayName", "phone"]);
    expect(res.body?.data?.actions?.documentEntry?.path).toBe("/tenant/attachments");
  });

  it("returns tenant-safe access visibility from existing share records", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/access",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.summary?.activeGrants).toBe(1);
    expect(res.body?.data?.summary?.pendingRequests).toBe(0);
    expect(res.body?.data?.activeAccess?.[0]?.grantedToLabel).toMatch(/Shared with your landlord/i);
    expect(res.body?.data?.activeAccess?.[0]?.categories).toEqual(["Rental history"]);
    expect(res.body?.data?.pendingRequests).toEqual([]);
    expect(
      res.body?.data?.recentActivity?.some((item: any) =>
        ["access_granted", "access_viewed", "access_revoked"].includes(item.type)
      )
    ).toBe(true);

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_access_viewed")).toBe(true);
  });

  it("allows a tenant to revoke only their own active access share", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/access/share-1/revoke",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.revoked).toBe(true);
    expect(ensureCollection("tenantHistoryShares").get("share-1")?.revoked).toBe(true);

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_access_revoked")).toBe(true);
  });

  it("updates only allowed tenant profile fields", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/profile",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        displayName: "Taylor Updated",
        phone: "902-555-0111",
        internalNotes: "should-not-stick",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.profile?.displayName).toBe("Taylor Updated");
    expect(res.body?.data?.profile?.phone).toBe("902-555-0111");
    expect(ensureCollection("tenants").get("tenant-1")?.fullName).toBe("Taylor Updated");
    expect(ensureCollection("tenants").get("tenant-1")?.phone).toBe("902-555-0111");
    expect(ensureCollection("tenants").get("tenant-1")?.internalNotes).toBe("do-not-expose");
    expect(ensureCollection("applications").get("app-1")?.applicantName).toBe("Taylor Updated");
    expect(ensureCollection("applications").get("app-1")?.phone).toBe("902-555-0111");
    expect(ensureCollection("tenants").get("tenant-1")?.landlordId).toBeUndefined();
    expect(ensureCollection("tenants").get("tenant-1")?.propertyId).toBeUndefined();
    expect(ensureCollection("tenants").get("tenant-1")?.unitId).toBeUndefined();
    expect(ensureCollection("tenants").get("tenant-1")?.currentLeaseId).toBeUndefined();

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_profile_updated")).toBe(true);
  });

  it("allows phone-only tenant profile updates", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/profile",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        phone: "902-555-0122",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.profile?.phone).toBe("902-555-0122");
    expect(ensureCollection("tenants").get("tenant-1")?.phone).toBe("902-555-0122");
    expect(ensureCollection("applications").get("app-1")?.phone).toBe("902-555-0122");
  });

  it("rejects empty tenant profile patch payloads", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/profile",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("TENANT_PROFILE_FIELDS_REQUIRED");
  });

  it("rejects unauthorized tenant profile edits", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/profile",
      body: {
        displayName: "Taylor Updated",
      },
    });

    expect(res.status).toBe(401);
  });

  it("submits maintenance only for active tenant context", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance-requests",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        title: "Broken lock",
        description: "Front door lock is jammed",
        category: "SECURITY",
        priority: "HIGH",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.data?.title).toBe("Broken lock");
    expect(Array.from(ensureCollection("event_log").values()).some((event) => event.event_type === "tenant_maintenance_submitted")).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("keeps workspace maintenance submission when email delivery fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("mail_failed"));
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance-requests",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        title: "Broken heater",
        description: "The unit is cold",
        category: "GENERAL",
        priority: "NORMAL",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.emailed).toBe(false);
    expect(typeof res.body?.emailError).toBe("string");
  });

  it("redeems invite token once for an authenticated user", async () => {
    const { hashTenancyInviteToken } = await import("../../services/tenantPortal/tenantInviteService");
    const token = "plain-invite-token";
    const tokenHash = hashTenancyInviteToken(token);
    ensureCollection("tenancy_invites").set(tokenHash, {
      token_hash: tokenHash,
      token_preview: "plain-...oken",
      landlord_id: "landlord-1",
      property_id: "prop-1",
      application_id: "app-1",
      invited_email: "tenant@example.com",
      status: "pending",
      created_at: Date.now(),
      expires_at: Date.now() + 10_000,
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/invite/redeem",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: { token },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.status).toBe("redeemed");
  });

  it("lets a tenant consent for their own screening request and stores strengthened metadata", async () => {
    ensureCollection("screening_requests").set("screening-1", {
      rentalApplicationId: "app-1",
      landlordId: "landlord-1",
      applicantTenantId: "tenant-1",
      applicantUserId: "user-1",
      applicantEmail: "tenant@example.com",
      applicantName: "Taylor Tenant",
      propertyId: "prop-1",
      propertyLabel: "123 Main St",
      unitLabel: "Unit 4",
      providerSelection: "transunion_redirect",
      status: "requested",
      createdAt: 100,
      updatedAt: 100,
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/screening/screening-1/consent",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
        "user-agent": "vitest-agent",
      },
      body: {
        accepted: true,
        providerDisclosure:
          "The landlord is requesting screening for this rental application. A third-party screening provider may be used.",
        disclosureVersion: "screening-consent-v2",
        consentSummary: "Consent summary snapshot",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.screeningRequest?.consent?.acceptedAt).toBeTypeOf("number");
    expect(res.body?.screeningRequest?.consent?.providerLabel).toBe("TransUnion");
    expect(res.body?.screeningRequest?.consent?.consentVersion).toBe("screening-consent-v2");

    const savedConsent = Array.from(ensureCollection("screening_consents").values())[0];
    expect(savedConsent).toEqual(
      expect.objectContaining({
        requestId: "screening-1",
        tenantId: "tenant-1",
        applicantId: "user-1",
        rentalApplicationId: "app-1",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        providerKey: "transunion_redirect",
        providerLabel: "TransUnion",
        consentVersion: "screening-consent-v2",
        consentTextSummary: "Consent summary snapshot",
        acceptedBy: "user-1",
      })
    );

    expect(
      Array.from(ensureCollection("screening_audit_log").values()).some(
        (event) => event.eventType === "consent_accepted"
      )
    ).toBe(true);
    expect(
      Array.from(ensureCollection("canonicalEvents").values()).some(
        (event) =>
          event.type === "screening_consent_confirmed" &&
          event.metadata?.requestId === "screening-1" &&
          event.metadata?.providerKey === "transunion_redirect"
      )
    ).toBe(true);
  });

  it("returns a tenant-safe requester display label without exposing private landlord fields", async () => {
    ensureCollection("screening_requests").set("screening-label-1", {
      rentalApplicationId: "app-1",
      landlordId: "landlord-1",
      applicantTenantId: "tenant-1",
      applicantUserId: "user-1",
      applicantEmail: "tenant@example.com",
      applicantName: "Taylor Tenant",
      propertyId: "prop-1",
      propertyLabel: "123 Main St",
      unitLabel: "Unit 4",
      providerSelection: "transunion_redirect",
      status: "consent_pending",
      createdAt: 100,
      updatedAt: 100,
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/screening",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    const item = (res.body?.items || []).find((entry: any) => entry.id === "screening-label-1");
    expect(item?.requesterDisplayLabel).toBe("Harbour Homes Ltd.");
    expect(item?.tenantStatus).toBe("consent_required");
    expect(item?.tenantStatusLabel).toBe("Consent required");
    expect(item?.tenantStatusDescription).toMatch(/authorization is required before it can proceed/i);
    expect(item?.tenantNextAction).toBe("authorize_screening");
    expect(item).not.toHaveProperty("landlordEmail");
    expect(item).not.toHaveProperty("landlordPhone");
    expect(item).not.toHaveProperty("providerSetupState");
    expect(JSON.stringify(item)).not.toContain("private-landlord@example.com");
    expect(JSON.stringify(item)).not.toContain("private-user@example.com");
    expect(JSON.stringify(item)).not.toContain("private-account@example.com");
  });

  it("rejects screening consent for another tenant's request", async () => {
    ensureCollection("screening_requests").set("screening-2", {
      rentalApplicationId: "app-1",
      landlordId: "landlord-1",
      applicantTenantId: "tenant-2",
      propertyId: "prop-1",
      status: "requested",
      createdAt: 100,
      updatedAt: 100,
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/screening/screening-2/consent",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        accepted: true,
      },
    });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("FORBIDDEN");
  });

  it("keeps screening blocked when tenant consent is missing", async () => {
    ensureCollection("screening_requests").set("screening-3", {
      rentalApplicationId: "app-1",
      landlordId: "landlord-1",
      applicantTenantId: "tenant-1",
      applicantUserId: "user-1",
      propertyId: "prop-1",
      providerSelection: "manual",
      status: "consent_pending",
      createdAt: 100,
      updatedAt: 100,
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/screening/screening-3/start",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("CONSENT_REQUIRED");
    expect(res.body?.blockReason).toBe("missing_tenant_consent");
  });

  it("allows screening to proceed past the consent gate when consent exists", async () => {
    ensureCollection("screening_requests").set("screening-4", {
      rentalApplicationId: "app-1",
      landlordId: "landlord-1",
      applicantTenantId: "tenant-1",
      applicantUserId: "user-1",
      applicantName: "Taylor Tenant",
      propertyId: "prop-1",
      propertyLabel: "123 Main St",
      unitLabel: "Unit 4",
      providerSelection: "manual",
      latestConsentId: "consent-4",
      status: "consented",
      createdAt: 100,
      updatedAt: 100,
    });
    ensureCollection("screening_consents").set("consent-4", {
      id: "consent-4",
      requestId: "screening-4",
      tenantId: "tenant-1",
      applicantId: "user-1",
      acceptedAt: 200,
      viewedAt: 150,
      providerKey: "manual",
      providerLabel: "Manual review",
      consentVersion: "screening-consent-v2",
      providerDisclosure: "Disclosure",
      disclosureVersion: "screening-consent-v2",
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/screening/screening-4/start",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.screeningRequest?.session?.providerKey).toBe("manual");
    expect(res.body?.screeningRequest?.status).toBe("manual_review_required");
    expect(res.body?.screeningRequest?.tenantStatus).toBe("manual_review");
    expect(res.body?.screeningRequest?.tenantStatusLabel).toBe("Manual review may be required");
    expect(res.body?.screeningRequest?.tenantNextAction).toBe("view_status");
  });
});
