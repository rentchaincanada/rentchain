import { beforeEach, describe, expect, it } from "vitest";
import {
  PR1516_QA_SESSION_KEY,
  activatePr1516BrowserQaSession,
  clearPr1516BrowserQaSession,
  getPr1516QaBuildContract,
  isPr1516BrowserQaSessionActive,
  isValidPr1516BootstrapResponse,
  resolvePr1516BrowserQaUser,
} from "./pr1516BrowserQaBootstrap";

const sha = "a".repeat(40);
const env = {
  VITE_DEPLOY_ENV: "preview",
  VITE_PR1516_NOTICES_QA: "true",
  VITE_PR1516_QA_BRANCH: "feat/multi-property-notices-v1",
  VITE_PR1516_QA_COMMIT_SHA: sha,
  VITE_PR1516_QA_SCOPE: "pr1516-multi-property-notices",
  VITE_PR1516_QA_SELECTOR: "pr1516-landlord",
  VITE_API_BASE_URL: "/api/pr1516-notices",
};

describe("PR #1516 browser QA bootstrap", () => {
  beforeEach(() => sessionStorage.clear());

  it("accepts only the exact Preview build contract", () => {
    expect(getPr1516QaBuildContract(env, "rentchain-pr1516-abc.vercel.app").valid).toBe(true);
    for (const patch of [
      { VITE_DEPLOY_ENV: "production" },
      { VITE_PR1516_QA_BRANCH: "main" },
      { VITE_PR1516_QA_COMMIT_SHA: "short" },
      { VITE_PR1516_QA_SCOPE: "other" },
      { VITE_PR1516_QA_SELECTOR: "other" },
      { VITE_API_BASE_URL: "/api/preview-backend" },
    ]) expect(getPr1516QaBuildContract({ ...env, ...patch }, "rentchain-pr1516-abc.vercel.app").valid).toBe(false);
    expect(getPr1516QaBuildContract(env, "rentchain.ca").valid).toBe(false);
    expect(getPr1516QaBuildContract(env, "rentchain.vercel.app").valid).toBe(false);
  });

  it("requires a matching session-only marker", () => {
    expect(isPr1516BrowserQaSessionActive(sessionStorage, env, "qa.vercel.app")).toBe(false);
    activatePr1516BrowserQaSession(sessionStorage, sha);
    expect(localStorage.getItem(PR1516_QA_SESSION_KEY)).toBeNull();
    expect(isPr1516BrowserQaSessionActive(sessionStorage, env, "qa.vercel.app")).toBe(true);
    expect(isPr1516BrowserQaSessionActive(sessionStorage, { ...env, VITE_PR1516_QA_COMMIT_SHA: "b".repeat(40) }, "qa.vercel.app")).toBe(false);
    clearPr1516BrowserQaSession(sessionStorage);
    expect(isPr1516BrowserQaSessionActive(sessionStorage, env, "qa.vercel.app")).toBe(false);
  });

  it("resolves only the fixed synthetic landlord and ignores browser input", () => {
    activatePr1516BrowserQaSession(sessionStorage, sha);
    const user = resolvePr1516BrowserQaUser(sessionStorage, env, "qa.vercel.app");
    expect(user).toEqual(expect.objectContaining({ id: "qa-pr1516-landlord", landlordId: "qa-pr1516-landlord", role: "landlord" }));
    expect(resolvePr1516BrowserQaUser(sessionStorage, env, "rentchain.ca")).toBeNull();
  });

  it("rejects altered server bootstrap fields", () => {
    const response = { ok: true as const, branch: env.VITE_PR1516_QA_BRANCH, commitSha: sha, scope: env.VITE_PR1516_QA_SCOPE, selector: env.VITE_PR1516_QA_SELECTOR, apiBase: env.VITE_API_BASE_URL, landingPath: "/notices" as const };
    expect(isValidPr1516BootstrapResponse(response, sha)).toBe(true);
    expect(isValidPr1516BootstrapResponse({ ...response, selector: "attacker" }, sha)).toBe(false);
    expect(isValidPr1516BootstrapResponse({ ...response, commitSha: "b".repeat(40) }, sha)).toBe(false);
  });
});
