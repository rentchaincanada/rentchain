import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  const dbMock = {
    collection: (name: string) => ({
      where: (field: string, _op: string, value: any) => ({
        limit: (_count: number) => ({
          get: async () => {
            const docs = Array.from(ensureCollection(name).entries())
              .filter(([, data]) => data?.[field] === value)
              .map(([id, data]) => ({ id, data: () => data }));
            return { docs, empty: docs.length === 0, size: docs.length };
          },
        }),
      }),
      limit: (_count: number) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
      doc: (id?: string) => {
        const docId = id || `${name}_${++autoId}`;
        return {
          id: docId,
          get: async () => ({
            id: docId,
            exists: ensureCollection(name).has(docId),
            data: () => ensureCollection(name).get(docId),
          }),
          set: async (value: any, options?: { merge?: boolean }) => {
            const current = ensureCollection(name).get(docId) || {};
            ensureCollection(name).set(docId, options?.merge ? { ...current, ...value } : value);
          },
        };
      },
    }),
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set(ref: any, value: any, options?: { merge?: boolean }) {
          ops.push(() => ref.set(value, options));
        },
        async commit() {
          for (const op of ops) {
            await op();
          }
        },
      };
    },
  };

  return { collections, dbMock };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../config/leaseNoticeRules", () => ({
  getLeaseNoticeWorkflowFlag: () => ({ enabled: true, source: "test" }),
}));

const appendLeaseWorkflowEvent = vi.fn(async () => undefined);
const buildPreview = vi.fn(async () => undefined);
const computeNoResponseStateMock = vi.fn(() => false);
const deriveLandlordVisibleExpiringLeasesMock = vi.fn(async () => []);
const deriveLeaseRenewalOperatorInputRecord = vi.fn((lease: any) => ({
  rentChangeMode: lease?.renewalRentChangeMode ?? null,
  proposedRent: lease?.renewalOfferedRent ?? null,
  newTermType: lease?.renewalNewTermType ?? null,
  newLeaseStartDate: lease?.renewalNewLeaseStartDate ?? null,
  newLeaseEndDate: lease?.renewalNewLeaseEndDate ?? null,
  responseDeadlineAt: lease?.renewalDecisionDeadlineAt ?? null,
}));
const lookupUserEmail = vi.fn(async () => "tenant@example.com");
const normalizeLeaseRecord = vi.fn((id: string, raw: any) => ({ id, ...(raw || {}) }));
const performLeaseNoticeSendFromPreviewInput = vi.fn(async () => ({
  status: 201,
  payload: { ok: true, noticeId: "notice-1", autopilotPolicy: { outcome: "allow", canAutopilot: true } },
}));
const sanitizeLeaseRenewalOperatorInput = vi.fn((body: any) => ({
  ok: true,
  data: {
    rentChangeMode: body?.rentChangeMode ?? null,
    proposedRent: body?.proposedRent ?? null,
    newTermType: body?.newTermType ?? null,
    newLeaseStartDate: body?.newLeaseStartDate ?? null,
    newLeaseEndDate: body?.newLeaseEndDate ?? null,
    responseDeadlineAt: body?.responseDeadlineAt ?? null,
  },
}));
const sendLeaseWorkflowEmail = vi.fn(async () => ({ ok: true }));
const getLeaseForLandlordWorkflow = vi.fn(async () => ({
  ok: true,
  lease: {
    id: "lease-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    province: "NS",
    leaseType: "fixed_term",
    currentRent: 1800,
    currency: "CAD",
  },
}));

vi.mock("../../services/leaseNoticeWorkflowService", () => ({
  appendLeaseWorkflowEvent,
  buildPreview,
  computeNoResponseState: computeNoResponseStateMock,
  deriveLandlordVisibleExpiringLeases: deriveLandlordVisibleExpiringLeasesMock,
  deriveLeaseRenewalOperatorInputRecord,
  getLeaseForLandlordWorkflow,
  getLeaseNoticeByLeaseId: vi.fn(),
  lookupUserEmail,
  normalizeLeaseRecord,
  performLeaseNoticeSendFromPreviewInput,
  sanitizeLeaseRenewalOperatorInput,
  sendLeaseWorkflowEmail,
}));

