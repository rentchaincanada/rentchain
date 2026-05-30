import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  leaseNotices,
  leases,
  getLeaseForTenantWorkflowMock,
  appendLeaseWorkflowEventMock,
  lookupUserEmailMock,
  sendLeaseWorkflowEmailMock,
} = vi.hoisted(() => ({
  leaseNotices: new Map<string, any>(),
  leases: new Map<string, any>(),
  getLeaseForTenantWorkflowMock: vi.fn(),
  appendLeaseWorkflowEventMock: vi.fn(),
  lookupUserEmailMock: vi.fn(),
  sendLeaseWorkflowEmailMock: vi.fn(),
}));

function clone(value: any) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function docRef(collectionName: string, id?: string) {
  const docId = id || `${collectionName}-${leaseNotices.size + leases.size + 1}`;
  const collection = collectionName === "leases" ? leases : leaseNotices;
  return {
    id: docId,
    get: async () => ({
      id: docId,
      exists: collection.has(docId),
      data: () => clone(collection.get(docId)),
    }),
    set: async (value: any, opts?: { merge?: boolean }) => {
      const current = collection.get(docId) || {};
      collection.set(docId, opts?.merge ? { ...current, ...clone(value) } : clone(value));
    },
  };
}

vi.mock("../../config/firebase", () => ({
  db: {
    batch: () => {
      const writes: Array<() => Promise<void>> = [];
      return {
        set(ref: any, value: any, opts?: { merge?: boolean }) {
          writes.push(() => ref.set(value, opts));
        },
        async commit() {
          await Promise.all(writes.map((write) => write()));
        },
      };
    },
    collection: (name: string) => ({
      doc: (id?: string) => docRef(name, id),
      where: (field: string, op: string, value: any) => ({
        limit: (_count: number) => ({
          get: async () => {
            const source = name === "leases" ? leases : leaseNotices;
            const docs = Array.from(source.entries())
              .filter(([, data]) => (op === "==" ? data?.[field] === value : false))
              .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
            return { docs, empty: docs.length === 0 };
          },
        }),
      }),
    }),
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) req.user = JSON.parse(header);
    next();
  },
}));

vi.mock("../../config/leaseNoticeRules", () => ({
  getLeaseNoticeWorkflowFlag: () => ({ enabled: true, source: "test" }),
}));

