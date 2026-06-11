import { Router, type NextFunction, type Request, type Response } from "express";
import { db } from "../firebase";
import { requireContractor } from "../middleware/requireContractor";
import {
  deriveContractorUnifiedInbox,
  toPublicInboxRecord,
  type SourceKind,
  type UnifiedInboxEvent,
} from "../services/unifiedInbox";
import {
  createContractorPortalMessage,
  getContractorPortalProfile,
  getContractorPortalWorkOrder,
  listContractorPortalMessages,
  listContractorPortalWorkOrders,
  updateContractorPortalProfile,
  updateContractorPortalWorkOrderStatus,
} from "../services/contractorPortalService";

const router = Router();
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

type ContractorInboxRequest = {
  limit: number;
  offset: number;
  source: SourceKind | null;
  dateFrom: string | null;
  dateTo: string | null;
};

type ValidationResult =
  | { ok: true; value: ContractorInboxRequest }
  | { ok: false; status: number; error: string; message: string };

const INBOX_SOURCE_MAP: Record<string, SourceKind> = {
  maintenance: "contractor.work_order",
  work_order: "contractor.work_order",
  "work-order": "contractor.work_order",
  workorder: "contractor.work_order",
  "contractor.work_order": "contractor.work_order",
  message: "contractor.message",
  "contractor.message": "contractor.message",
};

function asString(value: unknown, max = 1000): string {
  return String(value || "").trim().slice(0, max);
}

function isAdmin(req: any) {
  return asString(req.user?.actorRole || req.user?.role, 40).toLowerCase() === "admin";
}

function contractorIdFromUser(req: any) {
  return asString(req.user?.contractorId || req.user?.id, 160);
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

function validateInboxQuery(query: any): ValidationResult {
  const limit = parseInteger(query?.limit, DEFAULT_LIMIT);
  if (limit == null || limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, status: 400, error: "INVALID_LIMIT", message: "limit must be an integer between 1 and 100" };
  }

  const offset = parseInteger(query?.offset, 0);
  if (offset == null || offset < 0) {
    return { ok: false, status: 400, error: "INVALID_OFFSET", message: "offset must be a non-negative integer" };
  }

  const sourceRaw = asString(query?.source, 80).toLowerCase();
  const source = sourceRaw ? INBOX_SOURCE_MAP[sourceRaw] : null;
  if (sourceRaw && !source) {
    return {
      ok: false,
      status: 400,
      error: "INVALID_SOURCE",
      message: "source must be one of maintenance, work_order, or message",
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
    return { ok: false, status: 400, error: "INVALID_DATE_RANGE", message: "dateFrom must be earlier than dateTo" };
  }

  return { ok: true, value: { limit, offset, source, dateFrom, dateTo } };
}

function requireContractorInboxIdentity(req: Request, res: Response, next: NextFunction) {
  const role = asString((req as any).user?.role || (req as any).user?.actorRole, 80).toLowerCase();
  if (role !== "contractor") {
    return res.status(403).json({ ok: false, error: "FORBIDDEN", message: "Contractor role is required" });
  }
  if (!contractorIdFromUser(req)) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN", message: "Contractor identity is required" });
  }
  return next();
}

async function loadCollection(name: string) {
  const snap = await db.collection(name).get().catch(() => ({ docs: [] } as any));
  return (snap?.docs || []).map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }));
}

function recordContractorId(record: any) {
  return asString(record?.assignedContractorId || record?.contractorId || record?.recipientContractorId, 160);
}

function filterContractorScopedRecords(records: any[], contractorId: string) {
  return records.filter((record) => recordContractorId(record) === contractorId);
}

function matchesInboxDateRange(item: UnifiedInboxEvent, request: ContractorInboxRequest) {
  const occurredAt = Date.parse(item.occurredAt);
  if (!Number.isFinite(occurredAt)) return false;
  if (request.dateFrom && occurredAt < Date.parse(request.dateFrom)) return false;
  if (request.dateTo && occurredAt > Date.parse(request.dateTo)) return false;
  return true;
}

function applyInboxFilters(items: UnifiedInboxEvent[], request: ContractorInboxRequest) {
  return items.filter((item) => {
    if (request.source && item.sourceKind !== request.source) return false;
    return matchesInboxDateRange(item, request);
  });
}

function hasCrossContractorScopeAttempt(query: any, contractorId: string) {
  const requestedContractorId = asString(query?.contractorId, 160);
  const requestedScopeKey = asString(query?.contractorScopeKey || query?.audienceScopeKey, 240);
  if (requestedContractorId && requestedContractorId !== contractorId) return true;
  if (requestedScopeKey && requestedScopeKey !== contractorId) return true;
  return false;
}

