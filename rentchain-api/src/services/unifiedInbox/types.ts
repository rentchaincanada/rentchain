export type UnifiedInboxAudienceRole = "tenant" | "landlord" | "contractor";

export type UnifiedInboxPriority = "critical" | "high" | "normal" | "low";

export type UnifiedInboxStatus = "unread" | "read" | "archived" | "muted" | "resolved";

export type SourceKind =
  | "tenant.message"
  | "tenant.maintenance"
  | "tenant.screening"
  | "tenant.lease"
  | "tenant.application"
  | "tenant.notice"
  | "tenant.viewing"
  | "landlord.application"
  | "landlord.screening"
  | "landlord.lease"
  | "landlord.maintenance"
  | "landlord.message"
  | "landlord.notice"
  | "landlord.viewing"
  | "landlord.work_order"
  | "contractor.work_order"
  | "contractor.message";

export type TenantScopeContext = {
  tenantWorkspaceId: string;
  tenantId?: string | null;
};

export type LandlordScopeContext = {
  landlordId: string;
};

export type ContractorScopeContext = {
  contractorId: string;
};

export type UnifiedInboxSafetyFlags = {
  rawIdsIncluded: false;
  tokensIncluded: false;
  secretsIncluded: false;
  providerPayloadIncluded: false;
  storagePathIncluded: false;
  privateNotesIncluded: false;
};

export type UnifiedInboxSourceRef = {
  kind: SourceKind;
  ref: string;
};

export type UnifiedInboxSourceActionRouteKind =
  | "applications_workspace"
  | "leases_workspace"
  | "maintenance_workspace"
  | "messages_workspace"
  | "payment_workspace"
  | "work_order_workspace";

export type UnifiedInboxSourceAction = {
  label: string;
  href: string;
  helper: string;
  routeKind: UnifiedInboxSourceActionRouteKind;
};

export type UnifiedInboxEvent = UnifiedInboxSafetyFlags & {
  id: string;
  sourceKind: SourceKind;
  sourceId: string;
  audienceRole: UnifiedInboxAudienceRole;
  audienceScopeKey: string;
  title: string;
  body: string;
  priority: UnifiedInboxPriority;
  status: UnifiedInboxStatus;
  occurredAt: string;
  readAt: string | null;
  sourceRef: UnifiedInboxSourceRef;
  /** Internal-only routing context. Never included directly in public inbox records. */
  sourceEntityId?: string;
};

export type UnifiedInboxPublicRecord = Pick<
  UnifiedInboxEvent,
  "id" | "sourceKind" | "audienceRole" | "title" | "body" | "priority" | "status" | "occurredAt" | "readAt"
> & {
  sourceAction: UnifiedInboxSourceAction | null;
};

export type UnifiedInboxPage = {
  items: UnifiedInboxEvent[];
  nextCursor?: string;
};

export type UnifiedInboxPaginationOptions = {
  limit?: number;
  cursor?: string;
};
