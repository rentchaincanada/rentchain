import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/identityOracle/identityOracleService", () => ({
  runIdentityOracle: vi.fn(async () => ({
    run: { id: "run-1" },
    profile: { propertyId: "prop-1" },
  })),
}));

describe("identityOracleInternalRoutes mount path", () => {
  it("exposes a POST handler on /identity-oracle/run for /api/internal mounting", async () => {
    const router = (await import("../identityOracleInternalRoutes")).default as any;
    const layer = router.stack.find((entry: any) => entry.route?.path === "/identity-oracle/run");

    expect(layer).toBeTruthy();
    expect(layer.route.methods.post).toBe(true);
  });
});
