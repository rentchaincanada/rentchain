export type LedgerActorRole = "landlord" | "tenant" | "admin" | "system";

export interface ActorRef {
  userId: string;
  role: LedgerActorRole;
  email?: string;
}

export type LedgerEventType =
  | "TENANT_INVITED"
  | "TENANT_INVITE_REDEEMED"
  | "RENT_CHARGED"
  | "PAYMENT_RECORDED"
  | "NOTICE_SENT"
  | "MAINTENANCE_LOGGED"
  | "LEASE_CREATED";

export interface LedgerEventInput {
  landlordId: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  actor: ActorRef;
  type: LedgerEventType;
  ts: number;
  payload: any;
  source?: { route?: string; requestId?: string; ip?: string };
}

export interface LedgerEventStored extends LedgerEventInput {
  id: string;
  version: 1;
  seq: number;
  prevHash: string | null;
  payloadHash: string;
  hash: string;
  integrity: { status: "verified" | "unverified" | "broken"; verifiedAt?: number; reason?: string };
}

export function buildHashableEvent(args: {
  landlordId: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  actor: ActorRef;
  type: LedgerEventType;
  version: 1;
  ts: number;
  seq: number;
  prevHash: string | null;
  payloadHash: string;
}): object {
  const {
    landlordId,
    propertyId,
    unitId,
    tenantId,
    actor,
    type,
    version,
    ts,
    seq,
    prevHash,
    payloadHash,
  } = args;

  // Only include fields relevant for hash; exclude payload/integrity/source/id/hash.
  return {
    landlordId,
    propertyId: propertyId || null,
    unitId: unitId || null,
    tenantId: tenantId || null,
    actor,
    type,
    version,
    ts,
    seq,
    prevHash,
    payloadHash,
  };
}
