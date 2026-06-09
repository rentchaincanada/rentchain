import { describe, expect, it } from "vitest";
import { deriveTenantUnifiedInbox, generateSafeInboxId } from "../index";

describe("unified inbox service exports", () => {
  it("exports safe reference helpers and derivation entry points", async () => {
    expect(generateSafeInboxId("tenant.message", "message_raw_123", "scope_raw_123")).toMatch(/^inbox_v1_/);
    await expect(deriveTenantUnifiedInbox({ tenantWorkspaceId: "" })).resolves.toEqual({ items: [] });
  });
});
