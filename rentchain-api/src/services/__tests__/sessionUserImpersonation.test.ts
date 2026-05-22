import { describe, expect, it, vi } from "vitest";

vi.mock("../entitlementsService", () => ({
  getUserEntitlements: vi.fn(async (_userId: string, params: any) => ({
    role: params.claimsRole,
    landlordId: params.landlordIdHint,
    plan: "test",
    capabilities: [],
  })),
}));

vi.mock("../../firebase", () => ({
  db: {
    collection: () => ({
      where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
      doc: () => ({ get: async () => ({ exists: false, data: () => null }) }),
    }),
  },
}));

describe("buildCanonicalSessionUserFromClaims impersonation metadata", () => {
  it("preserves real and effective actor chain for impersonated sessions", async () => {
    const { buildCanonicalSessionUserFromClaims } = await import("../sessionUserService");

    const user = await buildCanonicalSessionUserFromClaims({
      ver: 1,
      sub: "tenant-1",
      role: "tenant",
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      permissions: [],
      revokedPermissions: [],
      realActorId: "admin-1",
      realActorRole: "admin",
      effectiveActorId: "tenant-1",
      effectiveActorRole: "tenant",
      impersonationSessionId: "session-1",
      impersonationReason: "incident_review",
      impersonationStartedAt: "2026-05-22T12:00:00.000Z",
    });

    expect(user).toEqual(
      expect.objectContaining({
        id: "tenant-1",
        role: "tenant",
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        realActorId: "admin-1",
        realActorRole: "admin",
        effectiveActorId: "tenant-1",
        effectiveActorRole: "tenant",
        impersonationSessionId: "session-1",
        impersonationReason: "incident_review",
        impersonationStartedAt: "2026-05-22T12:00:00.000Z",
        impersonationActive: true,
      })
    );
  });
});
