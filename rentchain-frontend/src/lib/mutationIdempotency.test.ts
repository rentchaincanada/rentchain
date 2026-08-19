import { describe, expect, it, vi } from "vitest";
import { createMutationIdempotencyKey } from "./mutationIdempotency";

describe("createMutationIdempotencyKey", () => {
  it("creates a new caller-owned identity only when invoked for new intent", () => {
    const randomUUID = vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    expect(createMutationIdempotencyKey("lease-create")).toBe("lease-create:00000000-0000-4000-8000-000000000001");
    expect(createMutationIdempotencyKey("lease-create")).toBe("lease-create:00000000-0000-4000-8000-000000000002");
    randomUUID.mockRestore();
  });
});
