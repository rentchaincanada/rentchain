import crypto from "crypto";

// Recursively sort object keys for stable JSON
function sortValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    const sorted: Record<string, any> = {};
    Object.keys(value)
      .sort()
      .forEach((k) => {
        sorted[k] = sortValue(value[k]);
      });
    return sorted;
  }
  return value;
}

export function canonicalize(input: any): string {
  return JSON.stringify(sortValue(input));
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function computeLedgerEventHashV1(eventPayload: any, prevHash: string | null) {
  const payload = {
    landlordId: eventPayload.landlordId ?? null,
    eventType: eventPayload.eventType ?? null,
    title: eventPayload.title ?? null,
    summary: eventPayload.summary ?? null,
    amount: eventPayload.amount ?? null,
    currency: eventPayload.amount ? eventPayload.currency || "CAD" : null,
    occurredAt: eventPayload.occurredAt ?? null,
    createdAt: eventPayload.createdAt ?? null,
    propertyId: eventPayload.propertyId ?? null,
    unitId: eventPayload.unitId ?? null,
    tenantId: eventPayload.tenantId ?? null,
    leaseId: eventPayload.leaseId ?? null,
    paymentId: eventPayload.paymentId ?? null,
    actor: eventPayload.actor
      ? {
          type: eventPayload.actor.type ?? null,
          userId: eventPayload.actor.userId ?? null,
          email: eventPayload.actor.email ?? null,
        }
      : { type: null, userId: null, email: null },
    tags: Array.isArray(eventPayload.tags) ? [...eventPayload.tags].sort() : [],
    metadata: eventPayload.metadata || {},
    prevHash: prevHash ?? null,
    hashVersion: 1,
  };

  return sha256Hex(canonicalize(payload));
}
