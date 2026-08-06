import { Router, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  deriveLandlordUnifiedInbox,
  buildLandlordConversationInboxRecords,
  toPublicInboxRecord,
  type SourceKind,
  type UnifiedInboxEvent,
  type UnifiedInboxPublicRecord,
} from "../services/unifiedInbox";

const router = Router();

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const READ_STATES_COLLECTION = "unifiedInboxReadStates";
const MAX_LANDLORD_CONVERSATIONS = 100;
const MAX_MESSAGES_PER_CONVERSATION = 20;
const MAX_READ_STATES = 100;
const TRUNCATION_SENTINEL = 1;
const OMITTED_UNSAFE_PROJECTIONS = [
  "leases",
  "maintenanceRequests",
  "rentalApplications",
  "workOrders",
  "properties",
  "units",
  "events",
  "canonicalEvents",
  "financialTransactions",
  "screeningOrders",
] as const;

export type LandlordInboxRequest = {
  limit: number;
  offset: number;
  propertyId: string | null;
  source: SourceKind | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export type LandlordInboxItem = UnifiedInboxPublicRecord;

export type LandlordInboxResponse = {
  ok: true;
  items: LandlordInboxItem[];
  total: number;
  limit: number;
  offset: number;
};

type ValidationResult =
  | { ok: true; value: LandlordInboxRequest }
  | { ok: false; status: number; error: string; message: string };

const SOURCE_MAP: Record<string, SourceKind> = {
  application: "landlord.application",
  "landlord.application": "landlord.application",
  screening: "landlord.screening",
  "landlord.screening": "landlord.screening",
  lease: "landlord.lease",
  "landlord.lease": "landlord.lease",
  maintenance: "landlord.maintenance",
  "landlord.maintenance": "landlord.maintenance",
  message: "landlord.message",
  "landlord.message": "landlord.message",
};

function asString(value: unknown, max = 240): string {
  const next = String(value || "").trim().slice(0, max);
  return next || "";
}

function isSafeInboxRecordId(value: string) {
  return /^inbox_v1_[A-Za-z0-9_-]+$/.test(value);
}

function readStateDocId(landlordId: string, recordId: string) {
  const scope = Buffer.from(landlordId, "utf8").toString("base64url");
  return `landlord_${scope}_${recordId}`;
}

function hasLandlordScope(record: any, landlordId: string) {
  return [record?.landlordId, record?.ownerId, record?.userId].some((value) => asString(value, 240) === landlordId);
}

function landlordScopeFingerprint(landlordId: string) {
  return createHash("sha256").update(landlordId).digest("hex").slice(0, 12);
}

function docPropertyId(record: any) {
  return asString(record?.propertyId || record?.property?.id, 240);
}

function parseInteger(value: unknown, fallback: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function parseIso(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function validateQuery(query: any): ValidationResult {
  const limit = parseInteger(query?.limit, DEFAULT_LIMIT);
  if (limit == null || limit < 1 || limit > MAX_LIMIT) {
    return {
      ok: false,
      status: 400,
      error: "INVALID_LIMIT",
      message: "limit must be an integer between 1 and 100",
    };
  }

  const offset = parseInteger(query?.offset, 0);
  if (offset == null || offset < 0) {
    return {
      ok: false,
      status: 400,
      error: "INVALID_OFFSET",
      message: "offset must be a non-negative integer",
    };
  }

  const sourceRaw = asString(query?.source, 80).toLowerCase();
  const source = sourceRaw ? SOURCE_MAP[sourceRaw] : null;
  if (sourceRaw && !source) {
    return {
      ok: false,
      status: 400,
      error: "INVALID_SOURCE",
      message: "source must be one of application, screening, lease, maintenance, or message",
    };
  }

  const dateFrom = parseIso(query?.dateFrom);
  if (query?.dateFrom && !dateFrom) {
    return { ok: false, status: 400, error: "INVALID_DATE_FROM", message: "dateFrom must be an ISO8601 timestamp" };
  }

  const dateTo = parseIso(query?.dateTo);
  if (query?.dateTo && !dateTo) {
    return { ok: false, status: 400, error: "INVALID_DATE_TO", message: "dateTo must be an ISO8601 timestamp" };
  }

  if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) {
    return {
      ok: false,
      status: 400,
      error: "INVALID_DATE_RANGE",
      message: "dateFrom must be earlier than dateTo",
    };
  }

  return {
    ok: true,
    value: {
      limit,
      offset,
      propertyId: asString(query?.propertyId, 240) || null,
      source,
      dateFrom,
      dateTo,
    },
  };
}

async function loadLandlordConversations(landlordId: string) {
  const snap = await db
    .collection("conversations")
    .where("landlordId", "==", landlordId)
    .orderBy("lastMessageAt", "desc")
    .limit(MAX_LANDLORD_CONVERSATIONS + TRUNCATION_SENTINEL)
    .get()
    .catch(() => null);
  if (!snap) return [];
  const docs = snap.docs || [];
  if (docs.length > MAX_LANDLORD_CONVERSATIONS) {
    console.warn("[landlord-inbox] owned conversation limit reached", {
      code: "UNIFIED_INBOX_SCOPE_LIMIT_REACHED",
      collection: "conversations",
      limit: MAX_LANDLORD_CONVERSATIONS,
      observedCappedCount: docs.length,
      landlordScope: landlordScopeFingerprint(landlordId),
    });
  }
  return docs
    .slice(0, MAX_LANDLORD_CONVERSATIONS)
    .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }));
}

