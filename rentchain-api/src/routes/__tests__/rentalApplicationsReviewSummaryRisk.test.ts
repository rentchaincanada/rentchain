import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, upsertDoc, getLatestApplicationRiskMock, loadLandlordSafeTenantIdentitySummaryMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function toDocRef(collectionName: string, docId: string) {
    const col = ensureCollection(collectionName);
    return {
      id: docId,
      path: `${collectionName}/${docId}`,
      get: async () => {
        const entry = col.get(docId);
        return {
          id: docId,
          exists: Boolean(entry),
          data: () => entry?.data,
        };
      },
      set: async (payload: any, options?: { merge?: boolean }) => {
        if (options?.merge && col.has(docId)) {
          const existing = col.get(docId)!;
          col.set(docId, { id: docId, data: { ...(existing.data || {}), ...(payload || {}) } });
          return;
        }
        col.set(docId, { id: docId, data: payload });
      },
    };
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        doc: (id?: string) => toDocRef(name, id || "auto_1"),
        where: (_field: string, _op: string, _value: any) => ({
          limit: (_count: number) => ({
            get: async () => ({ docs: [], empty: true }),
          }),
        }),
      }),
    },
    resetDb: () => {
      collections.clear();
      getLatestApplicationRiskMock.mockReset();
    },
    upsertDoc: (collectionName: string, id: string, data: any) => {
      ensureCollection(collectionName).set(id, { id, data });
    },
    getLatestApplicationRiskMock: vi.fn(),
    loadLandlordSafeTenantIdentitySummaryMock: vi.fn(),
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const token = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim().toLowerCase();
    if (token === "admin") {
      req.user = { id: "admin-1", landlordId: "admin-1", role: "admin" };
      return next();
    }
    if (token === "landlord-2") {
      req.user = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
      return next();
    }
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    return next();
  },
}));

vi.mock("../../middleware/attachAccount", () => ({
  attachAccount: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/rateLimit", () => ({
  rateLimitScreeningIp: (_req: any, _res: any, next: any) => next(),
  rateLimitScreeningUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => false,
  getStripeClient: () => null,
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../billing/screeningPricing", () => ({
  getScreeningPricing: vi.fn(() => ({
    baseAmountCents: 0,
    verifiedAddOnCents: 0,
    aiAddOnCents: 0,
    scoreAddOnCents: 0,
    expeditedAddOnCents: 0,
    totalAmountCents: 0,
    currency: "cad",
  })),
}));

vi.mock("../../services/stripeFinalize", () => ({
  finalizeStripePayment: vi.fn(),
}));

vi.mock("../../services/stripeScreeningProcessor", () => ({
  applyScreeningResultsFromOrder: vi.fn(),
}));

vi.mock("../../services/screening/screeningPayload", () => ({
  buildScreeningStatusPayload: vi.fn(),
}));

vi.mock("../../services/screening/screeningEvents", () => ({
  writeScreeningEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/screening/reportPdf", () => ({
  buildScreeningPdf: vi.fn(),
}));

vi.mock("../../services/screening/reportExportService", () => ({
  buildShareUrl: vi.fn(),
  createReportExport: vi.fn(),
}));

vi.mock("../../services/screening/providerHealth", () => ({
  getScreeningProviderHealth: vi.fn(),
}));

vi.mock("../../services/integrations/transunion/transunionService", () => ({
  assertTransUnionConnectedForScreening: vi.fn(),
}));

vi.mock("../../services/screening/providers/bureauProvider", () => ({
  getBureauProvider: vi.fn(() => ({
    preflight: vi.fn(async () => ({ ok: true })),
    name: "mock",
  })),
}));

vi.mock("../../services/screening/cutoverCompare", () => ({
  compareQuoteResponses: vi.fn(),
}));

vi.mock("../../services/screening/cutoverConfig", () => ({
  getPrimaryTimeoutMs: vi.fn(() => 1000),
  hashSeedKey: vi.fn(() => "hash"),
  isAllowlistedSeed: vi.fn(() => false),
  parseAllowlist: vi.fn(() => []),
}));

vi.mock("../../services/screening/cutoverTelemetry", () => ({
  logCutoverEvent: vi.fn(),
}));

vi.mock("../../services/screening/runPrimaryWithFallback", () => ({
  runPrimaryWithFallback: vi.fn(async ({ runLegacy }: any) => runLegacy()),
}));

vi.mock("../../services/screening/inviteTokens", () => ({
  buildTenantInviteUrl: vi.fn(),
  createInviteToken: vi.fn(),
}));

vi.mock("../../services/screening/transunionReferral", () => ({
  buildTransUnionReferralUrl: vi.fn(),
}));

vi.mock("../../services/screening/referralTracking", () => ({
  findReferralDoc: vi.fn(),
  hashLandlordId: vi.fn(),
  markReferralCompleted: vi.fn(),
  writeReferralInitiated: vi.fn(),
}));

vi.mock("../../services/screeningJobs", () => ({
  enqueueScreeningJob: vi.fn(),
}));

vi.mock("../../storage/pdfStore", () => ({
  createSignedUrl: vi.fn(),
  putPdfObject: vi.fn(),
}));

vi.mock("../../lib/reviewSummary", () => ({
  buildReviewSummary: vi.fn((_id: string) => ({
    applicationId: "app-1",
    generatedAt: "2026-04-01T00:00:00.000Z",
    applicant: {},
    employment: {},
    reference: {},
    compliance: {},
    screening: { status: "completed", provider: "transunion", referenceId: "ref-1" },
    derived: { incomeToRentRatio: null, completeness: { score: 0.8, label: "High" }, flags: [] },
    insights: [],
  })),
  buildReviewSummaryPdf: vi.fn(),
}));

