export function createMutationIdempotencyKey(scope: string): string {
  const normalizedScope = String(scope || "mutation").trim().replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 48) || "mutation";
  return `${normalizedScope}:${crypto.randomUUID()}`;
}

export function isDeterministicMutationFailure(error: unknown): boolean {
  const status = Number((error as { status?: unknown } | null)?.status);
  return Number.isInteger(status) && status >= 400 && status < 500;
}
