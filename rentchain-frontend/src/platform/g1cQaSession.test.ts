import { beforeEach, describe, expect, it } from "vitest";

import { G1C_QA_PRINCIPAL, G1C_QA_SCOPE, G1C_QA_SESSION_KEY, hasG1cQaSession } from "./g1cQaSession";

describe("G1C fixed QA session", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("accepts only the exact G1C scope and principal", () => {
    window.sessionStorage.setItem(G1C_QA_SESSION_KEY, JSON.stringify({
      scope: G1C_QA_SCOPE,
      session: { principalId: G1C_QA_PRINCIPAL },
    }));
    expect(hasG1cQaSession()).toBe(true);
  });

  it.each([
    null,
    "not-json",
    JSON.stringify({ scope: G1C_QA_SCOPE, session: { principalId: "qa-g1c-foreign-tenant" } }),
    JSON.stringify({ scope: "other-preview-scope", session: { principalId: G1C_QA_PRINCIPAL } }),
  ])("rejects missing, malformed, foreign, or unrelated sessions", (value) => {
    if (value !== null) window.sessionStorage.setItem(G1C_QA_SESSION_KEY, value);
    expect(hasG1cQaSession()).toBe(false);
  });
});
