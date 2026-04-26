import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, upsertDoc, sendEmailMock, buildEmailHtmlMock, buildEmailTextMock, recordRiskDecisionAuditMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

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

  function buildQuery(collectionName: string, predicates: Array<{ field: string; value: any }> = []) {
    return {
      where: (field: string, _op: string, value: any) =>
        buildQuery(collectionName, [...predicates, { field, value }]),
      limit: (_count: number) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(collectionName).values())
            .filter((entry) => predicates.every((predicate) => entry.data?.[predicate.field] === predicate.value))
            .map((entry) => ({
              id: entry.id,
              data: () => entry.data,
            }));
          return { docs, empty: docs.length === 0 };
        },
      }),
      get: async () => {
        const docs = Array.from(ensureCollection(collectionName).values())
          .filter((entry) => predicates.every((predicate) => entry.data?.[predicate.field] === predicate.value))
          .map((entry) => ({
            id: entry.id,
            data: () => entry.data,
          }));
        return { docs, empty: docs.length === 0 };
      },
    };
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        doc: (id?: string) => toDocRef(name, id || `auto_${++autoId}`),
        where: (field: string, op: string, value: any) => buildQuery(name).where(field, op, value),
      }),
    },
    resetDb: () => {
      collections.clear();
      autoId = 0;
      sendEmailMock.mockReset();
      recordRiskDecisionAuditMock.mockReset();
    },
    upsertDoc: (collectionName: string, id: string, data: any) => {
      ensureCollection(collectionName).set(id, { id, data });
    },
    sendEmailMock: vi.fn(async () => undefined),
    buildEmailHtmlMock: vi.fn(() => "<p>email</p>"),
    buildEmailTextMock: vi.fn(() => "email"),
    recordRiskDecisionAuditMock: vi.fn(async (payload: any) => ({
      id: "audit-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      ...payload,
    })),
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const token = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim().toLowerCase();
    if (token === "admin") {
      req.user = { id: "admin-1", landlordId: "admin-1", role: "admin", email: "admin@example.com" };
      return next();
    }
    if (token === "missing-email") {
      req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "" };
      return next();
    }
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "owner@example.com" };
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
  runPrimaryWithFallback: vi.fn(async ({ runLegacy }: any) => (runLegacy ? runLegacy() : { ok: true })),
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
  buildReviewSummary: vi.fn(),
  buildReviewSummaryPdf: vi.fn(),
}));

vi.mock("../../services/risk/applicationDecisionSummary", () => ({
  buildApplicationDecisionSummary: vi.fn(() => null),
}));

vi.mock("../../services/riskAgent/riskAgentService", () => ({
  getLatestApplicationRisk: vi.fn(),
}));

vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: buildEmailHtmlMock,
  buildEmailText: buildEmailTextMock,
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("../../services/riskAgent/riskDecisionAuditService", () => ({
  recordRiskDecisionAudit: recordRiskDecisionAuditMock,
}));