async function loadRecentMessagesForOwnedConversations(
  conversations: Array<Record<string, unknown>>,
  propertyId: string | null
) {
  const scopedConversations = propertyId
    ? conversations.filter((conversation) => docPropertyId(conversation) === propertyId)
    : conversations;
  const batches = await Promise.all(
    scopedConversations.map(async (conversation) => {
      const conversationId = asString(conversation.id, 240);
      if (!conversationId) return { messages: [], limitReached: false };
      const snap = await db
        .collection("messages")
        .where("conversationId", "==", conversationId)
        .orderBy("createdAt", "desc")
        .limit(MAX_MESSAGES_PER_CONVERSATION + TRUNCATION_SENTINEL)
        .get()
        .catch(() => null);
      const docs = snap?.docs || [];
      return {
        messages: docs
          .slice(0, MAX_MESSAGES_PER_CONVERSATION)
          .map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) })),
        limitReached: docs.length > MAX_MESSAGES_PER_CONVERSATION,
      };
    })
  );
  const limitedConversationCount = batches.filter((batch) => batch.limitReached).length;
  if (limitedConversationCount) {
    console.warn("[landlord-inbox] per-conversation message limit reached", {
      code: "UNIFIED_INBOX_SCOPE_LIMIT_REACHED",
      collection: "messages",
      conversationCount: limitedConversationCount,
      limit: MAX_MESSAGES_PER_CONVERSATION,
      observedCappedCount: MAX_MESSAGES_PER_CONVERSATION + TRUNCATION_SENTINEL,
    });
  }
  return batches.flatMap((batch) => batch.messages);
}

async function loadReadStatesByRecordId(landlordId: string) {
  const snap = await db
    .collection(READ_STATES_COLLECTION)
    .where("landlordId", "==", landlordId)
    .limit(MAX_READ_STATES + TRUNCATION_SENTINEL)
    .get()
    .catch(() => null);
  if (!snap) return new Map<string, string>();
  const docs = snap.docs || [];
  if (docs.length > MAX_READ_STATES) {
    console.warn("[landlord-inbox] read-state limit reached", {
      code: "UNIFIED_INBOX_SCOPE_LIMIT_REACHED",
      collection: READ_STATES_COLLECTION,
      limit: MAX_READ_STATES,
      observedCappedCount: docs.length,
      landlordScope: landlordScopeFingerprint(landlordId),
    });
  }
  const entries: Array<[string, string]> = [];
  for (const doc of docs.slice(0, MAX_READ_STATES)) {
    const record = { id: doc.id, ...((doc.data() as any) || {}) };
    const recordId = asString(record?.recordId, 240);
    const readAt = asString(record?.readAt, 120);
    if (asString(record?.landlordId, 240) === landlordId && isSafeInboxRecordId(recordId) && readAt) {
      entries.push([recordId, readAt]);
    }
  }
  return new Map<string, string>(entries);
}

async function resolvePropertyScope(landlordId: string, propertyId: string | null) {
  if (!propertyId) return { ok: true as const };
  const propertyDoc = await db.collection("properties").doc(propertyId).get().catch(() => null);
  if (!propertyDoc?.exists) {
    return { ok: false as const, status: 404, error: "PROPERTY_NOT_FOUND", message: "Property not found" };
  }
  const property = { id: propertyDoc.id, ...((propertyDoc.data() as any) || {}) };
  if (!hasLandlordScope(property, landlordId)) {
    return { ok: false as const, status: 403, error: "PROPERTY_FORBIDDEN", message: "Property is not available" };
  }
  return { ok: true as const };
}

function matchesDateRange(item: UnifiedInboxEvent, request: LandlordInboxRequest) {
  const occurredAt = Date.parse(item.occurredAt);
  if (!Number.isFinite(occurredAt)) return false;
  if (request.dateFrom && occurredAt < Date.parse(request.dateFrom)) return false;
  if (request.dateTo && occurredAt > Date.parse(request.dateTo)) return false;
  return true;
}

function applySafeFilters(items: UnifiedInboxEvent[], request: LandlordInboxRequest) {
  return items.filter((item) => {
    if (request.source && item.sourceKind !== request.source) return false;
    return matchesDateRange(item, request);
  });
}

function applyPersistedReadStates(items: UnifiedInboxEvent[], readStatesByRecordId: Map<string, string>) {
  return items.map((item) => {
    if (item.sourceKind === "landlord.message") return item;
    const readAt = readStatesByRecordId.get(item.id);
    if (!readAt) return item;
    if (item.status !== "unread" && item.readAt) return item;
    return { ...item, status: "read" as const, readAt };
  });
}

