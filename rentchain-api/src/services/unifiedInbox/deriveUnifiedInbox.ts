import {
  adaptContractorMessageToInboxEvent,
  adaptContractorWorkOrderCommunicationToInboxEvent,
  adaptContractorWorkOrderToInboxEvent,
} from "./contractorInboxAdapters";
import {
  adaptLandlordApplicationInboxToInboxEvent,
  adaptLandlordApplicationStatusToInboxEvent,
  adaptLandlordLeaseInboxToInboxEvent,
  adaptLandlordLeaseNoticeToInboxEvent,
  adaptLandlordMaintenanceInboxToInboxEvent,
  adaptLandlordMessageInboxToInboxEvent,
  adaptLandlordScreeningInboxToInboxEvent,
  adaptLandlordViewingRequestToInboxEvent,
  adaptLandlordWorkOrderToInboxEvent,
} from "./landlordInboxAdapters";
import {
  adaptTenantApplicationStatusToInboxEvent,
  adaptTenantLeaseNoticeToInboxEvent,
  adaptTenantMaintenanceToInboxEvent,
  adaptTenantMessageToInboxEvent,
  adaptTenantNotificationToInboxEvent,
  adaptTenantScreeningToInboxEvent,
  adaptTenantViewingRequestToInboxEvent,
} from "./tenantInboxAdapters";
import type {
  ContractorScopeContext,
  LandlordScopeContext,
  TenantScopeContext,
  UnifiedInboxEvent,
  UnifiedInboxPage,
  UnifiedInboxPaginationOptions,
  UnifiedInboxPriority,
} from "./types";

type TenantDerivationOptions = UnifiedInboxPaginationOptions & {
  notifications?: any[];
  messages?: any[];
  maintenanceRequests?: any[];
  screeningRequests?: any[];
  viewingRequests?: any[];
  notices?: any[];
  applicationStatusItems?: any[];
};

type LandlordDerivationOptions = UnifiedInboxPaginationOptions & {
  applicationItems?: any[];
  screeningItems?: any[];
  leaseItems?: any[];
  maintenanceRequests?: any[];
  messages?: any[];
  viewingRequests?: any[];
  workOrders?: any[];
  notices?: any[];
  applicationStatusItems?: any[];
};

type ContractorDerivationOptions = UnifiedInboxPaginationOptions & {
  workOrders?: any[];
  messages?: any[];
  workOrderCommunications?: any[];
};

