import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../__tests__/helpers/projectionSafetyAssertions";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));

const collections = new Map<string, Map<string, any>>();
const failingDocGets = new Set<string>();
const queryLimits: Array<{ collection: string; field: string; op: string; count: number }> = [];
let transactionTail: Promise<void> = Promise.resolve();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function seedEligibleLease() {
  ensureCollection("leases").set("lease-1", {
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    tenantIds: ["tenant-1"],
    propertyId: "prop-1",
    unitId: "unit-1",
    status: "active",
  });
}

const dbMock = {
  runTransaction: async (handler: (transaction: any) => Promise<any>) => {
    const run = transactionTail.then(() =>
      handler({
        get: (ref: any) => ref.get(),
        set: (ref: any, value: any, options?: any) => ref.set(value, options),
      })
    );
    transactionTail = run.then(() => undefined, () => undefined);
    return run;
  },
  collection: (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `doc_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: (() => {
            if (failingDocGets.has(`${name}/${docId}`)) throw new Error(`forced ${name} lookup failure`);
            return ensureCollection(name).has(docId);
          })(),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(docId) || {};
          ensureCollection(name).set(docId, opts?.merge ? { ...current, ...clone(value) } : clone(value));
        },
      };
    },
    where: (field: string, op: string, value: any) => ({
      orderBy: () => ({
        limit: (count: number) => ({
          get: async () => {
            queryLimits.push({ collection: name, field, op, count });
            const docs = Array.from(ensureCollection(name).entries())
              .filter(([, data]) =>
                op === "array-contains" ? Array.isArray(data?.[field]) && data[field].includes(value) : data?.[field] === value
              )
              .slice(0, count)
              .map(([id, data]) => ({ id, data: () => clone(data) }));
            return { docs };
          },
        }),
      }),
      limit: (count: number) => ({
        get: async () => {
          queryLimits.push({ collection: name, field, op, count });
          const docs = Array.from(ensureCollection(name).entries())
            .filter(([, data]) =>
              op === "array-contains" ? Array.isArray(data?.[field]) && data[field].includes(value) : data?.[field] === value
            )
            .slice(0, count)
            .map(([id, data]) => ({ id, data: () => clone(data) }));
          return { docs };
        },
      }),
      get: async () => {
        const docs = Array.from(ensureCollection(name).entries())
          .filter(([, data]) =>
            op === "array-contains" ? Array.isArray(data?.[field]) && data[field].includes(value) : data?.[field] === value
          )
          .map(([id, data]) => ({ id, data: () => clone(data) }));
        return { docs };
      },
    }),
  }),
};

vi.mock("../../firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));
vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) req.user = JSON.parse(header);
    next();
  },
}));
vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    return next();
  },
}));
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    return next();
  },
}));
vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
}));
vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: vi.fn(() => "<p>email</p>"),
  buildEmailText: vi.fn(() => "email"),
}));

async function createRouter() {
  return (await import("../messagesRoutes")).default;
}

async function createPreviewQaComposeRouter() {
  return (await import("../messagesRoutes")).previewQaComposeRoutes;
}

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
      query: {},
      params: {},
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

describe("messagesRoutes notifications", () => {
  beforeEach(() => {
    collections.clear();
    failingDocGets.clear();
    queryLimits.length = 0;
    transactionTail = Promise.resolve();
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
    process.env.EMAIL_FROM = "noreply@example.com";

    ensureCollection("conversations").set("conv-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      rawPayload: { providerPayload: "raw conversation payload" },
      internalDebug: "debug conversation route",
      routeSource: "messagesRoutes.ts",
    });
    ensureCollection("messages").set("message-1", {
      conversationId: "conv-1",
      senderRole: "tenant",
      body: "private tenant message body",
      rawReport: "raw message report",
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
    });
    ensureCollection("properties").set("prop-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
      units: [{ id: "unit-1", unitNumber: "2A" }],
    });
    ensureCollection("units").set("unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "2A",
    });
    ensureCollection("users").set("landlord-1", {
      email: "landlord@example.com",
    });
  });

  it("reaches the exact recipient and Compose handlers through the pre-global PR #1510 QA router", async () => {
    const previousEnv = process.env;
    process.env = {
      ...previousEnv,
      PREVIEW_QA_AUTH_ENABLED: "true",
      PREVIEW_QA_AUTH_SCOPE: "pr1510-landlord-messaging",
      APP_ENV: "preview",
      GOOGLE_CLOUD_PROJECT: "rentchain-preview",
      K_SERVICE: "rentchain-pr1510-messaging-qa-14a551d2",
      PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1510-messaging-qa-14a551d2",
      FIRESTORE_ENABLED: "true",
      FIRESTORE_DATABASE_ID: "(default)",
    };
    ensureCollection("leases").set("lease-qa", {
      landlordId: "qa-pr1510-landlord",
      tenantId: "tenant-qa",
      propertyId: "property-qa",
      unitId: "unit-qa",
      status: "active",
    });
    ensureCollection("tenants").set("tenant-qa", {
      landlordId: "qa-pr1510-landlord",
      fullName: "Synthetic Tenant",
    });
    ensureCollection("properties").set("property-qa", {
      landlordId: "qa-pr1510-landlord",
      name: "Synthetic Property",
    });
    ensureCollection("units").set("unit-qa", {
      landlordId: "qa-pr1510-landlord",
      propertyId: "property-qa",
      unitNumber: "QA-1",
    });

    try {
      const previewRouter = await createPreviewQaComposeRouter();
      const headers = { "x-rentchain-preview-qa-identity": "pr1510-landlord" };
      const recipients = await invokeRouter(previewRouter, {
        method: "GET",
        url: "/landlord/messages/recipients",
        headers,
      });
      expect(recipients.status).toBe(200);
      expect(recipients.body.recipients).toEqual([
        expect.objectContaining({ leaseId: "lease-qa", tenantId: "tenant-qa" }),
      ]);

      const compose = await invokeRouter(previewRouter, {
        method: "POST",
        url: "/landlord/messages/conversations",
        headers,
        body: {
          tenantId: "tenant-qa",
          leaseId: "lease-qa",
          body: "Synthetic first message",
          requestId: "qa-route-order-request-0001",
        },
      });
      expect(compose.status).toBe(201);
      expect(compose.body).toEqual(expect.objectContaining({
        conversationId: "qa-pr1510-landlord__tenant-qa__unit-qa",
        created: true,
      }));
      expect(Array.from(ensureCollection("messages").values())).toEqual(
        expect.arrayContaining([expect.objectContaining({ senderRole: "landlord" })])
      );
    } finally {
      process.env = previousEnv;
    }
  });

  it.each([
    ["Production", { GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99" }, undefined],
    ["permanent Preview", { K_SERVICE: "rentchain-preview-backend" }, undefined],
    ["wrong service", { K_SERVICE: "rentchain-pr1510-messaging-qa-deadbeef" }, undefined],
    ["wrong scope", { PREVIEW_QA_AUTH_SCOPE: "pr1509-unified-inbox" }, undefined],
    ["wrong selector", {}, "wrong-landlord"],
  ])("keeps the pre-global Compose router fail-closed for %s", async (_label, overrides, selector) => {
    const previousEnv = process.env;
    process.env = {
      ...previousEnv,
      PREVIEW_QA_AUTH_ENABLED: "true",
      PREVIEW_QA_AUTH_SCOPE: "pr1510-landlord-messaging",
      APP_ENV: "preview",
      GOOGLE_CLOUD_PROJECT: "rentchain-preview",
      K_SERVICE: "rentchain-pr1510-messaging-qa-14a551d2",
      PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1510-messaging-qa-14a551d2",
      FIRESTORE_ENABLED: "true",
      FIRESTORE_DATABASE_ID: "(default)",
      ...overrides,
    };
    try {
      const result = await invokeRouter(await createPreviewQaComposeRouter(), {
        method: "GET",
        url: "/landlord/messages/recipients",
        headers: { "x-rentchain-preview-qa-identity": selector || "pr1510-landlord" },
      });
      expect(result.status).toBe(401);
    } finally {
      process.env = previousEnv;
    }
  });

  it("lists only bounded, independently owned current-lease recipients", async () => {
    seedEligibleLease();
    ensureCollection("tenants").set("tenant-ended", {
      landlordId: "landlord-1",
      fullName: "Ended Tenant",
    });
    ensureCollection("leases").set("lease-ended", {
      landlordId: "landlord-1",
      tenantId: "tenant-ended",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "ended",
    });
    ensureCollection("tenants").set("tenant-forged", {
      landlordId: "landlord-1",
      fullName: "Forged Tenant",
    });
    ensureCollection("leases").set("lease-forged", {
      landlordId: "landlord-1",
      tenantId: "tenant-forged",
      propertyId: "foreign-property",
      unitId: "foreign-unit",
      status: "active",
    });
    ensureCollection("properties").set("foreign-property", { landlordId: "landlord-2" });
    ensureCollection("units").set("foreign-unit", { landlordId: "landlord-2", propertyId: "foreign-property" });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/recipients",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.recipients).toEqual([
      expect.objectContaining({
        leaseId: "lease-1",
        tenantId: "tenant-1",
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      }),
    ]);
    expect(queryLimits).toContainEqual({
      collection: "leases",
      field: "landlordId",
      op: "==",
      count: 100,
    });
  });

  it("atomically creates the canonical conversation and first landlord message", async () => {
    seedEligibleLease();
    ensureCollection("conversations").delete("conv-1");
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: {
        tenantId: "tenant-1",
        leaseId: "lease-1",
        body: "Welcome to your message thread.",
        requestId: "request-first-message-0001",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      conversationId: "landlord-1__tenant-1__unit-1",
      created: true,
    }));
    expect(ensureCollection("conversations").get("landlord-1__tenant-1__unit-1")).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        unitId: "unit-1",
        lastReadAtLandlord: "__server_timestamp__",
      })
    );
    expect(Array.from(ensureCollection("messages").values()).filter((item) => item.body === "Welcome to your message thread.")).toEqual([
      expect.objectContaining({ senderRole: "landlord" }),
    ]);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the canonical conversation and deduplicates a retried first-message request", async () => {
    seedEligibleLease();
    ensureCollection("conversations").set("landlord-1__tenant-1__unit-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
    });
    const router = await createRouter();
    const request = {
      method: "POST",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: {
        tenantId: "tenant-1",
        leaseId: "lease-1",
        body: "A single retried message.",
        requestId: "request-retry-message-0001",
      },
    };

    const first = await invokeRouter(router, request);
    const second = await invokeRouter(router, request);

    expect(first.body).toEqual(expect.objectContaining({ created: false }));
    expect(second.body).toEqual(expect.objectContaining({ created: false, conversationId: first.body.conversationId }));
    expect(Array.from(ensureCollection("messages").values()).filter((item) => item.body === "A single retried message.")).toHaveLength(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("reuses a matching legacy conversation instead of creating a deterministic duplicate", async () => {
    seedEligibleLease();
    ensureCollection("conversations").delete("conv-1");
    ensureCollection("conversations").set("legacy-conversation-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
    });
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: {
        tenantId: "tenant-1",
        leaseId: "lease-1",
        body: "Continue the existing thread.",
        requestId: "request-legacy-message-0001",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      conversationId: "legacy-conversation-1",
      created: false,
    }));
    expect(ensureCollection("conversations").has("landlord-1__tenant-1__unit-1")).toBe(false);
    expect(Array.from(ensureCollection("messages").values()).filter((message) => message.body === "Continue the existing thread.")).toEqual([
      expect.objectContaining({ conversationId: "legacy-conversation-1", senderRole: "landlord" }),
    ]);
  });

  it("serializes concurrent first sends onto one canonical conversation", async () => {
    seedEligibleLease();
    ensureCollection("conversations").delete("conv-1");
    const router = await createRouter();
    const base = {
      method: "POST",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    };
    const [first, second] = await Promise.all([
      invokeRouter(router, { ...base, body: { tenantId: "tenant-1", leaseId: "lease-1", body: "First concurrent message", requestId: "concurrent-request-0001" } }),
      invokeRouter(router, { ...base, body: { tenantId: "tenant-1", leaseId: "lease-1", body: "Second concurrent message", requestId: "concurrent-request-0002" } }),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.conversationId).toBe(second.body.conversationId);
    expect(Array.from(ensureCollection("conversations").keys()).filter((id) => id === "landlord-1__tenant-1__unit-1")).toHaveLength(1);
  });

  it("fails closed for foreign, ended, orphan, malformed, and invalid message requests", async () => {
    seedEligibleLease();
    const router = await createRouter();
    const auth = { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) };
    ensureCollection("leases").set("lease-ended", {
      landlordId: "landlord-1", tenantId: "tenant-1", propertyId: "prop-1", unitId: "unit-1", status: "ended",
    });
    ensureCollection("leases").set("lease-foreign", {
      landlordId: "landlord-2", tenantId: "tenant-1", propertyId: "prop-1", unitId: "unit-1", status: "active",
    });
    ensureCollection("leases").set("lease-orphan", {
      landlordId: "landlord-1", tenantId: "missing-tenant", propertyId: "prop-1", unitId: "unit-1", status: "active",
    });
    const send = (body: any) => invokeRouter(router, { method: "POST", url: "/landlord/messages/conversations", headers: auth, body });

    expect((await send({ tenantId: "tenant-1", leaseId: "lease-ended", body: "No", requestId: "request-ended-0001" })).status).toBe(403);
    expect((await send({ tenantId: "tenant-1", leaseId: "lease-foreign", body: "No", requestId: "request-foreign-0001" })).status).toBe(403);
    expect((await send({ tenantId: "missing-tenant", leaseId: "lease-orphan", body: "No", requestId: "request-orphan-0001" })).status).toBe(403);
    expect((await send({ tenantId: "tenant-1", leaseId: "lease-1", body: "", requestId: "request-empty-0001" })).status).toBe(400);
    expect((await send({ tenantId: "tenant-1", leaseId: "lease-1", body: "x".repeat(4001), requestId: "request-long-0001" })).status).toBe(400);
    expect((await send({ tenantId: "tenant-1", leaseId: "lease-1", body: "No", requestId: "short" })).status).toBe(400);
  });

  it("emails tenant when landlord sends a message", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-1",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: { body: "Please confirm your move-in date." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["tenant@example.com"],
        subject: expect.stringContaining("New message from your landlord"),
      })
    );
  });

  it("emails tenant when landlord replies to an auth-id conversation hydrated by tenant email", async () => {
    ensureCollection("conversations").set("conv-auth-email", {
      landlordId: "landlord-1",
      tenantId: "auth-user-1",
      tenantEmail: "tenant@example.com",
      unitId: "unit-1",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-auth-email",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: { body: "Your landlord reply is ready." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["tenant@example.com"],
      })
    );
  });

  it("emails tenant when landlord replies to a unit-linked conversation resolved through an active lease", async () => {
    ensureCollection("conversations").set("conv-unit-only", {
      landlordId: "landlord-1",
      tenantId: null,
      propertyId: null,
      unitId: "unit-1",
    });
    ensureCollection("leases").set("lease-unit-only", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-unit-only",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: { body: "Unit-linked reply." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["tenant@example.com"],
      })
    );
  });

  it("does not fail landlord send when tenant email is missing", async () => {
    ensureCollection("conversations").set("conv-no-email", {
      landlordId: "landlord-1",
      tenantId: "tenant-no-email",
    });
    ensureCollection("tenants").set("tenant-no-email", {
      fullName: "No Email Tenant",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/messages/conversations/conv-no-email",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
      body: { body: "This should persist without email." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("emails landlord when tenant sends a message", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/tenant/messages/conversation/conv-1",
      headers: { "x-test-user": JSON.stringify({ id: "tenant-user-1", tenantId: "tenant-1", landlordId: "landlord-1", role: "tenant" }) },
      body: { body: "I can confirm by Friday." },
    });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("returns landlord-safe conversation display labels", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversations?.[0]).toEqual(
      expect.objectContaining({
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      })
    );
    expectNoRestrictedProjectionFields(res.body);
    expectPayloadDoesNotContainValues(res.body, [
      "private tenant message body",
      "raw message report",
      "raw conversation payload",
      "debug conversation route",
      "messagesRoutes.ts",
    ]);
  });

  it("preserves landlord message scope fallback from user id when landlordId is absent", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "conv-1",
          tenantDisplayName: "Taylor Tenant",
        }),
      ])
    );
  });

  it("enriches older conversations from tenant-linked property and unit context when available", async () => {
    ensureCollection("conversations").set("conv-2", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: null,
      unitId: null,
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
      propertyId: "prop-1",
      unit: "2A",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "conv-2",
          tenantDisplayName: "Taylor Tenant",
          propertyDisplayLabel: "Harbour View",
          unitDisplayLabel: "Unit 2A",
        }),
      ])
    );
  });

  it("hydrates sparse message conversations from tenant email and current lease context", async () => {
    ensureCollection("conversations").set("conv-lease", {
      landlordId: "landlord-1",
      tenantId: "tenant-lease",
      propertyId: null,
      unitId: null,
    });
    ensureCollection("tenants").set("tenant-lease", {
      email: "lease.tenant@example.com",
      currentLeaseId: "lease-1",
    });
    ensureCollection("leases").set("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-lease",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "conv-lease",
          tenantDisplayName: "lease.tenant@example.com",
          propertyDisplayLabel: "Harbour View",
          unitDisplayLabel: "Unit 2A",
        }),
      ])
    );
  });

  it("hydrates landlord conversations from tenant email and unit records when tenantId is an auth id", async () => {
    ensureCollection("conversations").set("conv-auth", {
      landlordId: "landlord-1",
      tenantId: "auth-user-1",
      tenantEmail: "tenant@example.com",
      propertyId: null,
      unitId: null,
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
      propertyId: "prop-1",
      unitId: "unit-1",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    const conversation = res.body?.conversations?.find((item: any) => item.id === "conv-auth");
    expect(conversation).toEqual(
      expect.objectContaining({
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      })
    );
    expect(`${conversation?.tenantDisplayName} • ${conversation?.unitDisplayLabel}`).not.toBe("Tenant • Assigned unit");
  });

  it("hydrates unit-linked landlord conversations from active lease context", async () => {
    ensureCollection("conversations").set("conv-unit-only", {
      landlordId: "landlord-1",
      tenantId: null,
      propertyId: null,
      unitId: "unit-1",
    });
    ensureCollection("leases").set("lease-unit-only", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/messages/conversations",
      headers: { "x-test-user": JSON.stringify({ id: "landlord-1", landlordId: "landlord-1", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    const conversation = res.body?.conversations?.find((item: any) => item.id === "conv-unit-only");
    expect(conversation).toEqual(
      expect.objectContaining({
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      })
    );
    expect(`${conversation?.tenantDisplayName} • ${conversation?.unitDisplayLabel}`).not.toBe("Tenant • Linked unit");
  });

  it("stores deterministic property context when tenant conversation is created", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation",
      headers: { "x-test-user": JSON.stringify({ id: "tenant-user-1", tenantId: "tenant-1", landlordId: "landlord-1", unitId: "unit-1", role: "tenant" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitId: "unit-1",
      })
    );
  });

  it("returns enriched tenant conversation detail without raw ids in labels", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-user-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation).toEqual(
      expect.objectContaining({
        tenantDisplayName: "Taylor Tenant",
        propertyDisplayLabel: "Harbour View",
        unitDisplayLabel: "Unit 2A",
      })
    );
  });

  it("denies cross-tenant conversation detail access", async () => {
    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-1",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-user-2",
          tenantId: "tenant-2",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ error: "Forbidden" }));
  });

  it("resolves tenant ownership from a lease when conversation tenantId is missing", async () => {
    ensureCollection("conversations").set("conv-lease-owned", {
      landlordId: "landlord-1",
      tenantId: null,
      tenantEmail: null,
      leaseId: "lease-owned",
      unitId: "unit-1",
    });
    ensureCollection("leases").set("lease-owned", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
    });
    ensureCollection("messages").set("message-lease-owned", {
      conversationId: "conv-lease-owned",
      senderRole: "landlord",
      body: "Lease-derived message",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-lease-owned",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-user-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation).toEqual(expect.objectContaining({ tenantId: "tenant-1" }));
    expect(res.body?.messages).toHaveLength(1);
  });

  it("resolves tenant ownership from tenant email when conversation tenantId is missing", async () => {
    ensureCollection("conversations").set("conv-email-owned", {
      landlordId: "landlord-1",
      tenantId: null,
      tenantEmail: "tenant@example.com",
      unitId: "unit-1",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-email-owned",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-user-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        tenantDisplayName: "Taylor Tenant",
      })
    );
  });

  it("uses a safe tenant label when tenant lookup fails for an owned conversation", async () => {
    ensureCollection("conversations").set("conv-missing-tenant", {
      landlordId: "landlord-1",
      tenantId: "tenant-missing",
      tenantEmail: null,
      unitId: "unit-1",
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-missing-tenant",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-missing",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation?.tenantDisplayName).toBe("Unknown Tenant");
    expect(res.body?.conversation?.tenantDisplayName).not.toBe("tenant-missing");
  });

  it("clamps inconsistent tenant read state in normalized conversation output", async () => {
    ensureCollection("conversations").set("conv-read-state", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      lastMessageAt: 1000,
      lastReadAtTenant: 2000,
      lastReadAtLandlord: 3000,
    });

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-read-state",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-user-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation?.lastReadAtTenant).toBe(1000);
    expect(res.body?.conversation?.lastReadAtLandlord).toBe(1000);
  });

  it("caps lease lookup candidates during tenant ownership recovery", async () => {
    ensureCollection("conversations").set("conv-capped-leases", {
      landlordId: "landlord-1",
      tenantId: null,
      unitId: "unit-1",
    });
    for (let i = 0; i < 12; i += 1) {
      ensureCollection("leases").set(`lease-candidate-${i}`, {
        landlordId: "landlord-1",
        tenantId: i === 0 ? "tenant-1" : `tenant-${i + 10}`,
        propertyId: "prop-1",
        unitId: "unit-1",
        status: "active",
      });
    }

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-capped-leases",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-user-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(queryLimits.filter((query) => query.collection === "leases").every((query) => query.count <= 10)).toBe(true);
  });

  it("returns an owned conversation when tenant lookup throws", async () => {
    ensureCollection("conversations").set("conv-tenant-lookup-error", {
      landlordId: "landlord-1",
      tenantId: "tenant-error",
      tenantEmail: "tenant.error@example.com",
      unitId: "unit-1",
    });
    failingDocGets.add("tenants/tenant-error");

    const router = await createRouter();
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/tenant/messages/conversation/conv-tenant-lookup-error",
      headers: {
        "x-test-user": JSON.stringify({
          id: "tenant-error",
          landlordId: "landlord-1",
          role: "tenant",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.conversation?.tenantDisplayName).toBe("tenant.error@example.com");
  });
});
