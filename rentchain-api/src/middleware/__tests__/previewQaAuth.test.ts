import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PREVIEW_QA_IDENTITY_ALIAS,
  PREVIEW_QA_LANDLORD_ID,
  PR1510_PREVIEW_QA_IDENTITY_ALIAS,
  PR1510_PREVIEW_QA_LANDLORD_ID,
  PR1512_PREVIEW_QA_IDENTITY_ALIAS,
  PR1512_PREVIEW_QA_LANDLORD_ID,
  PR1512_PREVIEW_QA_SCOPE,
  PR1516_PREVIEW_QA_IDENTITY_ALIAS,
  PR1516_PREVIEW_QA_LANDLORD_ID,
  PR1516_PREVIEW_QA_SCOPE,
  decidePreviewQaAuth,
  isPreviewQaAuthenticatedRequest,
  previewQaAuth,
} from "../previewQaAuth";

const enabledEnv = {
  PREVIEW_QA_AUTH_ENABLED: "true",
  PREVIEW_QA_AUTH_SCOPE: "pr1509-unified-inbox",
  APP_ENV: "preview",
  GOOGLE_CLOUD_PROJECT: "rentchain-preview",
  K_SERVICE: "rentchain-pr1509-inbox-qa-4605bba7",
  PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1509-inbox-qa-4605bba7",
  FIRESTORE_ENABLED: "true",
  FIRESTORE_DATABASE_ID: "(default)",
} as NodeJS.ProcessEnv;

const pr1510EnabledEnv = {
  ...enabledEnv,
  PREVIEW_QA_AUTH_SCOPE: "pr1510-landlord-messaging",
  K_SERVICE: "rentchain-pr1510-messaging-qa-759205cd",
  PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1510-messaging-qa-759205cd",
} as NodeJS.ProcessEnv;

const pr1512EnabledEnv = {
  ...enabledEnv,
  PREVIEW_QA_AUTH_SCOPE: PR1512_PREVIEW_QA_SCOPE,
  K_SERVICE: "rentchain-pr1512-notices-qa-590e0ecb",
  PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1512-notices-qa-590e0ecb",
} as NodeJS.ProcessEnv;

const pr1516EnabledEnv = {
  ...enabledEnv,
  PREVIEW_QA_AUTH_SCOPE: PR1516_PREVIEW_QA_SCOPE,
  K_SERVICE: "rentchain-pr1516-notices-qa-252bf576",
  PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1516-notices-qa-252bf576",
} as NodeJS.ProcessEnv;

function decide(overrides: Partial<Parameters<typeof decidePreviewQaAuth>[0]> = {}) {
  return decidePreviewQaAuth({
    env: enabledEnv,
    method: "GET",
    route: "landlord-inbox",
    selector: PREVIEW_QA_IDENTITY_ALIAS,
    authorizationPresent: false,
    ...overrides,
  });
}

function invoke(options: {
  env?: NodeJS.ProcessEnv;
  method?: string;
  selector?: string;
  authorization?: string;
  headers?: Record<string, string>;
} = {}) {
  process.env = { ...options.env };
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (options.selector !== undefined) headers["x-rentchain-preview-qa-identity"] = options.selector;
  if (options.authorization !== undefined) headers.authorization = options.authorization;
  const req: any = {
    method: options.method || "GET",
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
  let status = 200;
  let body: unknown;
  let nextCalled = false;
  const res: any = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  };
  previewQaAuth("landlord-inbox")(req, res, () => {
    nextCalled = true;
  });
  return { req, status, body, nextCalled };
}

