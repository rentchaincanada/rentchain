import crypto from "crypto";
import type { SourceKind, UnifiedInboxAudienceRole, UnifiedInboxSourceRef } from "./types";

function asSafePart(value: string): string {
  return String(value || "").trim();
}

export function generateSafeInboxId(
  sourceKind: SourceKind,
  sourceStableKey: string,
  audienceScopeKey: string
): string {
  const input = [sourceKind, sourceStableKey, audienceScopeKey].map(asSafePart).join("|");
  const digest = crypto.createHash("sha256").update(input).digest("base64url").slice(0, 32);
  return `inbox_v1_${digest}`;
}

export function buildSafeSourceRef(
  sourceKind: SourceKind,
  sourceStableKey: string,
  audienceScopeKey: string
): UnifiedInboxSourceRef {
  return {
    kind: sourceKind,
    ref: generateSafeInboxId(sourceKind, sourceStableKey, audienceScopeKey),
  };
}

export function safeSourceId(
  sourceKind: SourceKind,
  sourceStableKey: string,
  audienceScopeKey: string
): string {
  return buildSafeSourceRef(sourceKind, sourceStableKey, audienceScopeKey).ref;
}

export function generateSafeScopeKey(role: UnifiedInboxAudienceRole, rawScopeKey: string): string {
  const input = [role, rawScopeKey].map(asSafePart).join("|");
  const digest = crypto.createHash("sha256").update(input).digest("base64url").slice(0, 32);
  return `scope_v1_${digest}`;
}

export function safeIdContainsRawValue(safeId: string, rawValue: string): boolean {
  const raw = String(rawValue || "").trim();
  if (!raw) return false;
  return safeId.includes(raw);
}

export function isBase64UrlSafeInboxId(value: string): boolean {
  return /^inbox_v1_[A-Za-z0-9_-]+$/.test(String(value || ""));
}
