import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlePreviewBackendProxy,
  PREVIEW_PROXY_AUTH_CONFIG,
  PREVIEW_PROXY_BODY_LIMIT_BYTES,
  PREVIEW_PROXY_CONFIG,
  PREVIEW_BACKEND_TARGET_KEYS,
  resolvePreviewBackendTarget,
  assertPreviewBackendTarget,
  resolvePreviewBackendPath,
} from "../../server/previewBackendProxy";

function token(payload = "payload") {
  return `header.${payload}.signature`;
}

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function responseRecorder() {
  const headers = new Map<string, string | string[]>();
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers,
    setHeader: vi.fn((name: string, value: string | string[]) => {
      headers.set(name.toLowerCase(), value);
    }),
    status: vi.fn(function status(this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function json(this: any, body: unknown) {
      this.body = body;
      return this;
    }),
    send: vi.fn(function send(this: any, body: unknown) {
      this.body = body;
      return this;
    }),
  };
}

function request(
  url: string,
  method: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    url,
    method,
    headers: {},
    query: { path: url.split("?")[0].split("/").slice(3) },
    ...overrides,
  };
}

function successfulDependencies(upstreamStatus = 200) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === "https://sts.googleapis.com/v1/token") {
      return jsonResponse({
        access_token: "federated-access-token",
        token_type: "Bearer",
        expires_in: 3600,
      });
    }
    if (url.startsWith("https://iamcredentials.googleapis.com/")) {
      return jsonResponse({ token: token("google-id-token") });
    }
    return jsonResponse(
      { ok: upstreamStatus < 400, error: upstreamStatus === 401 ? "UNAUTHORIZED" : undefined },
      upstreamStatus,
      { "x-request-id": "request-1" },
    );
  });
  return {
    requests,
    dependencies: {
      fetchImpl: fetchImpl as typeof fetch,
      getVercelOidcToken: vi.fn(async () => token("vercel-oidc")),
    },
  };
}

