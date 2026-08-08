import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuth } from "../requireAuth";
import { requireLandlord } from "../requireLandlord";
import { PREVIEW_QA_IDENTITY_ALIAS, previewQaAuth } from "../previewQaAuth";

vi.mock("../../services/sessionUserService", () => ({
  buildCanonicalSessionUserFromClaims: async (claims: any) => ({
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    landlordId: claims.landlordId,
    plan: "starter",
    capabilities: ["messaging"],
    entitlements: {
      userId: claims.sub,
      role: claims.role,
      plan: "starter",
      capabilities: ["messaging"],
      landlordId: claims.landlordId,
    },
  }),
}));

const originalEnv = process.env;

function enabledQaEnv() {
  process.env = {
    ...originalEnv,
    PREVIEW_QA_AUTH_ENABLED: "true",
    PREVIEW_QA_AUTH_SCOPE: "pr1509-unified-inbox",
    APP_ENV: "preview",
    GOOGLE_CLOUD_PROJECT: "rentchain-preview",
    K_SERVICE: "rentchain-pr1509-inbox-qa-4605bba7",
    PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1509-inbox-qa-4605bba7",
    FIRESTORE_ENABLED: "true",
    FIRESTORE_DATABASE_ID: "(default)",
  };
  delete process.env.JWT_SECRET;
}

async function invoke(options: {
  method?: string;
  selector?: string;
  authorization?: string;
  useQaMiddleware?: boolean;
  route?: "landlord-inbox" | "landlord-message-list" | "landlord-message-detail";
}) {
  const headers: Record<string, string> = {};
  if (options.selector) headers["x-rentchain-preview-qa-identity"] = options.selector;
  if (options.authorization) headers.authorization = options.authorization;
  const req: any = {
    method: options.method || "GET",
    headers,
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };

  return await new Promise<{ status: number; body: any; req: any }>((resolve, reject) => {
    let status = 200;
    const res: any = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        resolve({ status, body, req });
        return this;
      },
    };
    const finish = () => res.json({ ok: true, user: req.user });
    const authorize = () => Promise.resolve(requireLandlord(req, res, finish)).catch(reject);
    if (options.useQaMiddleware) {
      previewQaAuth(options.route || "landlord-inbox")(req, res, authorize);
    } else {
      Promise.resolve(requireAuth(req, res, authorize)).catch(reject);
    }
  });
}

describe("Preview QA auth route scope", () => {
  beforeEach(enabledQaEnv);
  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    "landlord-inbox",
    "landlord-message-list",
    "landlord-message-detail",
  ] as const)("establishes only the fixed synthetic landlord on %s", async (route) => {
    const result = await invoke({
      selector: PREVIEW_QA_IDENTITY_ALIAS,
      useQaMiddleware: true,
      route,
    });
    expect(result.status).toBe(200);
    expect(result.body.user).toMatchObject({
      id: "qa-pr1509-landlord",
      landlordId: "qa-pr1509-landlord",
      role: "landlord",
    });
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects %s even if QA middleware is misapplied", async (method) => {
    const result = await invoke({
      method,
      selector: PREVIEW_QA_IDENTITY_ALIAS,
      useQaMiddleware: true,
    });
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("does not enable a representative write route that lacks the QA middleware", async () => {
    const result = await invoke({ method: "POST", selector: PREVIEW_QA_IDENTITY_ALIAS });
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("does not reinterpret an invalid bearer token as the synthetic identity", async () => {
    const result = await invoke({
      selector: PREVIEW_QA_IDENTITY_ALIAS,
      authorization: "Bearer invalid-token",
      useQaMiddleware: true,
    });
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("keeps missing JWT_SECRET fail-closed when QA auth is disabled", async () => {
    process.env.PREVIEW_QA_AUTH_ENABLED = "false";
    const result = await invoke({ selector: PREVIEW_QA_IDENTITY_ALIAS, useQaMiddleware: true });
    expect(result.status).toBe(401);
  });

  it("preserves the normal valid bearer path when no QA selector is present", async () => {
    process.env.JWT_SECRET = "preview-qa-auth-test-only";
    const token = jwt.sign({
      sub: "normal-landlord",
      email: "normal-landlord@example.invalid",
      role: "landlord",
      landlordId: "normal-landlord",
      ver: 1,
    }, process.env.JWT_SECRET);
    const result = await invoke({ authorization: `Bearer ${token}` });
    expect(result.status).toBe(200);
    expect(result.body.user).toMatchObject({
      id: "normal-landlord",
      landlordId: "normal-landlord",
      role: "landlord",
    });
  });

  it("wires QA auth only to the three approved GET operations, including preempting public routes", () => {
    const inboxSource = readFileSync(new URL("../../routes/landlordInboxRoutes.ts", import.meta.url), "utf8");
    const messagesSource = readFileSync(new URL("../../routes/messagesRoutes.ts", import.meta.url), "utf8");
    const publicSource = readFileSync(new URL("../../routes/publicRoutes.ts", import.meta.url), "utf8");
    expect(inboxSource).toContain('router.get("/inbox", previewQaAuth("landlord-inbox")');
    expect(inboxSource).not.toMatch(/router\.post\([^\n]+previewQaAuth/);
    expect(messagesSource).toContain(
      'router.get("/landlord/messages/conversations", previewQaAuth("landlord-message-list")'
    );
    expect(messagesSource).toContain(
      'router.get("/landlord/messages/conversations/:id", previewQaAuth("landlord-message-detail")'
    );
    expect(messagesSource).not.toMatch(/router\.post\([^\n]+previewQaAuth/);
    expect(publicSource).toMatch(
      /router\.get\(\s*"\/landlord\/messages\/conversations",\s*previewQaAuth\("landlord-message-list"\)/
    );
    expect(publicSource).toMatch(
      /router\.get\(\s*"\/landlord\/messages\/conversations\/:id",\s*previewQaAuth\("landlord-message-detail"\)/
    );
    expect(publicSource).not.toMatch(/router\.post\([\s\S]{0,160}?previewQaAuth/);
  });
});
