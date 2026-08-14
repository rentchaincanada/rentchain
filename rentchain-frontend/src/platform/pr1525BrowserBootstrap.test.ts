import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyPr1525Bootstrap, handlePr1525BrowserBootstrap } from "../../server/pr1525BrowserBootstrap";

function response() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: new Map<string, string>(),
    setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); },
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
  };
}

const exactEnv = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feat/tenant-maintenance-image-attachments-v1",
  VERCEL_GIT_COMMIT_SHA: "3ba5580847746d53d8c81335e753806d61a3d5c1",
};

describe("PR #1525 browser bootstrap", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["tenant", "qa-pr1525-tenant"],
    ["landlord", "qa-pr1525-landlord"],
  ])("returns only the fixed %s session", (role, principalId) => {
    Object.entries(exactEnv).forEach(([key, value]) => vi.stubEnv(key, value));
    const res = response();
    handlePr1525BrowserBootstrap({ method: "GET", query: { role, userId: "arbitrary" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      scope: "pr1525-maintenance-attachments",
      deploymentSha: exactEnv.VERCEL_GIT_COMMIT_SHA,
      requestId: "qa-pr1525-target-request",
      session: { role, principalId, apiActor: role },
    });
    expect(JSON.stringify(res.body)).not.toContain("arbitrary");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["Production", { ...exactEnv, VERCEL_ENV: "production" }, "tenant"],
    ["main", { ...exactEnv, VERCEL_GIT_COMMIT_REF: "main" }, "tenant"],
    ["wrong branch", { ...exactEnv, VERCEL_GIT_COMMIT_REF: "feat/other" }, "tenant"],
    ["missing SHA", { ...exactEnv, VERCEL_GIT_COMMIT_SHA: "" }, "tenant"],
    ["unknown role", exactEnv, "admin"],
  ])("fails closed for %s", (_label, env, role) => {
    Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
    expect(classifyPr1525Bootstrap({ method: "GET", query: { role } })).toEqual({ allowed: false });
    const res = response();
    handlePr1525BrowserBootstrap({ method: "GET", query: { role } }, res);
    expect(res.statusCode).toBe(404);
  });

  it("rejects mutation methods", () => {
    Object.entries(exactEnv).forEach(([key, value]) => vi.stubEnv(key, value));
    expect(classifyPr1525Bootstrap({ method: "POST", query: { role: "tenant" } })).toEqual({ allowed: false });
  });
});
