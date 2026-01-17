export function stripeNotConfiguredResponse() {
  return { ok: false as const, error: "stripe_not_configured" as const };
}

export function isStripeNotConfiguredError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const anyE = e as any;
  return anyE?.code === "stripe_not_configured" || anyE?.message === "stripe_not_configured";
}
