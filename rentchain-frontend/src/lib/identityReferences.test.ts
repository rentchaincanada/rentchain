import { describe, expect, it } from "vitest";
import {
  formatInternalReference,
  formatOperationalLabel,
  formatOperationalReference,
  shortenInternalId,
  slugifyOperationalReference,
} from "./identityReferences";

describe("identityReferences", () => {
  it("shortens long internal ids without changing storage identity", () => {
    expect(shortenInternalId("38r6fSwiPSDke0rEGKkx")).toBe("38r6fSwi...GKkx");
    expect(shortenInternalId("t1")).toBe("t1");
  });

  it("labels internal ids explicitly for support and debug contexts", () => {
    expect(formatInternalReference("tenant", "38r6fSwiPSDke0rEGKkx")).toBe(
      "Internal tenant ID: 38r6fSwi...GKkx"
    );
  });

  it("uses operational labels before falling back to references", () => {
    expect(formatOperationalLabel({ kind: "tenant", label: "Bailey Blinkers", internalId: "abc123" })).toBe(
      "Bailey Blinkers"
    );
    expect(formatOperationalLabel({ kind: "tenant", internalId: "38r6fSwiPSDke0rEGKkx" })).toBe(
      "Tenant ref 38r6fSwi...GKkx"
    );
  });

  it("formats export-safe slugs from human-readable parts", () => {
    expect(slugifyOperationalReference(["Lease ledger", "Bailey House", "Unit 4"])).toBe(
      "lease-ledger-bailey-house-unit-4"
    );
    expect(slugifyOperationalReference(["", null], "fallback-name")).toBe("fallback-name");
  });

  it("formats operational references without raw field names", () => {
    expect(formatOperationalReference("lease", "lease_1234567890abcdef")).toBe("Lease ref lease_12...cdef");
  });
});
