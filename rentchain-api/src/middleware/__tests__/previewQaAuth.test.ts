import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PREVIEW_QA_IDENTITY_ALIAS,
  PREVIEW_QA_LANDLORD_ID,
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
