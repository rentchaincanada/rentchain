import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("./apiFetch", () => ({ apiFetch: apiFetchMock }));

import { activateRenewalContinuity, getRenewalContinuityContext } from "./renewalContinuityApi";

describe("renewalContinuityApi", () => {
  beforeEach(() => apiFetchMock.mockReset());

  it("loads the server-authoritative successor context", async () => {
    apiFetchMock.mockResolvedValue({ ok: true, context: { handoffEligible: false } });
    await getRenewalContinuityContext("lease successor");
    expect(apiFetchMock).toHaveBeenCalledWith("/leases/renewals/lease%20successor/context");
  });

  it("sends expected state and caller-owned idempotency identity", async () => {
    apiFetchMock.mockResolvedValue({ ok: true, result: { outcome: "renewal_handoff_completed" } });
    await activateRenewalContinuity("successor", {
      expectedStateToken: "state-1",
      evaluationInstant: "2027-01-01T12:00:00.000Z",
    }, "renewal-request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/leases/renewals/successor/activate", {
      method: "POST",
      headers: { "Idempotency-Key": "renewal-request-1" },
      body: { expectedStateToken: "state-1", evaluationInstant: "2027-01-01T12:00:00.000Z" },
    });
  });
});
