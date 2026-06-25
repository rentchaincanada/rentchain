import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import { deriveLeaseDecisionsForInbox, derivePaymentConsistentDecisionInbox } from "./landlordDecisionInboxRoutes";
import { getUnifiedInbox } from "../services/unifiedInbox";
import {
  deriveLandlordDecisionQueue,
  type LandlordDecisionQueueItem,
  type LandlordDecisionQueueSeverity,
  type LandlordDecisionQueueStatus,
  type LandlordDecisionQueueWorkspace,
} from "../services/landlordDecisionQueue";

const router = Router();

const ROUTE_VERSION = "landlord-decision-queue-api-v1";
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

const SEVERITIES = new Set<LandlordDecisionQueueSeverity>([
  "critical",
  "warning",
  "needs_review",
  "upcoming",
  "informational",
]);
const WORKSPACES = new Set<LandlordDecisionQueueWorkspace>([
  "dashboard",
  "operations",
  "tenant",
  "lease",
  "property",
  "maintenance",
  "payments",
  "notices",
  "evidence_compliance",
]);
const STATUSES = new Set<LandlordDecisionQueueStatus>(["open", "pending", "blocked", "resolved", "dismissed"]);

router.use((_req, res, next) => {
  res.setHeader("x-landlord-decision-queue-route-version", ROUTE_VERSION);
  next();
});

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeFilter<T extends string>(value: unknown, known: Set<T>): T | null {
  const raw = asString(value, 80).toLowerCase().replace(/-/g, "_");
  if (!raw || raw === "all") return null;
  return known.has(raw as T) ? (raw as T) : null;
}

function parseLimit(value: unknown): number {
  if (value == null || value === "") return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function applyFilters(
  items: LandlordDecisionQueueItem[],
  filters: {
    severity: LandlordDecisionQueueSeverity | null;
    workspace: LandlordDecisionQueueWorkspace | null;
    status: LandlordDecisionQueueStatus | "open_state" | null;
  }
) {
  return items.filter((item) => {
    if (filters.severity && item.severity !== filters.severity) return false;
    if (filters.workspace && item.workspace !== filters.workspace) return false;
    if (filters.status === "open_state" && (item.status === "resolved" || item.status === "dismissed")) return false;
    if (filters.status && filters.status !== "open_state" && item.status !== filters.status) return false;
    return true;
  });
}

router.get("/decision-queue", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const [snapshot, leaseDecisions, unifiedInbox] = await Promise.all([
      loadLandlordAnalyticsSnapshot({
        landlordId,
        period: req.query?.period,
        propertyId: req.query?.propertyId,
      }),
      deriveLeaseDecisionsForInbox(landlordId),
      getUnifiedInbox({ role: "landlord", landlordId }, { limit: MAX_LIMIT }),
    ]);

    const decisionInbox = await derivePaymentConsistentDecisionInbox({
      landlordId,
      analyticsDecisions: Array.isArray(snapshot?.decisions?.items) ? snapshot.decisions.items : [],
      leaseDecisions,
    });

    const queue = deriveLandlordDecisionQueue({
      landlordId,
      decisionInboxItems: decisionInbox.items,
      unifiedInboxRecords: unifiedInbox.items,
    });

    const statusRaw = asString(req.query?.status ?? req.query?.open, 80).toLowerCase();
    const status =
      statusRaw === "true" || statusRaw === "open_state"
        ? "open_state"
        : normalizeFilter(req.query?.status, STATUSES);
    const filteredItems = applyFilters(queue.items, {
      severity: normalizeFilter(req.query?.severity, SEVERITIES),
      workspace: normalizeFilter(req.query?.workspace, WORKSPACES),
      status,
    });
    const limit = parseLimit(req.query?.limit);
    const items = filteredItems.slice(0, limit);

    return res.json({
      ok: true,
      ...queue,
      items,
      total: filteredItems.length,
      limit,
      filters: {
        severity: normalizeFilter(req.query?.severity, SEVERITIES),
        workspace: normalizeFilter(req.query?.workspace, WORKSPACES),
        status,
      },
    });
  } catch (err: any) {
    console.error("[landlord-decision-queue] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_QUEUE_FAILED" });
  }
});

export default router;