describe("previewQaAuth", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows only the fixed synthetic landlord under every isolated Preview QA guard", () => {
    const result = invoke({ env: enabledEnv, selector: PREVIEW_QA_IDENTITY_ALIAS });

    expect(result.nextCalled).toBe(true);
    expect(isPreviewQaAuthenticatedRequest(result.req)).toBe(true);
    expect(result.req.user).toMatchObject({
      id: PREVIEW_QA_LANDLORD_ID,
      landlordId: PREVIEW_QA_LANDLORD_ID,
      role: "landlord",
      plan: "starter",
      capabilities: ["messaging"],
    });
  });

  it.each([
    ["GET", "landlord-message-recipients"],
    ["GET", "landlord-message-list"],
    ["GET", "landlord-message-detail"],
    ["POST", "landlord-message-compose"],
  ] as const)("allows PR #1510 %s %s only under its fixed contract", (method, route) => {
    expect(decide({
      env: pr1510EnabledEnv,
      method,
      route,
      selector: PR1510_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "allow" });
  });

  it("injects only the server-owned PR #1510 landlord identity", () => {
    process.env = { ...pr1510EnabledEnv };
    const headers = {
      "x-rentchain-preview-qa-identity": PR1510_PREVIEW_QA_IDENTITY_ALIAS,
      "x-landlord-id": "arbitrary-landlord",
      "x-role": "admin",
    };
    const req: any = { method: "GET", headers, header: (name: string) => headers[name.toLowerCase() as keyof typeof headers] };
    const res: any = { status: () => res, json: () => res };
    let nextCalled = false;
    previewQaAuth("landlord-message-recipients")(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.user).toMatchObject({
      id: PR1510_PREVIEW_QA_LANDLORD_ID,
      landlordId: PR1510_PREVIEW_QA_LANDLORD_ID,
      role: "landlord",
    });
  });

  it.each([
    ["GET", "landlord-notice-recipients"],
    ["GET", "landlord-notice-list"],
    ["GET", "landlord-notice-detail"],
    ["POST", "landlord-notice-create"],
  ] as const)("allows PR #1512 %s %s only under its fixed contract", (method, route) => {
    expect(decide({
      env: pr1512EnabledEnv,
      method,
      route,
      selector: PR1512_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "allow" });
  });

  it("injects only the server-owned PR #1512 landlord identity", () => {
    process.env = { ...pr1512EnabledEnv };
    const headers = {
      "x-rentchain-preview-qa-identity": PR1512_PREVIEW_QA_IDENTITY_ALIAS,
      "x-landlord-id": "arbitrary-landlord",
      "x-role": "admin",
    };
    const req: any = { method: "GET", headers, header: (name: string) => headers[name.toLowerCase() as keyof typeof headers] };
    const res: any = { status: () => res, json: () => res };
    let nextCalled = false;
    previewQaAuth("landlord-notice-recipients")(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.user).toMatchObject({
      id: PR1512_PREVIEW_QA_LANDLORD_ID,
      landlordId: PR1512_PREVIEW_QA_LANDLORD_ID,
      role: "landlord",
    });
  });

  it.each([
    ["GET", "landlord-notice-recipients"],
    ["GET", "landlord-notice-list"],
    ["GET", "landlord-notice-detail"],
    ["POST", "landlord-notice-create"],
  ] as const)("allows PR #1516 %s %s only under its fixed contract", (method, route) => {
    expect(decide({
      env: pr1516EnabledEnv,
      method,
      route,
      selector: PR1516_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "allow" });
  });

  it("injects only the server-owned PR #1516 landlord identity", () => {
    process.env = { ...pr1516EnabledEnv };
    const headers = { "x-rentchain-preview-qa-identity": PR1516_PREVIEW_QA_IDENTITY_ALIAS };
    const req: any = { method: "GET", headers, header: (name: string) => headers[name.toLowerCase() as keyof typeof headers] };
    const res: any = { status: () => res, json: () => res };
    let nextCalled = false;
    previewQaAuth("landlord-notice-recipients")(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.user).toMatchObject({
      id: PR1516_PREVIEW_QA_LANDLORD_ID,
      landlordId: PR1516_PREVIEW_QA_LANDLORD_ID,
      role: "landlord",
    });
  });

  it.each([
    ["wrong service", { ...pr1516EnabledEnv, K_SERVICE: "rentchain-pr1516-notices-qa-deadbeef" }],
    ["Production", { ...pr1516EnabledEnv, GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99" }],
    ["permanent Preview", { ...pr1516EnabledEnv, K_SERVICE: "rentchain-preview-backend", PREVIEW_QA_EXPECTED_SERVICE: "rentchain-preview-backend" }],
    ["wrong scope", { ...pr1516EnabledEnv, PREVIEW_QA_AUTH_SCOPE: PR1512_PREVIEW_QA_SCOPE }],
  ])("rejects PR #1516 with %s", (_label, env) => {
    expect(decide({
      env,
      route: "landlord-notice-recipients",
      selector: PR1516_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "reject" });
  });

  it.each([
    ["wrong service", { ...pr1512EnabledEnv, K_SERVICE: "rentchain-pr1512-notices-qa-deadbeef" }],
    ["malformed service", { ...pr1512EnabledEnv, K_SERVICE: "rentchain-pr1512-notices-qa-head590e", PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1512-notices-qa-head590e" }],
    ["wrong scope", { ...pr1512EnabledEnv, PREVIEW_QA_AUTH_SCOPE: "pr1510-landlord-messaging" }],
    ["Production", { ...pr1512EnabledEnv, GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99" }],
    ["permanent Preview", { ...pr1512EnabledEnv, K_SERVICE: "rentchain-preview-backend", PREVIEW_QA_EXPECTED_SERVICE: "rentchain-preview-backend" }],
    ["disabled", { ...pr1512EnabledEnv, PREVIEW_QA_AUTH_ENABLED: "false" }],
  ])("rejects PR #1512 with %s", (_label, env) => {
    expect(decide({
      env,
      route: "landlord-notice-recipients",
      selector: PR1512_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "reject" });
  });

  it("rejects cross-contract PR #1510 and PR #1512 scope/selector combinations", () => {
    expect(decide({
      env: pr1510EnabledEnv,
      route: "landlord-notice-recipients",
      selector: PR1512_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "reject" });
    expect(decide({
      env: pr1512EnabledEnv,
      route: "landlord-message-recipients",
      selector: PR1510_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "reject" });
  });

  it.each([
    ["POST", "landlord-notice-recipients"],
    ["POST", "landlord-notice-list"],
    ["POST", "landlord-notice-detail"],
    ["GET", "landlord-notice-create"],
    ["PUT", "landlord-notice-create"],
    ["PATCH", "landlord-notice-create"],
    ["DELETE", "landlord-notice-create"],
  ] as const)("rejects non-allowlisted PR #1512 operation %s %s", (method, route) => {
    expect(decide({
      env: pr1512EnabledEnv,
      method,
      route,
      selector: PR1512_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "reject" });
  });

  it("rejects invalid bearer precedence for the PR #1512 write contract", () => {
    expect(decide({
      env: pr1512EnabledEnv,
      method: "POST",
      route: "landlord-notice-create",
      selector: PR1512_PREVIEW_QA_IDENTITY_ALIAS,
      authorizationPresent: true,
    })).toEqual({ kind: "continue-normal-auth" });
  });

  it.each([
    ["wrong service", { ...pr1510EnabledEnv, K_SERVICE: "rentchain-pr1510-messaging-qa-deadbeef" }],
    ["malformed service", { ...pr1510EnabledEnv, K_SERVICE: "rentchain-pr1510-messaging-qa-head7592", PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1510-messaging-qa-head7592" }],
    ["PR #1509 service", { ...pr1510EnabledEnv, K_SERVICE: enabledEnv.K_SERVICE, PREVIEW_QA_EXPECTED_SERVICE: enabledEnv.PREVIEW_QA_EXPECTED_SERVICE }],
    ["Production", { ...pr1510EnabledEnv, GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99" }],
    ["permanent Preview", { ...pr1510EnabledEnv, K_SERVICE: "rentchain-preview-backend", PREVIEW_QA_EXPECTED_SERVICE: "rentchain-preview-backend" }],
    ["disabled", { ...pr1510EnabledEnv, PREVIEW_QA_AUTH_ENABLED: "false" }],
  ])("rejects PR #1510 with %s", (_label, env) => {
    expect(decide({
      env,
      route: "landlord-message-recipients",
      selector: PR1510_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "reject" });
  });

  it("rejects cross-contract selectors and scopes", () => {
    expect(decide({ env: pr1510EnabledEnv, selector: PREVIEW_QA_IDENTITY_ALIAS })).toEqual({ kind: "reject" });
    expect(decide({
      env: enabledEnv,
      route: "landlord-message-list",
      selector: PR1510_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "reject" });
  });

  it.each([
    ["POST", "landlord-message-list"],
    ["POST", "landlord-message-detail"],
    ["POST", "landlord-inbox"],
    ["POST", "landlord-message-recipients"],
    ["PUT", "landlord-message-compose"],
    ["PATCH", "landlord-message-compose"],
    ["DELETE", "landlord-message-compose"],
  ] as const)("rejects non-allowlisted PR #1510 operation %s %s", (method, route) => {
    expect(decide({
      env: pr1510EnabledEnv,
      method,
      route,
      selector: PR1510_PREVIEW_QA_IDENTITY_ALIAS,
    })).toEqual({ kind: "reject" });
  });

  it.each([
    ["missing flag", { ...enabledEnv, PREVIEW_QA_AUTH_ENABLED: undefined }],
    ["false flag", { ...enabledEnv, PREVIEW_QA_AUTH_ENABLED: "false" }],
    ["malformed flag", { ...enabledEnv, PREVIEW_QA_AUTH_ENABLED: "yes" }],
    ["missing scope", { ...enabledEnv, PREVIEW_QA_AUTH_SCOPE: undefined }],
    ["wrong scope", { ...enabledEnv, PREVIEW_QA_AUTH_SCOPE: "other" }],
    ["missing project", { ...enabledEnv, GOOGLE_CLOUD_PROJECT: undefined }],
    ["wrong project", { ...enabledEnv, GOOGLE_CLOUD_PROJECT: "other-preview" }],
    ["Production project", { ...enabledEnv, GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99" }],
    ["unsupported environment", { ...enabledEnv, APP_ENV: "production" }],
    ["missing expected service", { ...enabledEnv, PREVIEW_QA_EXPECTED_SERVICE: undefined }],
    ["malformed expected service", { ...enabledEnv, PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1509-inbox-qa-head4605" }],
    ["uppercase suffix", { ...enabledEnv, PREVIEW_QA_EXPECTED_SERVICE: "rentchain-pr1509-inbox-qa-4605BBA7" }],
    ["arbitrary service", { ...enabledEnv, K_SERVICE: "rentchain-pr1509-other-qa-4605bba7" }],
    ["stale service", { ...enabledEnv, K_SERVICE: "rentchain-pr1509-inbox-qa-b82c9914" }],
    ["permanent Preview service", { ...enabledEnv, K_SERVICE: "rentchain-preview-backend" }],
    ["Firestore disabled", { ...enabledEnv, FIRESTORE_ENABLED: "false" }],
    ["wrong database", { ...enabledEnv, FIRESTORE_DATABASE_ID: "other" }],
  ])("rejects the selector with %s", (_label, env) => {
    expect(decide({ env })).toEqual({ kind: "reject" });
  });

  it.each([
    ["true", PREVIEW_QA_IDENTITY_ALIAS],
    ["false", PREVIEW_QA_IDENTITY_ALIAS],
    ["malformed", PREVIEW_QA_IDENTITY_ALIAS],
    ["true", "unknown"],
    ["false", "unknown"],
  ])("hard-locks Production with flag %s and selector %s", (flag, selector) => {
    expect(decide({
      env: {
        ...enabledEnv,
        PREVIEW_QA_AUTH_ENABLED: flag,
        GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99",
      },
      selector,
    })).toEqual({ kind: "reject" });
  });

  it.each(["", "unknown", "qa-pr1509-landlord", "pr1509-landlord ", "PR1509-LANDLORD"])(
    "rejects non-allowlisted or malformed selector %j",
    (selector) => {
      expect(decide({ selector })).toEqual(selector ? { kind: "reject" } : { kind: "continue-normal-auth" });
    }
  );

  it("never accepts write methods", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(decide({ method })).toEqual({ kind: "reject" });
    }
  });

  it("does not allow caller-supplied role or landlord headers to affect identity", () => {
    const result = invoke({
      env: enabledEnv,
      selector: PREVIEW_QA_IDENTITY_ALIAS,
      headers: { "x-landlord-id": "arbitrary", "x-role": "admin" },
    });
    expect(result.req.user.landlordId).toBe(PREVIEW_QA_LANDLORD_ID);
    expect(result.req.user.role).toBe("landlord");
  });

  it("preserves bearer-token precedence and never falls through to QA after JWT failure", () => {
    const result = invoke({
      env: enabledEnv,
      selector: PREVIEW_QA_IDENTITY_ALIAS,
      authorization: "Bearer invalid-token",
    });
    expect(result.nextCalled).toBe(true);
    expect(isPreviewQaAuthenticatedRequest(result.req)).toBe(false);
    expect(result.req.user).toBeUndefined();
  });

  it("ignores the mechanism entirely when no QA selector is supplied", () => {
    const result = invoke({ env: enabledEnv });
    expect(result.nextCalled).toBe(true);
    expect(isPreviewQaAuthenticatedRequest(result.req)).toBe(false);
  });
});
