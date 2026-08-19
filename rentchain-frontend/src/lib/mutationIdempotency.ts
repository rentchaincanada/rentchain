export function createMutationIdempotencyKey(scope: string): string {
  const normalizedScope = String(scope || "mutation").trim().replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 48) || "mutation";
  return `${normalizedScope}:${crypto.randomUUID()}`;
}