async function invokeRouter(router: any, options: { method: string; url: string; body?: any; headers?: Record<string, string> }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
      params: {},
      query: {},
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
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

async function createRouter() {
  const router = (await import("../rentalApplicationsRoutes")).default;
  return router;
}

describe("rentalApplications decision actions", () => {
  beforeEach(() => {
    resetDb();
    buildEmailHtmlMock.mockReset();
    buildEmailHtmlMock.mockReturnValue("<p>email</p>");
    buildEmailTextMock.mockReset();
    buildEmailTextMock.mockReturnValue("email");
    process.env.EMAIL_FROM = "noreply@rentchain.test";
    process.env.PUBLIC_APP_URL = "https://www.rentchain.test";
    upsertDoc("rentalApplications", "app-1", {
      id: "app-1",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      propertyName: "Harbour View",
      status: "SUBMITTED",
      applicant: {
        firstName: "Jamie",
        lastName: "Stone",
        email: "jamie@example.com",
      },
    });
    upsertDoc("landlords", "landlord-1", {
      id: "landlord-1",
      email: "payments@example.com",
    });
  });

  it("stores structured request-info state and sends an applicant email", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/app-1/decision-action",
      headers: { authorization: "Bearer landlord" },
      body: {
        action: "request_info",
        requestedItems: ["upload_id", "references"],
        customMessage: "Please send the missing documents by Friday.",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.data?.status).toBe("IN_REVIEW");
    expect(res.body?.data?.landlordInfoRequest).toMatchObject({
      requestedItems: ["upload_id", "references"],
      customMessage: "Please send the missing documents by Friday.",
    });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(recordRiskDecisionAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        decision: "request_info",
      })
    );
  });

  it("approves the application and includes the configured landlord payment email", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/app-1/decision-action",
      headers: { authorization: "Bearer landlord" },
      body: {
        action: "approve",
        note: "Looks good to move forward.",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.status).toBe("APPROVED");
    expect(res.body?.action?.paymentEmail).toBe("payments@example.com");
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jamie@example.com",
        replyTo: "payments@example.com",
        subject: expect.stringMatching(/approved/i),
      })
    );
  });

  it("fails closed when approval is attempted without a landlord payment email", async () => {
    upsertDoc("landlords", "landlord-1", { id: "landlord-1", email: "" });
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/app-1/decision-action",
      headers: { authorization: "Bearer missing-email" },
      body: {
        action: "approve",
      },
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("LANDLORD_PAYMENT_EMAIL_MISSING");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejects the application and sends a polite applicant update", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/app-1/decision-action",
      headers: { authorization: "Bearer landlord" },
      body: {
        action: "reject",
        note: "Thank you for applying.",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.status).toBe("DECLINED");
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jamie@example.com",
        subject: expect.stringMatching(/update/i),
      })
    );
  });

  it("sends a one-time reminder for an eligible in-progress application link", async () => {
    upsertDoc("applicationLinks", "link-42", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-9",
      applicantEmail: "applicant@example.com",
      applicantName: null,
      createdAt: 1700000000000,
      expiresAt: 4102444800000,
      status: "ACTIVE",
      tokenHash: "old-hash",
      partialProgress: {
        status: "in_progress",
        completionPercent: 62,
        currentStep: "employment",
        completedSections: ["personal_info", "residential_history"],
        missingSections: ["employment", "references_assets", "consent"],
        hasCoApplicant: false,
        viewingChoice: "already_viewed",
        startedAt: 1700000000000,
        lastActivityAt: 1700003600000,
        submittedAt: null,
        reminderEligibleAt: 1700000000000,
        reminderSentAt: null,
      },
    });
    upsertDoc("properties", "prop-1", {
      id: "prop-1",
      name: "Harbour View",
    });
    upsertDoc("units", "unit-9", {
      id: "unit-9",
      unitNumber: "9",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/in-progress/link-42/send-reminder",
      headers: { authorization: "Bearer landlord" },
      body: {},
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "applicant@example.com",
        subject: "Finish your rental application",
      })
    );
    expect(buildEmailTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bullets: expect.arrayContaining([
          "Missing section: Employment",
          "Missing section: References and assets",
          "Missing section: Consent",
        ]),
      })
    );
    expect(buildEmailTextMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        intro: expect.stringMatching(/income|dob|address|reference/i),
      })
    );

    const stored = await dbMock.collection("applicationLinks").doc("link-42").get();
    const storedData = stored.data();
    expect(storedData?.partialProgress?.reminderSentAt).toEqual(expect.any(Number));
    expect(storedData?.tokenHash).not.toBe("old-hash");
  });

  it("forbids reminder sends for links not owned by the landlord", async () => {
    upsertDoc("applicationLinks", "link-42", {
      landlordId: "other-landlord",
      propertyId: "prop-1",
      applicantEmail: "applicant@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: {
        status: "in_progress",
        completionPercent: 62,
        currentStep: "employment",
        completedSections: [],
        missingSections: ["employment"],
        hasCoApplicant: false,
        viewingChoice: "already_viewed",
        startedAt: 1700000000000,
        lastActivityAt: 1700003600000,
        submittedAt: null,
        reminderEligibleAt: 1700000000000,
        reminderSentAt: null,
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/in-progress/link-42/send-reminder",
      headers: { authorization: "Bearer landlord" },
      body: {},
    });

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("FORBIDDEN");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("blocks reminders for submitted in-progress links", async () => {
    upsertDoc("applicationLinks", "link-42", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      applicantEmail: "applicant@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: {
        status: "ready_to_submit",
        completionPercent: 100,
        currentStep: "consent",
        completedSections: ["personal_info", "residential_history", "employment", "references_assets", "consent"],
        missingSections: [],
        hasCoApplicant: false,
        viewingChoice: "already_viewed",
        startedAt: 1700000000000,
        lastActivityAt: 1700003600000,
        submittedAt: 1700007200000,
        reminderEligibleAt: 1700000000000,
        reminderSentAt: null,
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/in-progress/link-42/send-reminder",
      headers: { authorization: "Bearer landlord" },
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("APPLICATION_REMINDER_NOT_ELIGIBLE");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("blocks reminder resend inside the 24h cooldown window", async () => {
    upsertDoc("applicationLinks", "link-42", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      applicantEmail: "applicant@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: {
        status: "in_progress",
        completionPercent: 62,
        currentStep: "employment",
        completedSections: [],
        missingSections: ["employment"],
        hasCoApplicant: false,
        viewingChoice: "already_viewed",
        startedAt: 1700000000000,
        lastActivityAt: 1700003600000,
        submittedAt: null,
        reminderEligibleAt: 1700000000000,
        reminderSentAt: Date.now(),
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/in-progress/link-42/send-reminder",
      headers: { authorization: "Bearer landlord" },
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("APPLICATION_REMINDER_NOT_ELIGIBLE");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("allows reminder resend after the 24h cooldown has elapsed", async () => {
    upsertDoc("applicationLinks", "link-42", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      applicantEmail: "applicant@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      tokenHash: "old-hash",
      partialProgress: {
        status: "in_progress",
        completionPercent: 62,
        currentStep: "employment",
        completedSections: [],
        missingSections: ["employment"],
        hasCoApplicant: false,
        viewingChoice: "already_viewed",
        startedAt: 1700000000000,
        lastActivityAt: 1700003600000,
        submittedAt: null,
        reminderEligibleAt: 1700000000000,
        reminderSentAt: Date.now() - 25 * 60 * 60 * 1000,
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/in-progress/link-42/send-reminder",
      headers: { authorization: "Bearer landlord" },
      body: {},
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const stored = await dbMock.collection("applicationLinks").doc("link-42").get();
    expect(stored.data()?.partialProgress?.reminderSentAt).toEqual(expect.any(Number));
    expect(stored.data()?.tokenHash).not.toBe("old-hash");
  });

  it("blocks reminders when applicantEmail is missing", async () => {
    upsertDoc("applicationLinks", "link-42", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      applicantEmail: null,
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: {
        status: "in_progress",
        completionPercent: 62,
        currentStep: "employment",
        completedSections: [],
        missingSections: ["employment"],
        hasCoApplicant: false,
        viewingChoice: "already_viewed",
        startedAt: 1700000000000,
        lastActivityAt: 1700003600000,
        submittedAt: null,
        reminderEligibleAt: 1700000000000,
        reminderSentAt: null,
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/in-progress/link-42/send-reminder",
      headers: { authorization: "Bearer landlord" },
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body?.error).toBe("APPLICATION_REMINDER_NOT_ELIGIBLE");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not mark reminderSentAt when reminder email delivery fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("mail_failed"));
    upsertDoc("applicationLinks", "link-42", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      applicantEmail: "applicant@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      tokenHash: "old-hash",
      partialProgress: {
        status: "in_progress",
        completionPercent: 62,
        currentStep: "employment",
        completedSections: [],
        missingSections: ["employment"],
        hasCoApplicant: false,
        viewingChoice: "already_viewed",
        startedAt: 1700000000000,
        lastActivityAt: 1700003600000,
        submittedAt: null,
        reminderEligibleAt: 1700000000000,
        reminderSentAt: null,
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/rental-applications/in-progress/link-42/send-reminder",
      headers: { authorization: "Bearer landlord" },
      body: {},
    });

    expect(res.status).toBe(500);
    expect(res.body?.error).toBe("APPLICATION_REMINDER_SEND_FAILED");
    const stored = await dbMock.collection("applicationLinks").doc("link-42").get();
    const storedData = stored.data();
    expect(storedData?.partialProgress?.reminderSentAt).toBeNull();
    expect(storedData?.tokenHash).toBe("old-hash");
  });

  it("includes safe in-progress application link summaries in the landlord list", async () => {
    upsertDoc("applicationLinks", "link-42", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-9",
      createdAt: 1700000000000,
      status: "ACTIVE",
      partialProgress: {
        status: "in_progress",
        completionPercent: 62,
        currentStep: "employment",
        completedSections: ["personal_info", "residential_history"],
        missingSections: ["employment", "references_assets", "consent"],
        hasCoApplicant: false,
        viewingChoice: "already_viewed",
        startedAt: 1700000000000,
        lastActivityAt: 1700003600000,
        submittedAt: null,
        reminderEligibleAt: 1700086400000,
        reminderSentAt: null,
      },
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/rental-applications",
      headers: { authorization: "Bearer landlord" },
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "link-42",
          source: "application_link",
          applicantName: "In-progress applicant",
          email: null,
          status: "IN_PROGRESS",
          completionPercent: 62,
          lastActivityAt: 1700003600000,
          partialProgress: expect.objectContaining({
            status: "in_progress",
            completedSections: ["personal_info", "residential_history"],
          }),
        }),
      ])
    );
  });
});
