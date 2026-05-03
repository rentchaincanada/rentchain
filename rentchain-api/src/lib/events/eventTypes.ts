export type CanonicalEventDomain =
  | "application"
  | "screening"
  | "lease"
  | "maintenance"
  | "expense"
  | "tenant"
  | "billing"
  | "payment"
  | "policy"
  | "system";

export type CanonicalEventActorType =
  | "user"
  | "system"
  | "admin"
  | "tenant"
  | "landlord"
  | "contractor"
  | "service";

export type CanonicalEventVisibility =
  | "internal"
  | "landlord"
  | "tenant"
  | "admin"
  | "system";

export type CanonicalEventV1 = {
  id: string;
  version: "v1";
  type: string;
  domain: CanonicalEventDomain;
  action: string;
  status?: string | null;
  actor: {
    type?: CanonicalEventActorType;
    id?: string | null;
    role?: string | null;
    displayName?: string | null;
  };
  resource: {
    type: string;
    id: string;
    parentType?: string | null;
    parentId?: string | null;
  };
  occurredAt: string;
  recordedAt: string;
  visibility: CanonicalEventVisibility;
  summary: string;
  metadata?: Record<string, unknown>;
  metrics?: Record<string, number | null>;
  tags?: string[];
};
