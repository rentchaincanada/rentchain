import { describe, expect, it } from "vitest";
import { buildAdminStorageStateFixture } from "../fixtures/admin-storage-state";
import { generateStorageState } from "./storage-state-generator";

describe("storage state generator", () => {
  const fixture = buildAdminStorageStateFixture();

  describe("generateStorageState", () => {
    it("generates admin storage state with auth token", () => {
      const storageState = generateStorageState({
        fixture,
        role: "admin",
        baseUrl: "http://localhost:5173",
      });

      expect(storageState).toBeDefined();
      expect(storageState?.cookies).toHaveLength(1);
      expect(storageState?.cookies?.[0]).toMatchObject({
        name: "auth-token",
        value: expect.stringContaining("smoke-admin"),
      });
    });

    it("includes user context in localStorage", () => {
      const storageState = generateStorageState({
        fixture,
        role: "admin",
      });

      const localStorage = storageState?.origins?.[0]?.localStorage ?? [];
      const userIdEntry = localStorage.find((e) => e.name === "smoke:user:id");
      const roleEntry = localStorage.find((e) => e.name === "smoke:user:role");

      expect(userIdEntry?.value).toBe("smoke-admin");
      expect(roleEntry?.value).toBe("admin");
    });

    it("includes landlord context for landlord role", () => {
      const storageState = generateStorageState({
        fixture,
        role: "landlord",
      });

      const localStorage = storageState?.origins?.[0]?.localStorage ?? [];
      const landlordEntry = localStorage.find((e) => e.name === "smoke:landlord:id");

      expect(landlordEntry?.value).toBe("smoke-landlord-a");
    });

    it("includes tenant context for tenant role", () => {
      const storageState = generateStorageState({
        fixture,
        role: "tenant",
      });

      const localStorage = storageState?.origins?.[0]?.localStorage ?? [];
      const tenantEntry = localStorage.find((e) => e.name === "smoke:tenant:id");

      expect(tenantEntry?.value).toBe("smoke-tenant-a");
    });

    it("throws error for unknown role", () => {
      expect(() => {
        generateStorageState({
          fixture,
          role: "unknown" as any,
        });
      }).toThrow();
    });

    it("respects baseUrl parameter", () => {
      const storageState = generateStorageState({
        fixture,
        role: "admin",
        baseUrl: "https://example.com",
      });

      expect(storageState?.origins?.[0]?.origin).toBe("https://example.com");
      expect(storageState?.cookies?.[0]?.domain).toBe("example.com");
      expect(storageState?.cookies?.[0]?.secure).toBe(true);
    });

    it("includes fixture version and generation timestamp", () => {
      const storageState = generateStorageState({
        fixture,
        role: "admin",
      });

      const localStorage = storageState?.origins?.[0]?.localStorage ?? [];
      const versionEntry = localStorage.find((e) => e.name === "smoke:fixture:version");
      const generatedEntry = localStorage.find((e) => e.name === "smoke:generated:at");

      expect(versionEntry?.value).toBe("authenticated-smoke-v1");
      expect(generatedEntry?.value).toBe(fixture.generatedAt);
    });
  });
});
