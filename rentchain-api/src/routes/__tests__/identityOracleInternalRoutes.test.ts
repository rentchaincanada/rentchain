import { beforeEach, describe, expect, it, vi } from "vitest";

const { runIdentityOracleMock } = vi.hoisted(() => ({
  runIdentityOracleMock: vi.fn(async (input: any) => ({
    run: {
      id: "run-1",
      propertyId: input.propertyId,
      namespaceKey: "ca-on:pin",
      normalizedIdentifier: "123456789",
      syntaxResult: { status: "valid", ok: true, reason: null, normalizedIdentifier: "123456789" },
    },
    profile: {
      propertyId: input.propertyId,
      latestRunId: "run-1",
      namespaceKey: "ca-on:pin",
      syntaxStatus: "valid",
      identifiers: {},
    },
  })),
}));

vi.mock("../../services/identityOracle/identityOracleService", () => ({
  runIdentityOracle: runIdentityOracleMock,
}));

async function invokeRouter(params: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const router = (await import("../identityOracleInternalRoutes")).default;

  return await new Promise<{ statusCode: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: params.method,
      url: params.url,
      headers: params.headers || {},
      body: params.body,
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
    };

    router.handle(req, res, (err: any) => {
      if (err) reject(err);
      else resolve({ statusCode: res.statusCode, body: res.payload });
    });
  });
}

describe("identityOracleInternalRoutes", () => {
  beforeEach(() => {
    process.env.INTERNAL_JOB_TOKEN = "secret-token";
    runIdentityOracleMock.mockClear();
  });

  it("rejects requests without the internal job token", async () => {
    const res = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      body: {},
    });

    expect(res.statusCode).toBe(401);
    expect(runIdentityOracleMock).not.toHaveBeenCalled();
  });

  it("runs the identity oracle through the protected internal route", async () => {
    const res = await invokeRouter({
      method: "POST",
      url: "/identity-oracle/run",
      headers: { "x-internal-job-token": "secret-token" },
      body: {
        propertyId: "prop-on-1",
        identifier: "12345-6789",
        identifierType: "pin",
        province: "ON",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.run?.propertyId).toBe("prop-on-1");
    expect(runIdentityOracleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: "prop-on-1",
        identifier: "12345-6789",
        identifierType: "pin",
        province: "ON",
      })
    );
  });
});
