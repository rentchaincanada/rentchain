import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("./apiFetch", () => ({
  apiFetch: mocks.apiFetchMock,
}));

describe("adminRecoveryApi", () => {
  beforeEach(() => {
    mocks.apiFetchMock.mockReset();
    mocks.apiFetchMock.mockResolvedValue({ ok: true, logs: [], candidates: [] });
  });

  it("calls the read-only recovery inspection endpoint with workflow reference payload", async () => {
    const { inspectRecoveryWorkflow } = await import("./adminRecoveryApi");

    await inspectRecoveryWorkflow({ workflowType: "decision", workflowId: "workflow-reference" });

    expect(mocks.apiFetchMock).toHaveBeenCalledWith("/admin/recovery/inspect", {
      method: "POST",
      body: {
        workflowType: "decision",
        workflowId: "workflow-reference",
      },
    });
  });

  it("loads recovery logs with candidate discovery parameters", async () => {
    const { fetchRecoveryLogs } = await import("./adminRecoveryApi");

    await fetchRecoveryLogs({ includeCandidates: true, limit: 25 });

    expect(mocks.apiFetchMock).toHaveBeenCalledWith("/admin/recovery/logs?includeCandidates=true&limit=25");
  });

  it("loads a single immutable recovery log by safe key", async () => {
    const { fetchRecoveryLog } = await import("./adminRecoveryApi");

    await fetchRecoveryLog("operator_recovery:safe-log-key");

    expect(mocks.apiFetchMock).toHaveBeenCalledWith("/admin/recovery/logs/operator_recovery%3Asafe-log-key");
  });
});