vi.mock("../../services/risk/applicationDecisionSummary", () => ({
  buildApplicationDecisionSummary: vi.fn(() => ({
    applicationId: "app-1",
    riskInsights: null,
    referenceQuestions: [],
    screeningRecommendation: null,
    screeningSummary: null,
    decisionSupport: null,
  })),
}));

vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: vi.fn(),
  buildEmailText: vi.fn(),
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../services/riskAgent/riskAgentService", () => ({
  getLatestApplicationRisk: getLatestApplicationRiskMock,
}));

vi.mock("../../services/tenantPortal/tenantProfileService", () => ({
  loadLandlordSafeTenantIdentitySummary: loadLandlordSafeTenantIdentitySummaryMock,
  deriveLandlordSafeApplicationReusableFromApplication: vi.fn(() => true),
}));

async function createApp() {
  const router = (await import("../rentalApplicationsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("rentalApplications review summary risk surface", () => {
  beforeEach(() => {
    resetDb();
    loadLandlordSafeTenantIdentitySummaryMock.mockReset();
    loadLandlordSafeTenantIdentitySummaryMock.mockResolvedValue({
      identityStatus: "ready",
      verification: { level: "partial" },
      readinessLabel: "Ready to apply",
      readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
    });
    upsertDoc("rentalApplications", "app-1", {
      id: "app-1",
      landlordId: "landlord-1",
      status: "SUBMITTED",
      applicationSource: "apply_with_rentchain",
      identityReference: {
        source: "rentchain",
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
      },
      approvedScopeKeys: ["identity_summary", "application_summary"],
    });
  });

  it("includes latest risk snapshot when present", async () => {
    getLatestApplicationRiskMock.mockResolvedValue({
      version: "risk-v1",
      status: "completed",
      score: 72,
      grade: "B",
      confidence: 0.84,
      factors: [
        {
          code: "identity_verified",
          label: "Identity verification completed",
          impact: "positive",
          weight: 8,
        },
      ],
      flags: ["Income verification incomplete"],
      recommendations: ["Request additional income documentation"],
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const app = await createApp();
    const res = await request(app)
      .get("/api/rental-applications/app-1/review-summary")
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.risk).toEqual(
      expect.objectContaining({
        version: "risk-v1",
        status: "completed",
        score: 72,
        grade: "B",
      })
    );
    expect(res.body?.tenantIdentitySummary).toEqual({
      identityStatus: "ready",
      verification: { level: "partial" },
      readinessLabel: "Ready to apply",
      readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
    });
    expect(res.body?.trustContext).toEqual(
      expect.objectContaining({
        trustReadiness: "ready",
        trustLabel: "Ready for review",
        recommendedNextAction: "review_application",
      })
    );
    expect(res.body?.trustContext?.positiveSignals).toEqual(
      expect.arrayContaining([
        "Identity profile is organized for landlord review.",
        "Identity profile has stronger supporting signals.",
      ])
    );
    expect(res.body?.tenantCredibilitySummary).toEqual(
      expect.objectContaining({
        completenessLevel: expect.stringMatching(/low|medium|high/),
        verificationLevel: expect.stringMatching(/none|partial|strong/),
        summaryLabel: expect.any(String),
        summaryDescription: expect.any(String),
      })
    );
    expect(res.body?.portableIdentitySummary).toEqual(
      expect.objectContaining({
        portabilityStatus: expect.stringMatching(/not_ready|ready|limited/),
        portabilityLabel: expect.any(String),
        portabilityDescription: expect.any(String),
        reusableAcrossApplications: expect.any(Boolean),
      })
    );
    expect(res.body?.networkReuseSummary).toEqual(
      expect.objectContaining({
        reusable: true,
        source: "apply_with_rentchain",
        reuseStatus: "available",
        consentRequired: true,
      })
    );
    expect(res.body?.tenantIdentitySummary?.documents).toBeUndefined();
    expect(res.body?.tenantIdentitySummary?.screening).toBeUndefined();
    expect(res.body?.tenantCredibilitySummary?.signals).toBeUndefined();
    expect(res.body?.portableIdentitySummary?.readiness).toBeUndefined();
    expect(res.body?.portableIdentitySummary?.identityReference).toBeUndefined();
    expect(JSON.stringify(res.body?.tenantCredibilitySummary || {})).not.toContain("transunion");
    expect(JSON.stringify(res.body?.tenantCredibilitySummary || {})).not.toContain("ref-1");
    expect(JSON.stringify(res.body?.trustContext || {})).not.toContain("transunion");
    expect(JSON.stringify(res.body?.trustContext || {})).not.toContain("ref-1");
    expect(JSON.stringify(res.body?.portableIdentitySummary || {})).not.toContain("token");
    expect(JSON.stringify(res.body?.portableIdentitySummary || {})).not.toContain("approval");
    expect(JSON.stringify(res.body?.networkReuseSummary || {})).not.toContain("identity_summary");
    expect(JSON.stringify(res.body?.networkReuseSummary || {})).not.toContain("provider");
    expect(JSON.stringify(res.body?.networkReuseSummary || {})).not.toContain("token");
  });

  it("returns a safe null risk state when no snapshot exists", async () => {
    getLatestApplicationRiskMock.mockResolvedValue(null);

    const app = await createApp();
    const res = await request(app)
      .get("/api/rental-applications/app-1/review-summary")
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(200);
    expect(res.body?.risk ?? null).toBeNull();
  });

  it("rejects unauthorized cross-landlord access", async () => {
    getLatestApplicationRiskMock.mockResolvedValue(null);

    const app = await createApp();
    const res = await request(app)
      .get("/api/rental-applications/app-1/review-summary")
      .set("Authorization", "Bearer landlord-2");

    expect(res.status).toBe(403);
  });
});
