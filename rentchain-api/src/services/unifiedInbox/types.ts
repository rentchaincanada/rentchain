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
};

export type UnifiedInboxPage = {
  items: UnifiedInboxEvent[];
  nextCursor?: string;
};

export type UnifiedInboxPaginationOptions = {
  limit?: number;
  cursor?: string;
};
