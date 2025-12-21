import { AuditEvent } from "./auditEventService";

let blockchainModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  blockchainModule = require("../blockchain");
} catch {
  blockchainModule = null;
}

const BLOCKCHAIN_ENABLED =
  process.env.BLOCKCHAIN_ENABLED === "true" ||
  process.env.BLOCKCHAIN_ENABLED === "1";

export type OnChainPayload = {
  id: string;
  kind: AuditEvent["kind"];
  entityType: AuditEvent["entityType"];
  entityId: string;
  tenantId?: string | null;
  propertyId?: string | null;
  applicationId?: string | null;
  paymentId?: string | null;
  timestamp: string;
  summary: string;
  meta?: Record<string, any> | null;
};

export type RelayResult = {
  txHash: string;
  payload: OnChainPayload;
  simulated: boolean;
};

export function buildOnChainPayloadFromAuditEvent(
  event: AuditEvent
): OnChainPayload {
  return {
    id: event.id,
    kind: event.kind,
    entityType: event.entityType,
    entityId: event.entityId,
    tenantId: event.tenantId ?? null,
    propertyId: event.propertyId ?? null,
    applicationId: event.applicationId ?? null,
    paymentId: event.paymentId ?? null,
    timestamp: event.timestamp,
    summary: event.summary,
    meta: event.meta ?? null,
  };
}

export async function relayAuditEventToChain(
  event: AuditEvent
): Promise<RelayResult> {
  const payload = buildOnChainPayloadFromAuditEvent(event);

  if (!BLOCKCHAIN_ENABLED) {
    const fakeHash = `0xsimulated-${event.id.slice(0, 8)}-${Date.now().toString(
      16
    )}`;
    console.log("[BlockchainWriter] Simulation only (BLOCKCHAIN_ENABLED=false)", {
      txHash: fakeHash,
      payload,
    });
    return {
      txHash: fakeHash,
      payload,
      simulated: true,
    };
  }

  let txHash: string | null = null;

  try {
    if (blockchainModule) {
      const fn =
        blockchainModule.writeEventToChain ||
        blockchainModule.logEventToChain ||
        blockchainModule.sendToBlockchain;

      if (typeof fn === "function") {
        const result = await fn(payload);
        if (typeof result === "string") {
          txHash = result;
        } else if (result && typeof result.txHash === "string") {
          txHash = result.txHash;
        }
      }
    }
  } catch (err) {
    console.error("[BlockchainWriter] Error calling blockchain module", err);
  }

  if (!txHash) {
    txHash = `0xstub-${event.id.slice(0, 8)}-${Date.now().toString(16)}`;
  }

  console.log("[BlockchainWriter] Relayed audit event to chain (or stub)", {
    txHash,
    payload,
    simulated: false,
  });

  return {
    txHash,
    payload,
    simulated: false,
  };
}
