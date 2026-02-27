import type { AutomationEvent } from "./automationTimeline.types";

export type IntegrityMode = "verified" | "unverified";

export type EventIntegrity = {
  eventHash: string;
  chainHash: string;
  prevChainHash: string;
  chainIndex: number;
};

export type IntegrityResult = {
  events: AutomationEvent[];
  mode: IntegrityMode;
  headChainHash: string | null;
};

type CanonicalEvent = {
  id: string;
  type: string;
  occurredAt: string;
  title: string;
  summary?: string;
  entity?: AutomationEvent["entity"];
  metadata?: {
    source?: unknown;
    status?: unknown;
    amountCents?: unknown;
    threadId?: unknown;
    note?: unknown;
  };
};

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function canonicalizeEventForHash(event: AutomationEvent): CanonicalEvent {
  const metadata = (event.metadata || {}) as Record<string, unknown>;
  return {
    id: event.id,
    type: event.type,
    occurredAt: event.occurredAt,
    title: event.title,
    summary: event.summary,
    entity: event.entity,
    metadata: {
      source: metadata.source,
      status: metadata.status,
      amountCents: metadata.amountCents,
      threadId: metadata.threadId,
      note: metadata.note,
    },
  };
}

export async function sha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return "";
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return toHex(digest);
  } catch {
    return "";
  }
}

export async function computeIntegrity(events: AutomationEvent[]): Promise<IntegrityResult> {
  const ascending = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  let prevChainHash = "genesis";
  const withIntegrity = await Promise.all(
    ascending.map(async (event, index) => {
      const canonical = canonicalizeEventForHash(event);
      const eventHash = await sha256Hex(JSON.stringify(canonical));
      const chainHash = eventHash
        ? await sha256Hex(`${prevChainHash}:${event.id}:${eventHash}`)
        : "";
      const integrity: EventIntegrity | null =
        eventHash && chainHash
          ? { eventHash, chainHash, prevChainHash, chainIndex: index }
          : null;
      const nextEvent: AutomationEvent = {
        ...event,
        metadata: {
          ...(event.metadata || {}),
          ...(integrity ? { integrity } : {}),
        },
      };
      prevChainHash = chainHash || prevChainHash;
      return nextEvent;
    })
  );

  const verified = withIntegrity.every(
    (event) => !!(event.metadata as any)?.integrity?.chainHash
  );
  const descending = withIntegrity.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return {
    events: descending,
    mode: verified ? "verified" : "unverified",
    headChainHash: verified ? prevChainHash : null,
  };
}
