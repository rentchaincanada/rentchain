import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePr1516BrowserQaBootstrap } from "../../server/pr1516BrowserQaBootstrap";

function response() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("PR #1516 bootstrap server gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns fixed configuration only for the exact Preview branch", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "feat/multi-property-notices-v1");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
    const res = response();
    handlePr1516BrowserQaBootstrap({ method: "GET" }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ selector: "pr1516-landlord", commitSha: "a".repeat(40) }));
  });

  it.each([
    ["production", "feat/multi-property-notices-v1", "a".repeat(40)],
    ["preview", "main", "a".repeat(40)],
    ["preview", "feat/multi-property-notices-v1", "bad"],
  ])("fails closed outside its runtime contract", (vercelEnv, branch, commit) => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", branch);
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", commit);
    const res = response();
    handlePr1516BrowserQaBootstrap({ method: "GET" }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects mutation methods", () => {
    const res = response();
    handlePr1516BrowserQaBootstrap({ method: "POST" }, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