function ensureSelf(req: any, res: any): string | null {
  const requested = asString(req.params?.contractorId, 160);
  const current = contractorIdFromUser(req);
  if (!requested || !current) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  if (!isAdmin(req) && requested !== current) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return requested;
}

router.get("/contractor/inbox", requireContractor, requireContractorInboxIdentity, async (req: Request, res: Response) => {
  try {
    const contractorId = contractorIdFromUser(req);
    const parsed = validateInboxQuery(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ ok: false, error: parsed.error, message: parsed.message });
    }
    if (hasCrossContractorScopeAttempt(req.query, contractorId)) {
      return res.status(403).json({ ok: false, error: "CONTRACTOR_SCOPE_FORBIDDEN", message: "Contractor scope is not available" });
    }

    const [workOrders, messages] = await Promise.all([
      loadCollection("workOrders"),
      loadCollection("contractorMessages"),
    ]);

    const request = parsed.value;
    const safePage = await deriveContractorUnifiedInbox(contractorId, {
      workOrders: filterContractorScopedRecords(workOrders, contractorId),
      messages: filterContractorScopedRecords(messages, contractorId),
      limit: MAX_LIMIT,
    });
    const filteredItems = applyInboxFilters(safePage.items, request);
    const items = filteredItems.slice(request.offset, request.offset + request.limit).map(toPublicInboxRecord);

    return res.json({
      ok: true,
      items,
      total: filteredItems.length,
      limit: request.limit,
      offset: request.offset,
    });
  } catch (err: any) {
    console.error("[contractor-unified-inbox] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INBOX_FAILED", message: "Unable to load inbox" });
  }
});

router.get("/contractors/:contractorId/work-orders", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const items = await listContractorPortalWorkOrders(contractorId, asString(req.query?.status, 80));
    return res.json({ ok: true, items, data: items });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_work_orders_failed" });
  }
});

router.get("/contractors/:contractorId/work-orders/:workOrderId", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const item = await getContractorPortalWorkOrder(contractorId, asString(req.params?.workOrderId, 160));
    if (!item) return res.status(404).json({ ok: false, error: "work_order_not_found" });
    return res.json({ ok: true, item, data: item });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_work_order_failed" });
  }
});

router.patch("/contractors/:contractorId/work-orders/:workOrderId/status", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const result = await updateContractorPortalWorkOrderStatus({
      contractorId,
      actorId: asString(req.user?.id, 160) || contractorId,
      workOrderId: asString(req.params?.workOrderId, 160),
      status: asString(req.body?.status, 80),
      message: asString(req.body?.message || req.body?.note, 1000),
    });
    if (!result.ok && result.code === "not_found") return res.status(404).json({ ok: false, error: "work_order_not_found" });
    if (!result.ok && result.code === "invalid_transition") {
      return res.status(400).json({ ok: false, error: "invalid_status_transition" });
    }
    if (!result.ok) return res.status(400).json({ ok: false, error: "invalid_status" });
    return res.json({ ok: true, item: result.item, data: result.item });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_status_update_failed" });
  }
});

router.get("/contractors/:contractorId/messages", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const items = await listContractorPortalMessages(contractorId, asString(req.query?.workOrderId, 160));
    return res.json({ ok: true, items, data: items });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_messages_failed" });
  }
});

router.post("/contractors/:contractorId/messages", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const result = await createContractorPortalMessage({
      contractorId,
      actorId: asString(req.user?.id, 160) || contractorId,
      workOrderId: asString(req.body?.workOrderId, 160),
      landlordId: asString(req.body?.landlordId, 160),
      text: asString(req.body?.text, 2000),
    });
    if (!result.ok && result.code === "not_found") return res.status(404).json({ ok: false, error: "work_order_not_found" });
    if (!result.ok && result.code === "forbidden") return res.status(403).json({ ok: false, error: "forbidden" });
    if (!result.ok) return res.status(400).json({ ok: false, error: "invalid_message" });
    return res.status(201).json({ ok: true, message: result.message });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_message_create_failed" });
  }
});

router.get("/contractors/:contractorId/profile", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const profile = await getContractorPortalProfile(contractorId);
    return res.json({ ok: true, profile });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_profile_failed" });
  }
});

router.patch("/contractors/:contractorId/profile", requireContractor, async (req: any, res) => {
  try {
    const contractorId = ensureSelf(req, res);
    if (!contractorId) return;
    const profile = await updateContractorPortalProfile(contractorId, req.body || {});
    return res.json({ ok: true, profile });
  } catch {
    return res.status(500).json({ ok: false, error: "contractor_profile_update_failed" });
  }
});

export default router;
