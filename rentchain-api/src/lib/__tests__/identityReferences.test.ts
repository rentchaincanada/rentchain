import { describe, expect, it } from "vitest";
import {
  formatInternalReference,
  formatOperationalReference,
  shortenInternalId,
  slugifyOperationalReference,
} from "../identityReferences";

describe("identityReferences", () => {
  it("shortens long internal ids for display-only references", () => {
    expect(shortenInternalId("38r6fSwiPSDke0rEGKkx")).toBe("38r6fSwi...GKkx");
    expect(shortenInternalId("t1")).toBe("t1");
  });

  it("labels internal ids explicitly in support/debug contexts", () => {
    expect(formatInternalReference("lease", "y7XM6BFXIzWW0fV3mu1L")).toBe(
      "Internal lease ID: y7XM6BFX...mu1L"
    );
  });

  it("formats operational references and safe export slugs", () => {
    expect(formatOperationalReference("tenant", "38r6fSwiPSDke0rEGKkx")).toBe("Tenant ref 38r6fSwi...GKkx");
    expect(slugifyOperationalReference(["Tenant report", "Bailey Blinkers"])).toBe("tenant-report-bailey-blinkers");
  });
});