async function invokeRouter(router: any, options: { method: string; url: string; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const parsedUrl = new URL(options.url, "http://localhost");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: parsedUrl.pathname,
      body: options.body ?? {},
      headers: {},
      query: Object.fromEntries(parsedUrl.searchParams.entries()),
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

function readCollectionDoc(name: string, id: string) {
  return collections.get(name)?.get(id) ?? null;
}

describe("leaseNoticeLandlordRoutes policy integration", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
    computeNoResponseStateMock.mockReturnValue(false);
    deriveLandlordVisibleExpiringLeasesMock.mockResolvedValue([]);
    normalizeLeaseRecord.mockImplementation((id: string, raw: any) => ({ id, ...(raw || {}) }));
    sanitizeLeaseRenewalOperatorInput.mockImplementation((body: any) => ({
      ok: true,
      data: {
        rentChangeMode: body?.rentChangeMode ?? null,
        proposedRent: body?.proposedRent ?? null,
        newTermType: body?.newTermType ?? null,
        newLeaseStartDate: body?.newLeaseStartDate ?? null,
        newLeaseEndDate: body?.newLeaseEndDate ?? null,
        responseDeadlineAt: body?.responseDeadlineAt ?? null,
      },
    }));
    buildPreview.mockReturnValue({
      ok: true,
      rule: { noticeLeadDays: 90 },
      preview: {
        noticeType: "renewal_offer",
        legalTemplateKey: "ns_fixed_term_renewal",
        noticeRuleVersion: "v1",
        noticeDueAt: 1700000000000,
        rentChangeMode: "no_change",
        currentRent: 1800,
        proposedRent: 1800,
        newTermType: "fixed_term",
        newTermStartDate: "2026-07-01",
        newTermEndDate: "2027-06-30",
        responseDeadlineAt: 1700000000000,
        summary: { title: "Lease notice preview", body: "Preview body" },
      },
    });
  });

  it("blocks lease notice preview when required legal inputs are missing", async () => {
    const router = (await import("../leaseNoticeLandlordRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/notice-preview",
      body: {
        responseDeadlineAt: 1700000000000,
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("LEASE_NOTICE_POLICY_BLOCKED");
    expect(res.body?.autopilotPolicy).toEqual(
      expect.objectContaining({
        outcome: "block",
        topReasonCode: "LEASE_NOTICE_REQUIRED_INPUTS_MISSING",
      })
    );
    const policyEvent = Array.from((collections.get("canonicalEvents") || new Map()).values()).find(
      (entry) => entry?.type === "policy.evaluated"
    );
    expect(policyEvent).toEqual(
      expect.objectContaining({
        domain: "policy",
        metadata: expect.objectContaining({
          domain: "lease_notice",
          action: "preview_notice",
          outcome: "block",
        }),
      })
    );
  });

  it("allows lease notice preview when inputs are complete", async () => {
    const router = (await import("../leaseNoticeLandlordRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/notice-preview",
      body: {
        newLeaseStartDate: "2026-07-01",
        newLeaseEndDate: "2027-06-30",
        responseDeadlineAt: 1700000000000,
        rentChangeMode: "no_change",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.autopilotPolicy).toEqual(
      expect.objectContaining({
        outcome: "allow",
        canAutopilot: true,
      })
    );
    expect(appendLeaseWorkflowEvent).toHaveBeenCalled();
  });

  it("auto-sends the notice from preview when automation is requested and policy allows", async () => {
    const router = (await import("../leaseNoticeLandlordRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/lease-1/notice-preview",
      body: {
        newLeaseStartDate: "2026-07-01",
        newLeaseEndDate: "2027-06-30",
        responseDeadlineAt: 1700000000000,
        rentChangeMode: "no_change",
        automationEnabled: true,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.automationResult).toEqual(
      expect.objectContaining({
        action: "lease.auto_send_notice",
        executed: true,
        skipped: false,
      })
    );
    expect(res.body?.noticeId).toBeTruthy();
    const automationEvent = Array.from((collections.get("canonicalEvents") || new Map()).values()).find(
      (entry) => entry?.type === "automation.executed"
    );
    expect(automationEvent).toEqual(
      expect.objectContaining({
        domain: "system",
        metadata: expect.objectContaining({
          action: "lease.auto_send_notice",
        }),
      })
    );
  });

  it("persists renewal operator inputs canonically on the lease record", async () => {
    const router = (await import("../leaseNoticeLandlordRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PUT",
      url: "/lease-1/renewal-inputs",
      body: {
        rentChangeMode: "no_change",
        newTermType: "fixed_term",
        newLeaseStartDate: "2026-07-01",
        newLeaseEndDate: "2027-06-30",
        responseDeadlineAt: 1700000000000,
      },
    });

    expect(res.status).toBe(200);
    expect(readCollectionDoc("leases", "lease-1")).toEqual(
      expect.objectContaining({
        renewalRentChangeMode: "no_change",
        renewalNewTermType: "fixed_term",
        renewalNewLeaseStartDate: "2026-07-01",
        renewalNewLeaseEndDate: "2027-06-30",
        renewalDecisionDeadlineAt: 1700000000000,
      })
    );
    expect(res.body?.renewalInputs).toEqual(
      expect.objectContaining({
        rentChangeMode: "no_change",
        newTermType: "fixed_term",
        newLeaseStartDate: "2026-07-01",
        newLeaseEndDate: "2027-06-30",
        responseDeadlineAt: 1700000000000,
      })
    );
  });

  it("returns only expiring workflow items when the expiring status filter is requested", async () => {
    deriveLandlordVisibleExpiringLeasesMock.mockResolvedValue([
      {
        id: "lease-expiring",
        propertyAddress: "123 Harbour St",
        noticeBucket: "expiring",
        nextNoticeDueAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
        latestNotice: null,
      },
      {
        id: "lease-pending",
        propertyAddress: "123 Harbour St",
        noticeBucket: "pending-response",
        nextNoticeDueAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
        latestNotice: { tenantResponse: "pending" },
      },
    ]);

    const router = (await import("../leaseNoticeLandlordRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/expiring?status=expiring",
    });

    expect(res.status).toBe(200);
    expect(res.body?.items).toHaveLength(1);
    expect(res.body?.items[0]).toEqual(
      expect.objectContaining({
        id: "lease-expiring",
        propertyAddress: "123 Harbour St",
        noticeBucket: "expiring",
        leaseLifecycleSummary: expect.objectContaining({
          lifecycleStatus: "expiring_soon",
          requiredNextAction: "prepare_renewal_notice",
        }),
      })
    );
  });

  it("returns only pending-response workflow items when that status filter is requested", async () => {
    deriveLandlordVisibleExpiringLeasesMock.mockResolvedValue([
      {
        id: "lease-expiring",
        noticeBucket: "expiring",
        nextNoticeDueAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
        latestNotice: null,
      },
      {
        id: "lease-pending",
        noticeBucket: "pending-response",
        nextNoticeDueAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
        latestNotice: { tenantResponse: "pending" },
      },
    ]);

    const router = (await import("../leaseNoticeLandlordRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/expiring?status=pending-response",
    });

    expect(res.status).toBe(200);
    expect(res.body?.items).toHaveLength(1);
    expect(res.body?.items[0]).toEqual(
      expect.objectContaining({
        id: "lease-pending",
        noticeBucket: "pending-response",
        leaseLifecycleSummary: expect.objectContaining({
          lifecycleStatus: "renewal_pending",
        }),
      })
    );
  });

  it("returns only no-response workflow items when that status filter is requested", async () => {
    computeNoResponseStateMock.mockReturnValue(true);
    deriveLandlordVisibleExpiringLeasesMock.mockResolvedValue([
      {
        id: "lease-no-response",
        noticeBucket: "no-response",
        nextNoticeDueAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
        latestNotice: { tenantResponse: "pending" },
      },
    ]);

    const router = (await import("../leaseNoticeLandlordRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/expiring?status=no-response",
    });

    expect(res.status).toBe(200);
    expect(res.body?.items).toHaveLength(1);
    expect(res.body?.items[0]).toEqual(
      expect.objectContaining({
        id: "lease-no-response",
        noticeBucket: "no-response",
        leaseLifecycleSummary: expect.objectContaining({
          lifecycleStatus: "no_response",
        }),
      })
    );
  });
});
