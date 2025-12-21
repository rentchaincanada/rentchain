export interface EventEnvelope<P = unknown> {
  eventId: string;
  eventType: string;
  version: string;
  timestamp: string;
  env: "dev" | "staging" | "prod";

  actor: {
    actorType: string;
    actorId: string | null;
    ip?: string | null;
    userAgent?: string | null;
  };

  context: Record<string, any>;
  payload: P;
  integrity: {
    payloadHash: string;
    previousEventHash?: string | null;
    signature?: string | null;
    signingMethod?: string | null;
    nonce?: number;
  };
  links: {
    firestoreDocPath?: string | null;
    apiEndpoint?: string | null;
    onChainTxHash?: string | null;
    explorerUrl?: string | null;
  };
}
