import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, upsertDoc, sendEmailMock } = vi.hoisted(() => {
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
    },
    upsertDoc: (collectionName: string, id: string, data: any) => {
      ensureCollection(collectionName).set(id, { id, data });
    },
    sendEmailMock: vi.fn(async () => undefined),
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));

vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: vi.fn(() => "<p>email</p>"),
  buildEmailText: vi.fn(() => "email"),
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));

async function invokeRouter(params: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const router = (await import("../applicationReminderInternalRoutes")).default;
  return await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: params.method,
      url: params.url,
      originalUrl: params.url,
      path: params.url,
      headers: params.headers || {},
      body: params.body ?? {},
    };
    const res: any = {
      statusCode: 200,
      payload: undefined,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.payload = payload;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        this.payload = payload;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (err: any) => {
      if (err) reject(err);
      else resolve({ statusCode: res.statusCode, body: res.payload });
    });
  });
}

function buildPartialProgress(overrides?: Partial<any>) {
  return {
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
    ...overrides,
  };
}

describe("applicationReminderInternalRoutes", () => {
  beforeEach(() => {
    resetDb();
    process.env.INTERNAL_JOB_TOKEN = "secret-token";
    process.env.EMAIL_FROM = "noreply@rentchain.test";
    process.env.PUBLIC_APP_URL = "https://www.rentchain.test";
  });

  it("rejects requests without the internal job token", async () => {
    const res = await invokeRouter({
      method: "POST",
      url: "/application-links/process-reminders",
      body: {},
    });
    expect(res.statusCode).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("processes an eligible link once and marks it sent", async () => {
    upsertDoc("applicationLinks", "link-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      applicantEmail: "applicant@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      tokenHash: "old-hash",
      partialProgress: buildPartialProgress(),
    });
    upsertDoc("properties", "prop-1", { name: "Harbour View" });
    upsertDoc("units", "unit-1", { unitNumber: "1A" });

    const res = await invokeRouter({
      method: "POST",
      url: "/application-links/process-reminders",
      headers: { "x-internal-job-token": "secret-token" },
      body: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.data).toMatchObject({
      scanned: 1,
      eligible: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
      processedLinkIds: ["link-1"],
    });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const stored = await dbMock.collection("applicationLinks").doc("link-1").get();
    expect(stored.data()?.partialProgress?.reminderSentAt).toEqual(expect.any(Number));
    expect(stored.data()?.tokenHash).not.toBe("old-hash");
  });

  it("skips submitted, already-sent, and missing-email links", async () => {
    upsertDoc("applicationLinks", "link-submitted", {
      landlordId: "landlord-1",
      applicantEmail: "submitted@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: buildPartialProgress({ submittedAt: 1700007200000 }),
    });
    upsertDoc("applicationLinks", "link-sent", {
      landlordId: "landlord-1",
      applicantEmail: "sent@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: buildPartialProgress({ reminderSentAt: 1700007200000 }),
    });
    upsertDoc("applicationLinks", "link-no-email", {
      landlordId: "landlord-1",
      applicantEmail: null,
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: buildPartialProgress(),
    });

    const res = await invokeRouter({
      method: "POST",
      url: "/application-links/process-reminders",
      headers: { "x-internal-job-token": "secret-token" },
      body: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.data).toMatchObject({
      scanned: 3,
      eligible: 0,
      sent: 0,
      skipped: 3,
      failed: 0,
      processedLinkIds: [],
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not mark reminderSentAt when email delivery fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("mail_failed"));
    upsertDoc("applicationLinks", "link-1", {
      landlordId: "landlord-1",
      applicantEmail: "applicant@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      tokenHash: "old-hash",
      partialProgress: buildPartialProgress(),
    });

    const res = await invokeRouter({
      method: "POST",
      url: "/application-links/process-reminders",
      headers: { "x-internal-job-token": "secret-token" },
      body: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.data).toMatchObject({
      scanned: 1,
      eligible: 1,
      sent: 0,
      skipped: 0,
      failed: 1,
      processedLinkIds: ["link-1"],
    });
    const stored = await dbMock.collection("applicationLinks").doc("link-1").get();
    expect(stored.data()?.partialProgress?.reminderSentAt).toBeNull();
    expect(stored.data()?.tokenHash).toBe("old-hash");
  });

  it("respects the per-request limit", async () => {
    upsertDoc("applicationLinks", "link-1", {
      landlordId: "landlord-1",
      applicantEmail: "one@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: buildPartialProgress(),
    });
    upsertDoc("applicationLinks", "link-2", {
      landlordId: "landlord-1",
      applicantEmail: "two@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: buildPartialProgress(),
    });
    upsertDoc("applicationLinks", "link-3", {
      landlordId: "landlord-1",
      applicantEmail: "three@example.com",
      expiresAt: 4102444800000,
      status: "ACTIVE",
      partialProgress: buildPartialProgress(),
    });

    const res = await invokeRouter({
      method: "POST",
      url: "/application-links/process-reminders",
      headers: { "x-internal-job-token": "secret-token" },
      body: { limit: 2 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.data).toMatchObject({
      scanned: 3,
      eligible: 3,
      sent: 2,
      failed: 0,
      processedLinkIds: ["link-1", "link-2"],
    });
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });
});
