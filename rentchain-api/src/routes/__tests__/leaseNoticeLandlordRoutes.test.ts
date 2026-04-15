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
  computeNoResponseState: vi.fn(),
  getLeaseForLandlordWorkflow,
  getLeaseNoticeByLeaseId: vi.fn(),
  lookupUserEmail: vi.fn(),
  normalizeLeaseRecord: vi.fn(),
  sendLeaseWorkflowEmail: vi.fn(),
}));

async function invokeRouter(router: any, options: { method: string; url: string; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: {},
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

describe("leaseNoticeLandlordRoutes policy integration", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
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
});
