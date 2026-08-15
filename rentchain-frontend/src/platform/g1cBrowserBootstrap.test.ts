import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyG1cBootstrap, handleG1cBrowserBootstrap } from "../../server/g1cBrowserBootstrap";

function response() {
  return { statusCode: 200, body: undefined as any, headers: new Map<string, string>(), setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); }, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; } };
}

const exactEnv = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/g1c-mandatory-tenant-government-id-workflow-v1", VERCEL_GIT_COMMIT_SHA: "a".repeat(40) };

describe("G1C browser bootstrap", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("returns only the fixed synthetic tenant session", () => {
    Object.entries(exactEnv).forEach(([key, value]) => vi.stubEnv(key, value));
    const res = response();
    handleG1cBrowserBootstrap({ method: "GET", query: { subjectId: "arbitrary" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ scope: "g1c-synthetic-identity-qa-v1", session: { role: "tenant", principalId: "qa-g1c-tenant" } });
    expect(JSON.stringify(res.body)).not.toContain("arbitrary");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it.each([
    ["Production", { ...exactEnv, VERCEL_ENV: "production" }],
    ["main", { ...exactEnv, VERCEL_GIT_COMMIT_REF: "main" }],
    ["missing SHA", { ...exactEnv, VERCEL_GIT_COMMIT_SHA: "" }],
  ])("fails closed for %s", (_label, env) => {
    Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
    expect(classifyG1cBootstrap({ method: "GET" })).toEqual({ allowed: false });
  });
});
