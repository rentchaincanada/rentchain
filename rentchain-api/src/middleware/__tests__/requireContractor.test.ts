import { describe, expect, it, vi } from "vitest";

vi.mock("../requireAuth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

describe("requireContractor", () => {
  async function invoke(user: any) {
    const { requireContractor } = await import("../requireContractor");
    return await new Promise<{ status: number; body: any; nextCalled: boolean }>((resolve) => {
      const req: any = { user };
      const res: any = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          resolve({ status: this.statusCode, body: payload, nextCalled: false });
          return this;
        },
      };
      requireContractor(req, res, () => resolve({ status: 200, body: null, nextCalled: true }));
    });
  }

  it("allows contractor role and normalizes contractor context", async () => {
    const res = await invoke({ id: "contractor-1", role: "contractor" });
    expect(res.nextCalled).toBe(true);
    expect(res.status).toBe(200);
  });

  it("rejects non-contractor roles", async () => {
    const res = await invoke({ id: "landlord-1", role: "landlord" });
    expect(res.nextCalled).toBe(false);
    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("forbidden");
  });
});