async function deriveScopedLandlordInbox(landlordId: string, request: LandlordInboxRequest) {
  console.warn("[landlord-inbox] governed projections omitted", {
    code: "UNIFIED_INBOX_PROJECTIONS_OMITTED",
    collections: OMITTED_UNSAFE_PROJECTIONS,
    reason: "BOUNDED_CANONICAL_OWNERSHIP_QUERY_UNAVAILABLE",
  });
  const conversations = await loadLandlordConversations(landlordId);
  const messages = await loadRecentMessagesForOwnedConversations(conversations, request.propertyId);

  const safePage = await deriveLandlordUnifiedInbox(landlordId, {
    applicationItems: [],
    screeningItems: [],
    leaseItems: [],
    maintenanceRequests: [],
    messages: buildLandlordConversationInboxRecords({
      landlordId,
      propertyId: request.propertyId,
      conversations,
      messages,
    }),
    limit: MAX_LIMIT,
  });
  const readStatesByRecordId = await loadReadStatesByRecordId(landlordId);
  return applyPersistedReadStates(safePage.items, readStatesByRecordId);
}

router.get("/inbox", requireAuth, requireLandlord, async (req: Request, res: Response) => {
  try {
    const landlordId = asString((req as any).user?.landlordId || (req as any).user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED", message: "Landlord context is required" });
    }

    const parsed = validateQuery(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ ok: false, error: parsed.error, message: parsed.message });
    }
    const request = parsed.value;

    const propertyScope = await resolvePropertyScope(landlordId, request.propertyId);
    if (!propertyScope.ok) {
      return res.status(propertyScope.status).json({
        ok: false,
        error: propertyScope.error,
        message: propertyScope.message,
      });
    }

    const safeItems = await deriveScopedLandlordInbox(landlordId, request);
    const filteredItems = applySafeFilters(safeItems, request);
    const items = filteredItems.slice(request.offset, request.offset + request.limit).map(toPublicInboxRecord);

    return res.json({
      ok: true,
      items,
      total: filteredItems.length,
      limit: request.limit,
      offset: request.offset,
    } satisfies LandlordInboxResponse);
  } catch (err: any) {
    console.error("[landlord-unified-inbox] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_INBOX_FAILED", message: "Unable to load inbox" });
  }
});

router.post("/inbox/:recordId/read", requireAuth, requireLandlord, async (req: Request, res: Response) => {
  try {
    const landlordId = asString((req as any).user?.landlordId || (req as any).user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED", message: "Landlord context is required" });
    }

    const recordId = asString(req.params?.recordId, 240);
    if (!recordId || !isSafeInboxRecordId(recordId)) {
      return res.status(400).json({ ok: false, error: "INVALID_INBOX_RECORD", message: "Inbox record is not available" });
    }

    const request: LandlordInboxRequest = {
      limit: MAX_LIMIT,
      offset: 0,
      propertyId: null,
      source: null,
      dateFrom: null,
      dateTo: null,
    };
    const safeItems = await deriveScopedLandlordInbox(landlordId, request);
    const item = safeItems.find((entry) => entry.id === recordId && entry.audienceRole === "landlord");
    if (!item) {
      return res.status(404).json({ ok: false, error: "INBOX_RECORD_NOT_FOUND", message: "Inbox record not found" });
    }

    const existingReadAt = item.readAt && item.status === "read" ? item.readAt : null;
    const readAt = existingReadAt || new Date().toISOString();
    if (item.sourceKind === "landlord.message") {
      const conversationId = asString(item.sourceEntityId, 240);
      if (!conversationId) {
        return res.status(404).json({ ok: false, error: "INBOX_RECORD_NOT_FOUND", message: "Inbox record not found" });
      }
      const conversationDoc = await db.collection("conversations").doc(conversationId).get().catch(() => null);
      const conversation = conversationDoc?.exists
        ? { id: conversationDoc.id, ...((conversationDoc.data() as any) || {}) }
        : null;
      if (!conversation || asString(conversation.landlordId, 240) !== landlordId) {
        return res.status(404).json({ ok: false, error: "INBOX_RECORD_NOT_FOUND", message: "Inbox record not found" });
      }
      await db.collection("conversations").doc(conversationId).set({ lastReadAtLandlord: readAt }, { merge: true });
      return res.json({ ok: true, record: toPublicInboxRecord({ ...item, status: "read", readAt }) });
    }
    await db
      .collection(READ_STATES_COLLECTION)
      .doc(readStateDocId(landlordId, recordId))
      .set(
        {
          audienceRole: "landlord",
          landlordId,
          recordId,
          sourceKind: item.sourceKind,
          readAt,
          updatedAt: readAt,
        },
        { merge: true }
      );

    return res.json({ ok: true, record: toPublicInboxRecord({ ...item, status: "read", readAt }) });
  } catch (err: any) {
    console.error("[landlord-unified-inbox] read update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_INBOX_READ_FAILED", message: "Unable to mark inbox item read" });
  }
});

export default router;
