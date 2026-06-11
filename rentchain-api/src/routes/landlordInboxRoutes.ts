import { Router, type Request, type Response } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import {
  deriveLandlordUnifiedInbox,
  toPublicInboxRecord,
  type SourceKind,
  type UnifiedInboxEvent,
  type UnifiedInboxPublicRecord,
} from "../services/unifiedInbox";

const router = Router();

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

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

function hasLandlordScope(record: any, landlordId: string) {
  return [record?.landlordId, record?.ownerId, record?.userId].some((value) => asString(value, 240) === landlordId);
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

async function loadCollection(name: string) {
  const snap = await db.collection(name).get().catch(() => ({ docs: [] } as any));
  return (snap?.docs || []).map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }));
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

function filterScopedRecords(records: any[], landlordId: string, propertyId: string | null) {
  return records.filter((record) => {
    if (!hasLandlordScope(record, landlordId)) return false;
    if (!propertyId) return true;
    return docPropertyId(record) === propertyId;
  });
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

    const [snapshot, leases, maintenanceRequests, messages] = await Promise.all([
      loadLandlordAnalyticsSnapshot({
        landlordId,
        propertyId: request.propertyId || undefined,
      }),
      loadCollection("leases"),
      loadCollection("maintenanceRequests"),
      loadCollection("messages"),
    ]);

    const analyticsDecisions = Array.isArray(snapshot?.decisions?.items) ? snapshot.decisions.items : [];
    const safePage = await deriveLandlordUnifiedInbox(landlordId, {
      applicationItems: filterScopedRecords(
        analyticsDecisions.filter((item: any) => asString(item?.decisionType, 120) !== "start_screening_checkout"),
        landlordId,
        request.propertyId
      ),
      screeningItems: filterScopedRecords(
        analyticsDecisions.filter((item: any) => asString(item?.decisionType, 120) === "start_screening_checkout"),
        landlordId,
        request.propertyId
      ),
      leaseItems: filterScopedRecords(leases, landlordId, request.propertyId),
      maintenanceRequests: filterScopedRecords(maintenanceRequests, landlordId, request.propertyId),
      messages: filterScopedRecords(messages, landlordId, request.propertyId),
      limit: MAX_LIMIT,
    });

    const filteredItems = applySafeFilters(safePage.items, request);
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

export default router;
