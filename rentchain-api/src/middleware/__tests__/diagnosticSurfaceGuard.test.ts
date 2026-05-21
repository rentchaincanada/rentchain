import { describe, expect, it } from "vitest";
import {
  hasInternalDiagnosticAccess,
  isProductionDiagnosticRuntime,
  requireDiagnosticAccess,
  safeDiagnosticBuildMetadata,
} from "../diagnosticSurfaceGuard";

describe("diagnosticSurfaceGuard", () => {
  it("detects production runtime deterministically", () => {
    expect(isProductionDiagnosticRuntime({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isProductionDiagnosticRuntime({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isProductionDiagnosticRuntime({ NODE_ENV: "" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("requires the internal diagnostic token when one is configured", () => {
    const req: any = { headers: { "x-internal-job-token": "secret-token" } };

    expect(hasInternalDiagnosticAccess(req, { INTERNAL_JOB_TOKEN: "secret-token" } as NodeJS.ProcessEnv)).toBe(true);
    expect(hasInternalDiagnosticAccess(req, { INTERNAL_JOB_TOKEN: "other-token" } as NodeJS.ProcessEnv)).toBe(false);
    expect(hasInternalDiagnosticAccess(req, {} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("gates unsafe diagnostics in production without exposing internals", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalInternalToken = process.env.INTERNAL_JOB_TOKEN;
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_JOB_TOKEN = "secret-token";

    try {
      const denied = invokeGuard({});
      expect(denied.nextCalled).toBe(false);
      expect(denied.statusCode).toBe(404);
      expect(denied.headers["x-route-source"]).toBe("app.build.ts:/api/__debug/build");
      expect(denied.body).toEqual({ ok: false, code: "NOT_FOUND", error: "Not Found" });
      expect(JSON.stringify(denied.body)).not.toContain("visible");

      const allowed = invokeGuard({ "x-internal-job-token": "secret-token" });
      expect(allowed.nextCalled).toBe(true);
      expect(allowed.statusCode).toBe(200);
      expect(allowed.body).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalInternalToken == null) delete process.env.INTERNAL_JOB_TOKEN;
      else process.env.INTERNAL_JOB_TOKEN = originalInternalToken;
    }
  });

  it("redacts exact build identifiers into safe presence metadata", () => {
    const metadata = safeDiagnosticBuildMetadata({
      K_SERVICE: "rentchain-landlord-api",
      K_REVISION: "rentchain-landlord-api-00042-abc",
      GIT_SHA: "abc123secret",
    } as NodeJS.ProcessEnv);

    expect(metadata).toEqual({
      service: "rentchain-landlord-api",
      revisionPresent: true,
      commitPresent: true,
    });
    expect(JSON.stringify(metadata)).not.toContain("00042");
    expect(JSON.stringify(metadata)).not.toContain("abc123secret");
  });
});

function invokeGuard(headers: Record<string, string>) {
  const req: any = { headers };
  const result: {
    statusCode: number;
    headers: Record<string, unknown>;
    body?: unknown;
    nextCalled: boolean;
  } = {
    statusCode: 200,
    headers: {},
    nextCalled: false,
  };
  const res: any = {
    setHeader(name: string, value: unknown) {
      result.headers[String(name).toLowerCase()] = value;
    },
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      result.body = payload;
      return this;
    },
  };

  requireDiagnosticAccess("app.build.ts:/api/__debug/build")(req, res, () => {
    result.nextCalled = true;
  });
  return result;
}
