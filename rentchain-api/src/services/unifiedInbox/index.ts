/**
 * Unified inbox data layer.
 *
 * Pure role-safe adapters for existing source records. No routes,
 * persistence, realtime delivery, or source mutations live here.
 * See docs/architecture/unified-inbox-implementation-guardrails.md.
 */
export * from "./types";
export * from "./safeInboxReferences";
export * from "./tenantInboxAdapters";
export * from "./landlordInboxAdapters";
export * from "./landlordConversationInboxBridge";
export * from "./contractorInboxAdapters";
export * from "./deriveUnifiedInbox";
export * from "./unifiedInboxService";
