import type { CanonicalEventVisibility } from "./eventTypes";

const ALLOWED_VISIBILITY = new Set<CanonicalEventVisibility>([
  "internal",
  "landlord",
  "tenant",
  "admin",
  "system",
]);

export function normalizeEventVisibility(value: unknown): CanonicalEventVisibility {
  const normalized = String(value || "")
    .trim()
    .toLowerCase() as CanonicalEventVisibility;
  return ALLOWED_VISIBILITY.has(normalized) ? normalized : "internal";
}
