import { describe, expect, it, vi } from "vitest";

import { blockImpersonationWrites } from "../blockImpersonationWrites";

function invoke(input: { method: string; user?: Record<string, unknown> }) {
  const next = vi.fn();
  const req = { method: input.method, user: input.user || {} } as any;
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    setHeader(name: string, value: string) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as any;
  blockImpersonationWrites(req, res, next);
  return { next, res };
}

describe("blockImpersonationWrites", () => {
  it("blocks writes for governed impersonation sessions while allowing reads", () => {
    const write = invoke({
      method: "POST",
      user: {
        role: "tenant",
        impersonationActive: true,
        impersonationSessionId: "session-1",
        realActorId: "admin-1",
        effectiveActorId: "tenant-1",
      },
    });

    expect(write.res.statusCode).toBe(403);
    expect(write.res.body).toEqual({ error: "Writes blocked during impersonation" });
    expect(write.res.headers["x-impersonation"]).toBe("true");
    expect(write.next).not.toHaveBeenCalled();

    const read = invoke({
      method: "GET",
      user: { role: "tenant", impersonationSessionId: "session-1" },
    });
    expect(read.next).toHaveBeenCalledTimes(1);
    expect(read.res.headers["x-impersonation"]).toBe("true");
  });

  it("does not affect normal non-impersonated actions", () => {
    const result = invoke({ method: "POST", user: { role: "tenant", tenantId: "tenant-1" } });
    expect(result.next).toHaveBeenCalledTimes(1);
    expect(result.res.headers["x-impersonation"]).toBeUndefined();
  });
});
