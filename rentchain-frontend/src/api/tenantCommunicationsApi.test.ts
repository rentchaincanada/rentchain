import { beforeEach, describe, expect, it, vi } from "vitest";

import { G1C_QA_PRINCIPAL, G1C_QA_SCOPE, G1C_QA_SESSION_KEY } from "../platform/g1cQaSession";

const mocks = vi.hoisted(() => ({ tenantApiFetch: vi.fn() }));
vi.mock("./tenantApiFetch", () => ({ tenantApiFetch: mocks.tenantApiFetch }));

import { getTenantCommunicationSummary, getTenantMessages } from "./tenantCommunicationsApi";

describe("tenant communication routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("suppresses only the background summary request in the exact G1C QA session", async () => {
    window.sessionStorage.setItem(G1C_QA_SESSION_KEY, JSON.stringify({
      scope: G1C_QA_SCOPE,
      session: { principalId: G1C_QA_PRINCIPAL },
    }));

    await expect(getTenantCommunicationSummary()).resolves.toMatchObject({
      ok: true,
      unreadMessages: 0,
      unreadNotices: 0,
      unreadTotal: 0,
    });
    expect(mocks.tenantApiFetch).not.toHaveBeenCalled();
  });

  it("preserves normal Production summary routing outside G1C QA", async () => {
    mocks.tenantApiFetch.mockResolvedValue({ ok: true, unreadTotal: 2 });
    await getTenantCommunicationSummary();
    expect(mocks.tenantApiFetch).toHaveBeenCalledWith("/tenant/communication/summary");
  });

  it("does not suppress unrelated tenant communication routes in G1C QA", async () => {
    window.sessionStorage.setItem(G1C_QA_SESSION_KEY, JSON.stringify({
      scope: G1C_QA_SCOPE,
      session: { principalId: G1C_QA_PRINCIPAL },
    }));
    mocks.tenantApiFetch.mockResolvedValue({ ok: true, items: [], unreadCount: 0 });
    await getTenantMessages();
    expect(mocks.tenantApiFetch).toHaveBeenCalledWith("/tenant/messages");
  });

  it("cannot suppress the summary for a foreign synthetic principal", async () => {
    window.sessionStorage.setItem(G1C_QA_SESSION_KEY, JSON.stringify({
      scope: G1C_QA_SCOPE,
      session: { principalId: "qa-g1c-foreign-tenant" },
    }));
    mocks.tenantApiFetch.mockResolvedValue({ ok: true, unreadTotal: 0 });
    await getTenantCommunicationSummary();
    expect(mocks.tenantApiFetch).toHaveBeenCalledWith("/tenant/communication/summary");
  });
});