vi.mock("../../services/leaseNoticeWorkflowService", () => ({
  appendLeaseWorkflowEvent: appendLeaseWorkflowEventMock,
  computeNoResponseState: () => false,
  getLeaseForTenantWorkflow: getLeaseForTenantWorkflowMock,
  lookupUserEmail: lookupUserEmailMock,
  sendLeaseWorkflowEmail: sendLeaseWorkflowEmailMock,
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      params: {},
    };
    const match = options.url.match(/^\/([^/?]+)(?:\/([^/?]+))?/);
    if (match?.[1]) req.params.id = decodeURIComponent(match[1]);
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
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

function tenantHeaders() {
  return {
    "x-test-user": JSON.stringify({
      id: "user-tenant-1",
      role: "tenant",
      tenantId: "tenant-1",
      email: "tenant@example.test",
    }),
  };
}

function noticeFixture(overrides: Record<string, any> = {}) {
  return {
    id: "notice-1",
    leaseId: "lease-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    noticeType: "renewal_offer",
    legalTemplateKey: "ns-fixed-term-renewal",
    province: "NS",
    leaseType: "fixed_term",
    noticeDueAt: 100,
    sentAt: 110,
    deliveryStatus: "sent",
    deliveryChannel: "email",
    rentChangeMode: "increase",
    currentRent: 1800,
    proposedRent: 1900,
    newTermType: "fixed_term",
    newTermStartDate: "2027-02-01",
    newTermEndDate: "2028-01-31",
    responseRequired: true,
    responseDeadlineAt: 200,
    tenantResponse: "pending",
    tenantRespondedAt: null,
    tenantViewedAt: 120,
    createdAt: 90,
    updatedAt: 110,
    metadata: {
      noticeRuleVersion: "v1",
      summary: {
        title: "Lease renewal offer",
        body: "Review your next-term options.",
      },
      landlordInternalNotes: "private landlord note",
    },
    landlordDecisionNotes: "private decision note",
    internalWorkflowState: "operator-only",
    providerDeliveryPayload: { messageId: "provider-message-id" },
    ...overrides,
  };
}

describe("tenantLeaseNoticeRoutes tenant-safe projections", () => {
  beforeEach(() => {
    leaseNotices.clear();
    leases.clear();
    getLeaseForTenantWorkflowMock.mockReset();
    appendLeaseWorkflowEventMock.mockReset();
    lookupUserEmailMock.mockReset();
    sendLeaseWorkflowEmailMock.mockReset();
    lookupUserEmailMock.mockResolvedValue("landlord@example.test");
    sendLeaseWorkflowEmailMock.mockResolvedValue({
      ok: true,
      attempted: true,
      provider: "mailgun",
      reason: null,
      rawPayload: "provider-private",
    });
  });

  it("adds tenant-safe projection metadata and redacts internal lease notice fields from list responses", async () => {
    leaseNotices.set("notice-1", noticeFixture());

    const router = (await import("../tenantLeaseNoticeRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/",
      headers: tenantHeaders(),
    });

    expect(res.status).toBe(200);
    expect(res.body?.projectionProfile).toEqual(
      expect.objectContaining({
        projectionName: "tenant_safe_lease_notice_projection",
        scopeType: "tenant_lease_notice",
      })
    );
    expect(res.body?.items?.[0]?.projectionProfile?.projectionName).toBe("tenant_safe_lease_notice_projection");
    expect(res.body?.items?.[0]?.metadata?.summary?.body).toBe("Review your next-term options.");
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain("private landlord note");
    expect(payload).not.toContain("private decision note");
    expect(payload).not.toContain("operator-only");
    expect(payload).not.toContain("provider-message-id");
  });

  it("adds projection metadata to detail responses and preserves append-safe viewed state", async () => {
    const notice = noticeFixture();
    getLeaseForTenantWorkflowMock.mockResolvedValue({ ok: true, notice: { ...notice } });

    const router = (await import("../tenantLeaseNoticeRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/notice-1",
      headers: tenantHeaders(),
    });

    expect(res.status).toBe(200);
    expect(res.body?.item?.projectionProfile?.projectionName).toBe("tenant_safe_lease_notice_projection");
    expect(res.body?.redactionSummary?.redactedFieldGroups).toEqual(
      expect.arrayContaining(["landlord_internal_workflow_state", "provider_delivery_payloads"])
    );
    expect(appendLeaseWorkflowEventMock).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain("private decision note");
  });

  it("adds projection metadata to tenant response mutations without returning provider payloads", async () => {
    const notice = noticeFixture({ tenantViewedAt: 120 });
    getLeaseForTenantWorkflowMock.mockResolvedValue({ ok: true, notice: { ...notice } });
    leases.set("lease-1", { endDate: "2027-01-31" });

    const router = (await import("../tenantLeaseNoticeRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/notice-1/respond",
      body: { decision: "renew" },
      headers: tenantHeaders(),
    });

    expect(res.status).toBe(200);
    expect(res.body?.projectionProfile?.projectionName).toBe("tenant_safe_lease_notice_projection");
    expect(res.body?.decision).toBe("renew");
    expect(res.body?.landlordNotification).toEqual({
      ok: true,
      attempted: true,
      reason: null,
    });
    expect(JSON.stringify(res.body)).not.toContain("mailgun");
    expect(JSON.stringify(res.body)).not.toContain("provider-private");
    expect(appendLeaseWorkflowEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "leaseNotice",
        entityId: "notice-1",
        eventType: "tenant_renewed",
      })
    );
  });
});