const PRIORITY_RANK: Record<UnifiedInboxPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function parseLimit(limit: unknown): number {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

export function encodeUnifiedInboxCursor(item: UnifiedInboxEvent): string {
  return Buffer.from(
    JSON.stringify({
      occurredAt: item.occurredAt,
      id: item.id,
    }),
    "utf8"
  ).toString("base64url");
}

function decodeCursor(value: unknown): { occurredAt: string; id: string } | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const occurredAt = String(parsed?.occurredAt || "").trim();
    const id = String(parsed?.id || "").trim();
    if (!occurredAt || !id) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

export function sortUnifiedInboxEvents(items: UnifiedInboxEvent[]): UnifiedInboxEvent[] {
  return [...items].sort((left, right) => {
    const readDiff = Number(left.status === "read" || left.readAt) - Number(right.status === "read" || right.readAt);
    if (readDiff !== 0) return readDiff;

    const priorityDiff = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const timeDiff = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    if (timeDiff !== 0) return timeDiff;

    return left.id.localeCompare(right.id);
  });
}

function paginate(items: UnifiedInboxEvent[], options?: UnifiedInboxPaginationOptions): UnifiedInboxPage {
  const sorted = sortUnifiedInboxEvents(items);
  const cursor = decodeCursor(options?.cursor);
  const cursorIndex = cursor
    ? sorted.findIndex((item) => item.id === cursor.id && item.occurredAt === cursor.occurredAt)
    : -1;
  const cursorFiltered = cursorIndex >= 0 ? sorted.slice(cursorIndex + 1) : sorted;
  const limit = parseLimit(options?.limit);
  const page = cursorFiltered.slice(0, limit);
  const hasMore = cursorFiltered.length > limit;
  return {
    items: page,
    nextCursor: hasMore && page.length ? encodeUnifiedInboxCursor(page[page.length - 1]) : undefined,
  };
}

export async function deriveTenantUnifiedInbox(
  tenantWorkspaceContext: TenantScopeContext,
  options: TenantDerivationOptions = {}
): Promise<UnifiedInboxPage> {
  if (!tenantWorkspaceContext?.tenantWorkspaceId) return { items: [] };

  const items = [
    ...(options.notifications || []).map((item) => adaptTenantNotificationToInboxEvent(item, tenantWorkspaceContext)),
    ...(options.messages || []).map((item) => adaptTenantMessageToInboxEvent(item, tenantWorkspaceContext)),
    ...(options.maintenanceRequests || []).map((item) => adaptTenantMaintenanceToInboxEvent(item, tenantWorkspaceContext)),
    ...(options.screeningRequests || []).map((item) => adaptTenantScreeningToInboxEvent(item, tenantWorkspaceContext)),
    ...(options.viewingRequests || []).map((item) => adaptTenantViewingRequestToInboxEvent(item, tenantWorkspaceContext)),
    ...(options.notices || []).map((item) => adaptTenantLeaseNoticeToInboxEvent(item, tenantWorkspaceContext)),
    ...(options.applicationStatusItems || []).map((item) => adaptTenantApplicationStatusToInboxEvent(item, tenantWorkspaceContext)),
  ].filter((item): item is UnifiedInboxEvent => Boolean(item));

  return paginate(items, options);
}

export async function deriveLandlordUnifiedInbox(
  landlordId: string,
  options: LandlordDerivationOptions = {}
): Promise<UnifiedInboxPage> {
  const context: LandlordScopeContext = { landlordId: String(landlordId || "").trim() };
  if (!context.landlordId) return { items: [] };

  const items = [
    ...(options.applicationItems || []).map((item) => adaptLandlordApplicationInboxToInboxEvent(item, context)),
    ...(options.screeningItems || []).map((item) => adaptLandlordScreeningInboxToInboxEvent(item, context)),
    ...(options.leaseItems || []).map((item) => adaptLandlordLeaseInboxToInboxEvent(item, context)),
    ...(options.maintenanceRequests || []).map((item) => adaptLandlordMaintenanceInboxToInboxEvent(item, context)),
    ...(options.messages || []).map((item) => adaptLandlordMessageInboxToInboxEvent(item, context)),
    ...(options.viewingRequests || []).map((item) => adaptLandlordViewingRequestToInboxEvent(item, context)),
    ...(options.workOrders || []).map((item) => adaptLandlordWorkOrderToInboxEvent(item, context)),
    ...(options.notices || []).map((item) => adaptLandlordLeaseNoticeToInboxEvent(item, context)),
    ...(options.applicationStatusItems || []).map((item) => adaptLandlordApplicationStatusToInboxEvent(item, context)),
  ].filter((item): item is UnifiedInboxEvent => Boolean(item));

  return paginate(items, options);
}

export async function deriveContractorUnifiedInbox(
  contractorId: string,
  options: ContractorDerivationOptions = {}
): Promise<UnifiedInboxPage> {
  const context: ContractorScopeContext = { contractorId: String(contractorId || "").trim() };
  if (!context.contractorId) return { items: [] };

  const items = [
    ...(options.workOrders || []).map((item) => adaptContractorWorkOrderToInboxEvent(item, context)),
    ...(options.messages || []).map((item) => adaptContractorMessageToInboxEvent(item, context)),
    ...(options.workOrderCommunications || []).map((item) => adaptContractorWorkOrderCommunicationToInboxEvent(item, context)),
  ].filter((item): item is UnifiedInboxEvent => Boolean(item));

  return paginate(items, options);
}
