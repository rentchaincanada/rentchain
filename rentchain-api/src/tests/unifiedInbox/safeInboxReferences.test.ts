import { describe, expect, it } from "vitest";
import {
  buildSafeSourceRef,
  generateSafeInboxId,
  generateSafeScopeKey,
  isBase64UrlSafeInboxId,
  safeIdContainsRawValue,
  safeSourceId,
} from "../../services/unifiedInbox";

describe("safe inbox references", () => {
  it("generates deterministic safe inbox IDs without raw source values", () => {
    const id = generateSafeInboxId("tenant.message", "message_raw_123", "scope_raw_456");
    const repeated = generateSafeInboxId("tenant.message", "message_raw_123", "scope_raw_456");

    expect(id).toBe(repeated);
    expect(isBase64UrlSafeInboxId(id)).toBe(true);
    expect(safeIdContainsRawValue(id, "message_raw_123")).toBe(false);
    expect(safeIdContainsRawValue(id, "scope_raw_456")).toBe(false);
  });

  it("builds source refs and scope keys with stable safe prefixes", () => {
    const scopeKey = generateSafeScopeKey("landlord", "landlord_raw_abc");
    const sourceId = safeSourceId("landlord.application", "application_raw_abc", scopeKey);
    const sourceRef = buildSafeSourceRef("landlord.application", "application_raw_abc", scopeKey);

    expect(scopeKey).toMatch(/^scope_v1_[A-Za-z0-9_-]+$/);
    expect(sourceId).toMatch(/^inbox_v1_[A-Za-z0-9_-]+$/);
    expect(sourceRef).toEqual({
      kind: "landlord.application",
      ref: sourceId,
    });
    expect(JSON.stringify({ scopeKey, sourceId, sourceRef })).not.toContain("landlord_raw_abc");
    expect(JSON.stringify({ scopeKey, sourceId, sourceRef })).not.toContain("application_raw_abc");
  });
});