describe("Preview backend proxy", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalPreviewBackendTarget = process.env.PREVIEW_BACKEND_TARGET;
  const originalPreviewBackendUrl = process.env.PREVIEW_BACKEND_URL;

  beforeEach(() => {
    process.env.VERCEL_ENV = "preview";
    delete process.env.PREVIEW_BACKEND_TARGET;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalVercelEnv == null) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalPreviewBackendTarget == null) delete process.env.PREVIEW_BACKEND_TARGET;
    else process.env.PREVIEW_BACKEND_TARGET = originalPreviewBackendTarget;
    if (originalPreviewBackendUrl == null) delete process.env.PREVIEW_BACKEND_URL;
    else process.env.PREVIEW_BACKEND_URL = originalPreviewBackendUrl;
  });

  it("keeps the permanent Preview backend as the default target", () => {
    expect(resolvePreviewBackendTarget({ vercelEnvironment: "preview", targetKey: undefined })).toEqual({
      key: "permanent",
      cloudRunServiceUrl: PREVIEW_PROXY_CONFIG.cloudRunServiceUrl,
      cloudRunIdTokenAudience: PREVIEW_PROXY_CONFIG.cloudRunServiceUrl,
      temporary: false,
    });
  });

  it("couples the authorized PR #1555 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1555,
    });
    expect(target).toEqual({
      key: "pr1555-c99145e5",
      cloudRunServiceUrl: "https://rentchain-pr1555-qa-c99145e5-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience: "https://rentchain-pr1555-qa-c99145e5-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1561 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1561,
    });
    expect(target).toEqual({
      key: "pr1561-d3-cert",
      cloudRunServiceUrl: "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience: "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1565 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1565,
    });
    expect(target).toEqual({
      key: "pr1565-tenant-lease-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1566 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
    });
    expect(target).toEqual({
      key: "pr1566-multiple-current-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1567 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1567,
    });
    expect(target).toEqual({
      key: "pr1567-review-needed-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1567-qa-reviewneeded-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1567-qa-reviewneeded-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1568 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1568,
    });
    expect(target).toEqual({
      key: "pr1568-renewal-continuity-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1569 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1569,
    });
    expect(target).toEqual({
      key: "pr1569-onboarding-occupancy-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1570 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1570,
    });
    expect(target).toEqual({
      key: "pr1570-occupancy-start-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1570-qa-occupancy-start-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1570-qa-occupancy-start-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1573 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1573,
    });
    expect(target).toEqual({
      key: "pr1573-tenant-lifecycle-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1576 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1576,
    });
    expect(target).toEqual({
      key: "pr1576-context-mismatch-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1576-qa-context-mismatch-501298948635.northamerica-northeast1.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1576-qa-context-mismatch-501298948635.northamerica-northeast1.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1578 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1578,
    });
    expect(target).toEqual({
      key: "pr1578-writer-guards-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1578-qa-writer-guards-501298948635.northamerica-northeast1.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1578-qa-writer-guards-501298948635.northamerica-northeast1.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1580 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1580,
    });
    expect(target).toEqual({
      key: "pr1580-tenant-status-reconcile-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1580-qa-tenant-status-reconcile-501298948635.northamerica-northeast1.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1580-qa-tenant-status-reconcile-501298948635.northamerica-northeast1.run.app",
      temporary: true,
    });
  });

  it("couples the authorized PR #1582 service URL and audience internally", () => {
    const target = resolvePreviewBackendTarget({
      vercelEnvironment: "preview",
      targetKey: PREVIEW_BACKEND_TARGET_KEYS.pr1582,
    });
    expect(target).toEqual({
      key: "pr1582-occupied-without-lease-containment-cert",
      cloudRunServiceUrl:
        "https://rentchain-pr1582-qa-occupied-without-lease-containment-501298948635.northamerica-northeast1.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1582-qa-occupied-without-lease-containment-501298948635.northamerica-northeast1.run.app",
      temporary: true,
    });
  });

  it.each([
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1555],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1555],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1561],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1561],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1565],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1565],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1566],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1566],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1567],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1567],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1568],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1568],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1569],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1569],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1570],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1570],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1573],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1573],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1576],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1576],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1578],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1578],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1580],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1580],
    ["production", PREVIEW_BACKEND_TARGET_KEYS.pr1582],
    ["development", PREVIEW_BACKEND_TARGET_KEYS.pr1582],
    ["preview", ""],
    ["preview", "   "],
    ["preview", "unknown"],
    ["preview", "pr1562"],
    ["preview", "arbitrary"],
    ["preview", "https://attacker.example"],
    ["preview", "https://metadata.google.internal"],
    ["preview", "https://arbitrary.a.run.app"],
    ["preview", "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app"],
    ["preview", "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app"],
    ["preview", "rentchain-pr1555-qa-wrong-region"],
    ["preview", "rentchain-pr1555-qa-cross-project"],
    ["preview", "pr1568-renewal-continuity-cert-evil"],
    ["preview", "PR1568-RENEWAL-CONTINUITY-CERT"],
    ["preview", "rentchain-pr1568-qa-renewal"],
    ["preview", "*.run.app"],
    ["preview", "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app"],
    ["preview", "pr1569-onboarding-occupancy-cert-evil"],
    ["preview", "PR1569-ONBOARDING-OCCUPANCY-CERT"],
    ["preview", "rentchain-pr1569-qa-onboarding"],
    ["preview", "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app"],
  ])("rejects unsafe target selection for %s / %s", (vercelEnvironment, targetKey) => {
    expect(() => resolvePreviewBackendTarget({ vercelEnvironment, targetKey })).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["mismatched audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1555,
      cloudRunServiceUrl: "https://rentchain-pr1555-qa-c99145e5-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience: "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["Production Cloud Run host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1555,
      cloudRunServiceUrl: "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      cloudRunIdTokenAudience: "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      temporary: true,
    }],
    ["cross-project host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1555,
      cloudRunServiceUrl: "https://rentchain-pr1555-qa-c99145e5-other-project.a.run.app",
      cloudRunIdTokenAudience: "https://rentchain-pr1555-qa-c99145e5-other-project.a.run.app",
      temporary: true,
    }],
    ["wrong-region host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1555,
      cloudRunServiceUrl: "https://rentchain-pr1555-qa-c99145e5-uc.a.run.app",
      cloudRunIdTokenAudience: "https://rentchain-pr1555-qa-c99145e5-uc.a.run.app",
      temporary: true,
    }],
  ])("rejects a tampered trusted mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["service URL", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1561,
      cloudRunServiceUrl: "https://arbitrary.a.run.app",
      cloudRunIdTokenAudience: "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["ID-token audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1561,
      cloudRunServiceUrl: "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience: "https://arbitrary.a.run.app",
      temporary: true,
    }],
    ["temporary flag", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1561,
      cloudRunServiceUrl: "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience: "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app",
      temporary: false,
    }],
  ])("rejects a tampered PR #1561 mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["arbitrary host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1565,
      cloudRunServiceUrl: "https://arbitrary.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["cross-project host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1565,
      cloudRunServiceUrl:
        "https://rentchain-pr1565-qa-tenantlease-other-project.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1565-qa-tenantlease-other-project.a.run.app",
      temporary: true,
    }],
    ["wrong service slot", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1565,
      cloudRunServiceUrl:
        "https://rentchain-pr1565-qa-wrongslot-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1565-qa-wrongslot-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["Production Cloud Run host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1565,
      cloudRunServiceUrl:
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      temporary: true,
    }],
    ["mismatched audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1565,
      cloudRunServiceUrl:
        "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["temporary flag", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1565,
      cloudRunServiceUrl:
        "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app",
      temporary: false,
    }],
  ])("rejects a tampered PR #1565 mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["mismatched audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
      cloudRunServiceUrl:
        "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["arbitrary Cloud Run host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
      cloudRunServiceUrl: "https://arbitrary.a.run.app",
      cloudRunIdTokenAudience: "https://arbitrary.a.run.app",
      temporary: true,
    }],
    ["Production Cloud Run host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
      cloudRunServiceUrl:
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      temporary: true,
    }],
    ["cross-project host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
      cloudRunServiceUrl:
        "https://rentchain-pr1566-qa-multicurrent-other-project.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1566-qa-multicurrent-other-project.a.run.app",
      temporary: true,
    }],
    ["wrong service slot", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
      cloudRunServiceUrl:
        "https://rentchain-pr1566-qa-wrongslot-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1566-qa-wrongslot-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["wrong region", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
      cloudRunServiceUrl:
        "https://rentchain-pr1566-qa-multicurrent-glistw4pya-uc.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1566-qa-multicurrent-glistw4pya-uc.a.run.app",
      temporary: true,
    }],
    ["temporary flag", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1566,
      cloudRunServiceUrl:
        "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app",
      temporary: false,
    }],
  ])("rejects a tampered PR #1566 mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["mismatched audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1567,
      cloudRunServiceUrl:
        "https://rentchain-pr1567-qa-reviewneeded-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["wrong service slot", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1567,
      cloudRunServiceUrl:
        "https://rentchain-pr1567-qa-wrongslot-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1567-qa-wrongslot-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["wrong project", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1567,
      cloudRunServiceUrl:
        "https://rentchain-pr1567-qa-reviewneeded-other-project.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1567-qa-reviewneeded-other-project.a.run.app",
      temporary: true,
    }],
    ["wrong host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1567,
      cloudRunServiceUrl: "https://attacker.example",
      cloudRunIdTokenAudience: "https://attacker.example",
      temporary: true,
    }],
    ["Production Cloud Run host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1567,
      cloudRunServiceUrl:
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      temporary: true,
    }],
    ["temporary flag", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1567,
      cloudRunServiceUrl:
        "https://rentchain-pr1567-qa-reviewneeded-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1567-qa-reviewneeded-glistw4pya-nn.a.run.app",
      temporary: false,
    }],
  ])("rejects a tampered PR #1567 mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["mismatched audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1568,
      cloudRunServiceUrl:
        "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["attacker host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1568,
      cloudRunServiceUrl: "https://attacker.example",
      cloudRunIdTokenAudience: "https://attacker.example",
      temporary: true,
    }],
    ["temporary flag", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1568,
      cloudRunServiceUrl:
        "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app",
      temporary: false,
    }],
  ])("rejects a tampered PR #1568 mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["mismatched audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1569,
      cloudRunServiceUrl:
        "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["attacker host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1569,
      cloudRunServiceUrl: "https://attacker.example",
      cloudRunIdTokenAudience: "https://attacker.example",
      temporary: true,
    }],
    ["temporary flag", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1569,
      cloudRunServiceUrl:
        "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app",
      temporary: false,
    }],
  ])("rejects a tampered PR #1569 mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["mismatched audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1570,
      cloudRunServiceUrl:
        "https://rentchain-pr1570-qa-occupancy-start-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["attacker host", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1570,
      cloudRunServiceUrl: "https://attacker.example",
      cloudRunIdTokenAudience: "https://attacker.example",
      temporary: true,
    }],
    ["temporary flag", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1570,
      cloudRunServiceUrl:
        "https://rentchain-pr1570-qa-occupancy-start-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1570-qa-occupancy-start-glistw4pya-nn.a.run.app",
      temporary: false,
    }],
  ])("rejects a tampered PR #1570 mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it.each([
    ["altered URL", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1573,
      cloudRunServiceUrl: "https://attacker.example",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["altered audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1573,
      cloudRunServiceUrl:
        "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience: "https://attacker.example",
      temporary: true,
    }],
    ["mismatched URL and audience", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1573,
      cloudRunServiceUrl:
        "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
      temporary: true,
    }],
    ["temporary flag", {
      key: PREVIEW_BACKEND_TARGET_KEYS.pr1573,
      cloudRunServiceUrl:
        "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
      cloudRunIdTokenAudience:
        "https://rentchain-pr1573-qa-tenant-lifecycle-glistw4pya-nn.a.run.app",
      temporary: false,
    }],
  ])("rejects a tampered PR #1573 mapping: %s", (_label, target) => {
    expect(() => assertPreviewBackendTarget(target, "preview")).toThrow(
      "PREVIEW_PROXY_TARGET_REJECTED",
    );
  });

  it("routes the authorized target using the same URL for ID-token audience and upstream", async () => {
    process.env.PREVIEW_BACKEND_TARGET = PREVIEW_BACKEND_TARGET_KEYS.pr1555;
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/me", "GET", {
        headers: {
          "x-preview-backend-target": "https://attacker.invalid",
          cookie: "PREVIEW_BACKEND_TARGET=https://attacker.invalid",
        },
        query: { target: "https://attacker.invalid" },
        body: { target: "https://attacker.invalid" },
      }),
      res,
      dependencies,
    );

    const expected = "https://rentchain-pr1555-qa-c99145e5-glistw4pya-nn.a.run.app";
    expect(requests[1].init?.body).toBe(JSON.stringify({ audience: expected, includeEmail: false }));
    expect(requests[2].url).toBe(`${expected}/api/me`);
    expect(requests.every(({ url }) => !url.includes("attacker.invalid"))).toBe(true);
  });

  it("routes the PR #1561 target only to its exact registered backend", async () => {
    process.env.PREVIEW_BACKEND_TARGET = PREVIEW_BACKEND_TARGET_KEYS.pr1561;
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/leases", "POST", {
        headers: {
          authorization: "Bearer application-session-token",
          "content-type": "application/json",
          "idempotency-key": "pr1561-target-key",
        },
        body: { synthetic: true },
      }),
      res,
      dependencies,
    );

    const expected = "https://rentchain-pr1561-qa-6256460c-glistw4pya-nn.a.run.app";
    expect(requests[1].init?.body).toBe(JSON.stringify({ audience: expected, includeEmail: false }));
    expect(requests[2].url).toBe(`${expected}/api/leases`);
    expect(requests[2].init?.headers).toMatchObject({
      authorization: "Bearer application-session-token",
      "idempotency-key": "pr1561-target-key",
      "X-Serverless-Authorization": `Bearer ${token("google-id-token")}`,
    });
  });

  it("routes the PR #1565 tenant lease read only to its exact registered backend", async () => {
    process.env.PREVIEW_BACKEND_TARGET = PREVIEW_BACKEND_TARGET_KEYS.pr1565;
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request(
        "/api/preview-backend/api/leases/tenant/synthetic-tenant",
        "GET",
      ),
      res,
      dependencies,
    );

    const expected =
      "https://rentchain-pr1565-qa-tenantlease-glistw4pya-nn.a.run.app";
    expect(requests[1].init?.body).toBe(
      JSON.stringify({ audience: expected, includeEmail: false }),
    );
    expect(requests[2].url).toBe(
      `${expected}/api/leases/tenant/synthetic-tenant`,
    );
    expect(requests[2].init?.method).toBe("GET");
  });

  it("routes the PR #1566 occupancy resolution context only to its exact registered backend", async () => {
    process.env.PREVIEW_BACKEND_TARGET = PREVIEW_BACKEND_TARGET_KEYS.pr1566;
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request(
        "/api/preview-backend/api/occupancy-resolutions/context?propertyId=synthetic-property&unitId=synthetic-unit",
        "GET",
      ),
      res,
      dependencies,
    );

    const expected =
      "https://rentchain-pr1566-qa-multicurrent-glistw4pya-nn.a.run.app";
    expect(requests[1].init?.body).toBe(
      JSON.stringify({ audience: expected, includeEmail: false }),
    );
    expect(requests[2].url).toBe(
      `${expected}/api/occupancy-resolutions/context?propertyId=synthetic-property&unitId=synthetic-unit`,
    );
    expect(requests[2].init?.method).toBe("GET");
  });

  it("routes the PR #1567 review workspace read only to its exact registered backend", async () => {
    process.env.PREVIEW_BACKEND_TARGET = PREVIEW_BACKEND_TARGET_KEYS.pr1567;
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/occupancy-reviews", "GET"),
      res,
      dependencies,
    );

    const expected =
      "https://rentchain-pr1567-qa-reviewneeded-glistw4pya-nn.a.run.app";
    expect(requests[1].init?.body).toBe(
      JSON.stringify({ audience: expected, includeEmail: false }),
    );
    expect(requests[2].url).toBe(`${expected}/api/occupancy-reviews`);
    expect(requests[2].init?.method).toBe("GET");
  });

  it("routes PR #1568 only to its fixed backend despite caller-controlled target-like input", async () => {
    process.env.PREVIEW_BACKEND_TARGET = PREVIEW_BACKEND_TARGET_KEYS.pr1568;
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/leases/renewal-continuity/context?target=https://attacker.example", "POST", {
        headers: {
          host: "attacker.example",
          cookie: "PREVIEW_BACKEND_TARGET=https://attacker.example",
          "x-preview-backend-target": "https://attacker.example",
        },
        query: { target: "https://attacker.example" },
        body: { target: "https://attacker.example" },
      }),
      res,
      dependencies,
    );

    const expected =
      "https://rentchain-pr1568-qa-renewal-glistw4pya-nn.a.run.app";
    expect(requests[1].init?.body).toBe(
      JSON.stringify({ audience: expected, includeEmail: false }),
    );
    expect(requests[2].url).toBe(
      `${expected}/api/leases/renewal-continuity/context?target=https://attacker.example`,
    );
    expect(requests.every(({ url }) => !url.startsWith("https://attacker.example"))).toBe(true);
  });

  it("routes PR #1569 only to its fixed backend despite caller-controlled target-like input", async () => {
    process.env.PREVIEW_BACKEND_TARGET = PREVIEW_BACKEND_TARGET_KEYS.pr1569;
    process.env.PREVIEW_BACKEND_URL = "https://attacker.example";
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/leases/tenant/synthetic-tenant?target=https://attacker.example", "GET", {
        headers: {
          host: "attacker.example",
          cookie: "PREVIEW_BACKEND_TARGET=https://attacker.example",
          "x-preview-backend-target": "https://attacker.example",
        },
        query: { target: "https://attacker.example" },
        body: { target: "https://attacker.example" },
      }),
      res,
      dependencies,
    );

    const expected =
      "https://rentchain-pr1569-qa-onboarding-glistw4pya-nn.a.run.app";
    expect(requests[1].init?.body).toBe(
      JSON.stringify({ audience: expected, includeEmail: false }),
    );
    expect(requests[2].url).toBe(
      `${expected}/api/leases/tenant/synthetic-tenant?target=https://attacker.example`,
    );
    expect(requests[2].init?.method).toBe("GET");
    expect(requests.every(({ url }) => !url.startsWith("https://attacker.example"))).toBe(true);
  });

  it("routes PR #1570 only to its fixed backend despite caller-controlled target-like input", async () => {
    process.env.PREVIEW_BACKEND_TARGET = PREVIEW_BACKEND_TARGET_KEYS.pr1570;
    process.env.PREVIEW_BACKEND_URL = "https://attacker.example";
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/leases/synthetic-lease/start-occupancy?target=https://attacker.example", "POST", {
        headers: {
          host: "attacker.example",
          cookie: "PREVIEW_BACKEND_TARGET=https://attacker.example",
          "x-preview-backend-target": "https://attacker.example",
          "idempotency-key": "pr1570-target-key",
        },
        query: { target: "https://attacker.example" },
        body: { target: "https://attacker.example", possessionConfirmed: true },
      }),
      res,
      dependencies,
    );

    const expected =
      "https://rentchain-pr1570-qa-occupancy-start-glistw4pya-nn.a.run.app";
    expect(requests[1].init?.body).toBe(
      JSON.stringify({ audience: expected, includeEmail: false }),
    );
    expect(requests[2].url).toBe(
      `${expected}/api/leases/synthetic-lease/start-occupancy?target=https://attacker.example`,
    );
    expect(requests[2].init?.method).toBe("POST");
    expect(requests[2].init?.headers).toMatchObject({
      "idempotency-key": "pr1570-target-key",
      "X-Serverless-Authorization": `Bearer ${token("google-id-token")}`,
    });
    expect(requests.every(({ url }) => !url.startsWith("https://attacker.example"))).toBe(true);
  });

  it("accepts only Preview and rejects Production or Development", async () => {
    for (const environment of ["production", "development"]) {
      process.env.VERCEL_ENV = environment;
      const res = responseRecorder();
      await handlePreviewBackendProxy(
        request("/api/preview-backend/api/auth/login", "POST"),
        res,
        successfulDependencies().dependencies,
      );
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({
        ok: false,
        error: "PREVIEW_PROXY_ENVIRONMENT_REJECTED",
      });
    }

    process.env.VERCEL_ENV = "preview";
    const { dependencies } = successfulDependencies();
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST"),
      res,
      dependencies,
    );
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ["/api/preview-backend/api/auth/login", "POST", "/api/auth/login"],
    ["/api/preview-backend/api/auth/logout", "POST", "/api/auth/logout"],
    ["/api/preview-backend/api/me", "GET", "/api/me"],
    ["/api/preview-backend/api/auth/me", "GET", "/api/auth/me"],
  ])("allows exact auth route %s", (url, method, expected) => {
    expect(resolvePreviewBackendPath(request(url, method))).toEqual({
      backendPath: expected,
      query: "",
    });
  });

  it.each([
    "/api/preview-backend/api/preview-backend/api/auth/login",
    "/api/preview-backend//api/auth/login",
    "/api/preview-backend/https://example.invalid",
    "/api/preview-backend/%2F%2Fevil.invalid",
    "/api/preview-backend/api/auth/%",
  ])("rejects unknown or malformed path %s", (url) => {
    expect(() => resolvePreviewBackendPath(request(url, "GET"))).toThrow(
      "PREVIEW_PROXY_ROUTE_NOT_ALLOWED",
    );
  });

  it.each([
    ["/api/preview-backend/api/properties", "/api/properties"],
    ["/api/preview-backend/api/tenant/identity-documents/status", "/api/tenant/identity-documents/status"],
    ["/api/preview-backend/api/landlord/maintenance/request-1/attachments", "/api/landlord/maintenance/request-1/attachments"],
    ["/api/preview-backend/api/admin/users", "/api/admin/users"],
  ])("forwards normalized fixed-backend application path %s", (url, backendPath) => {
    expect(resolvePreviewBackendPath(request(url, "GET"))).toEqual({ backendPath, query: "" });
  });

  it.each([
    "/api/preview-backend/../api/auth/login",
    "/api/preview-backend/%2e%2e/api/auth/login",
    "/api/preview-backend/api/auth/%2e%2e/login",
    "/api/preview-backend/api%2fauth%2flogin",
    "/api/preview-backend/api%5cauth%5clogin",
  ])("rejects traversal path %s", (url) => {
    expect(() => resolvePreviewBackendPath(request(url, "POST"))).toThrow(
      "PREVIEW_PROXY_ROUTE_NOT_ALLOWED",
    );
  });

  it("rejects unsupported methods", async () => {
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "CONNECT"),
      res,
      successfulDependencies().dependencies,
    );
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({
      ok: false,
      error: "PREVIEW_PROXY_METHOD_NOT_ALLOWED",
    });
    expect(res.headers.get("allow")).toBe("GET, HEAD, POST, PUT, PATCH, DELETE");
  });

  it("streams an unparsed multipart upload without exposing Google credentials", async () => {
    const boundary = "rentchain-preview-upload";
    const uploadBody = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="id.png"\r\nContent-Type: image/png\r\n\r\nsynthetic-image\r\n--${boundary}--\r\n`,
    );
    const req = Readable.from([uploadBody]) as any;
    Object.assign(req, request("/api/preview-backend/api/tenant/identity-documents", "POST", {
      headers: {
        authorization: "Bearer synthetic-tenant-session",
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(uploadBody.byteLength),
      },
      body: undefined,
    }));
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(req, res, dependencies);

    expect(res.statusCode).toBe(200);
    expect(requests[2].init?.body).toEqual(uploadBody);
    expect(requests[2].init?.headers).toMatchObject({
      authorization: "Bearer synthetic-tenant-session",
      "content-type": `multipart/form-data; boundary=${boundary}`,
    });
    expect(JSON.stringify(requests[2].init?.headers)).not.toContain("vercel-oidc");
  });

  it("uses exact identity constants and preserves application authorization separately", async () => {
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/me?source=smoke", "GET", {
        headers: {
          authorization: "Bearer application-session-token",
          "x-vercel-oidc-token": "must-not-forward",
          cookie: "session=must-not-forward",
          host: "preview.example.vercel.app",
        },
      }),
      res,
      dependencies,
    );

    expect(PREVIEW_PROXY_AUTH_CONFIG.vercelOidcTokenAudience).toBe(
      "https://iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/vercel-preview-proxy/providers/vercel-preview",
    );
    expect(PREVIEW_PROXY_AUTH_CONFIG.googleStsAudience).toBe(
      "//iam.googleapis.com/projects/501298948635/locations/global/workloadIdentityPools/vercel-preview-proxy/providers/vercel-preview",
    );
    expect(PREVIEW_PROXY_CONFIG.serviceAccountEmail).toBe(
      "vercel-preview-proxy@rentchain-preview.iam.gserviceaccount.com",
    );
    expect(PREVIEW_PROXY_AUTH_CONFIG.cloudRunIdTokenAudience).toBe(
      "https://rentchain-preview-backend-glistw4pya-nn.a.run.app",
    );
    expect(requests[1].url).toBe(
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/vercel-preview-proxy%40rentchain-preview.iam.gserviceaccount.com:generateIdToken",
    );
    expect(requests[1].init?.body).toBe(
      JSON.stringify({
        audience: PREVIEW_PROXY_CONFIG.cloudRunServiceUrl,
        includeEmail: false,
      }),
    );
    expect(requests[2].url).toBe(
      `${PREVIEW_PROXY_CONFIG.cloudRunServiceUrl}/api/me?source=smoke`,
    );
    expect(requests[2].init?.headers).toMatchObject({
      authorization: "Bearer application-session-token",
      "X-Serverless-Authorization": `Bearer ${token("google-id-token")}`,
    });
    expect(JSON.stringify(requests[2].init?.headers)).not.toContain("must-not-forward");
  });

  it.each([
    "d3-runtime-cert-key-123",
    "mutation_ABC-123.xyz",
  ])("forwards an opaque Idempotency-Key unchanged to the backend request: %s", async (idempotencyKey) => {
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/leases", "POST", {
        headers: {
          authorization: "Bearer application-session-token",
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "x-request-id": "trace-only-request-id",
        },
        body: { synthetic: true },
      }),
      res,
      dependencies,
    );

    expect(res.statusCode).toBe(200);
    expect(requests[2].url).toBe(`${PREVIEW_PROXY_CONFIG.cloudRunServiceUrl}/api/leases`);
    expect(requests[2].init?.headers).toMatchObject({
      authorization: "Bearer application-session-token",
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-request-id": "trace-only-request-id",
      "X-Serverless-Authorization": `Bearer ${token("google-id-token")}`,
    });
  });

  it("does not synthesize Idempotency-Key from x-request-id", async () => {
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/leases", "POST", {
        headers: {
          "content-type": "application/json",
          "x-request-id": "trace-only-request-id",
        },
        body: { synthetic: true },
      }),
      res,
      dependencies,
    );

    expect(requests[2].init?.headers).toMatchObject({
      "x-request-id": "trace-only-request-id",
    });
    expect(requests[2].init?.headers).not.toHaveProperty("idempotency-key");
  });

  it("fails closed instead of concatenating duplicate Idempotency-Key values", async () => {
    const { requests, dependencies } = successfulDependencies();
    const res = responseRecorder();

    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/leases", "POST", {
        headers: {
          "content-type": "application/json",
          "idempotency-key": ["first-key", "second-key"],
        },
        body: { synthetic: true },
      }),
      res,
      dependencies,
    );

    expect(requests[2].init?.headers).not.toHaveProperty("idempotency-key");
  });

  it("returns sanitized token-boundary errors", async () => {
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST"),
      res,
      {
        getVercelOidcToken: vi.fn(async () => token("secret-vercel-token")),
        fetchImpl: vi.fn(async () =>
          jsonResponse(
            {
              error: "invalid_target",
              error_description: "secret-vercel-token secret-google-token",
            },
            400,
          ),
        ) as typeof fetch,
      },
    );
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ ok: false, error: "GOOGLE_STS_EXCHANGE_FAILED" });
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("preserves upstream invalid-credential 401 responses", async () => {
    const { dependencies } = successfulDependencies(401);
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST", {
        headers: { "content-type": "application/json" },
        body: { email: "preview@example.invalid", password: "invalid" },
      }),
      res,
      dependencies,
    );
    expect(res.statusCode).toBe(401);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(JSON.parse((res.body as Buffer).toString("utf8"))).toMatchObject({
      error: "UNAUTHORIZED",
    });
  });

  it("returns a controlled timeout without retrying the upstream request", async () => {
    const { requests, dependencies } = successfulDependencies();
    const upstreamFetch = dependencies.fetchImpl;
    dependencies.fetchImpl = vi.fn(async (input, init) => {
      if (String(input).startsWith(PREVIEW_PROXY_CONFIG.cloudRunServiceUrl)) {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      }
      return upstreamFetch(input, init);
    }) as typeof fetch;

    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/me", "GET"),
      res,
      { ...dependencies, upstreamTimeoutMs: 5 },
    );
    expect(res.statusCode).toBe(504);
    expect(res.body).toEqual({ ok: false, error: "PREVIEW_BACKEND_TIMEOUT" });
    expect(
      requests.filter(({ url }) =>
        url.startsWith(PREVIEW_PROXY_CONFIG.cloudRunServiceUrl),
      ),
    ).toHaveLength(0);
  });

  it("enforces the auth request body limit before token acquisition", async () => {
    const getVercelOidcToken = vi.fn(async () => token("vercel"));
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST", {
        body: "x".repeat(PREVIEW_PROXY_BODY_LIMIT_BYTES + 1),
      }),
      res,
      { ...successfulDependencies().dependencies, getVercelOidcToken },
    );
    expect(res.statusCode).toBe(413);
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before token acquisition", async () => {
    const getVercelOidcToken = vi.fn(async () => token("vercel"));
    const res = responseRecorder();
    await handlePreviewBackendProxy(
      request("/api/preview-backend/api/auth/login", "POST", {
        headers: { "content-type": "application/json" },
        body: "{\"email\":",
      }),
      res,
      { ...successfulDependencies().dependencies, getVercelOidcToken },
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, error: "PREVIEW_PROXY_BODY_INVALID" });
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });

  it("keeps the production rewrite unchanged and relies on the dedicated filesystem Function", () => {
    const frontendRoot = path.resolve(process.cwd());
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(frontendRoot, "vercel.json"), "utf8"),
    );
    expect(
      vercelConfig.rewrites.find((rewrite: { source: string }) =>
        rewrite.source === "/api/:path*"),
    ).toEqual({
      source: "/api/:path*",
      destination:
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app/api/:path*",
    });
    expect(
      fs.existsSync(path.join(frontendRoot, "api/preview-backend/[...path].ts")),
    ).toBe(true);
  });

  it("forces ordinary Vercel Preview builds through the same-origin backend proxy", () => {
    const buildScript = fs.readFileSync(path.resolve(process.cwd(), "scripts/build.mjs"), "utf8");
    expect(buildScript).toContain('process.env.VERCEL_ENV === "preview"');
    expect(buildScript).toContain('env.VITE_DEPLOY_ENV = "preview"');
    expect(buildScript).toContain('env.VITE_API_BASE_URL = "/api/preview-backend"');
    expect(buildScript).toContain('env.VITE_API_BASE_URL = "/api/pr1512-notices"');
  });

  it("disables Vercel body parsing so binary uploads reach the proxy unchanged", () => {
    const entrypoint = fs.readFileSync(
      path.resolve(process.cwd(), "api/preview-backend/[...path].ts"),
      "utf8",
    );
    expect(entrypoint).toContain("bodyParser: false");
  });

  it("does not introduce the Preview Cloud Run URL into browser source", () => {
    const sourceRoot = path.resolve(process.cwd(), "src");
    const files = fs
      .readdirSync(sourceRoot, { recursive: true })
      .filter(
        (entry) =>
          /\.(ts|tsx|js|jsx)$/.test(String(entry)) &&
          !/(\.test\.|\.spec\.|__tests__)/.test(String(entry)),
      );
    const browserSource = files
      .map((entry) => fs.readFileSync(path.join(sourceRoot, String(entry)), "utf8"))
      .join("\n");
    expect(browserSource).not.toContain(PREVIEW_PROXY_CONFIG.cloudRunServiceUrl);
  });
});
