import express from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../config/firebase";
import { resolveLandlordAndTier } from "../lib/landlordResolver";
import { computeNoResponseState, normalizeLeaseRecord } from "../services/leaseNoticeWorkflowService";

const router = express.Router();

// Set route source header for debugging
router.use((req, res, next) => {
  res.setHeader("x-route-source", "dashboardRoutes");
  next();
});

/**
 * GET /api/dashboard/overview
 * Minimal KPIs (placeholder/zeroed for now)
 */
router.get("/overview", authenticateJwt, (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.json({
    ok: true,
    monthRent: 0,
    occupancyRate: 0,
    latePayments: 0,
    portfolioValue: 0,
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/dashboard/ai-portfolio-summary
 * Deterministic placeholder summary
 */
router.get("/ai-portfolio-summary", authenticateJwt, (_req, res) => {
  res.json({
    ok: true,
    summary:
      "Portfolio summary is not available yet. Connect data sources to enable AI insights.",
    flags: [],
    updatedAt: new Date().toISOString(),
  });
});

/**
 * POST /api/dashboard/ai-summary
 * Simple stubbed summary for now
 */
router.post("/ai-summary", authenticateJwt, (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  res.json({
    ok: true,
    summary: "Portfolio stable. No critical arrears. Two leases expiring soon.",
    bullets: ["Occupancy steady", "Monitor overdue items", "Plan renewals"],
  });
});

/**
 * GET /api/dashboard/ai-insights
 * Temporary stub — returns empty insights
 */
router.get("/ai-insights", authenticateJwt, (_req, res) => {
  res.json({
    items: [],
    generatedAt: new Date().toISOString(),
    status: "stub",
  });
});

/**
 * GET /api/dashboard/summary
 * Aggregated dashboard snapshot (safe fallbacks)
 */
router.get("/summary", requireAuth, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const now = Date.now();

  const monthDate = new Date(now);
  const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

  const timestampToMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value?.toMillis === "function") {
      try {
        return Number(value.toMillis()) || 0;
      } catch {
        return 0;
      }
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatActivity = (entry: {
    id: string;
    type: "tenant_invited" | "screening_paid" | "screening_completed" | "referral_created" | "record_added";
    occurredAt: number;
  }) => {
    const titleMap: Record<typeof entry.type, string> = {
      tenant_invited: "Tenant invited",
      screening_paid: "Screening paid",
      screening_completed: "Screening completed",
      referral_created: "Referral created",
      record_added: "Record added",
    };
    return {
      id: entry.id,
      type: entry.type,
      title: titleMap[entry.type],
      occurredAt: entry.occurredAt,
      createdAt: entry.occurredAt,
    };
  };

  const [
    propertiesSnap,
    tenantsSnap,
    invitesSnap,
    referralsSnap,
    screeningSnap,
    ledgerEventsSnap,
    leasesSnap,
    leaseNoticesSnap,
  ] = await Promise.all([
    db.collection("properties").where("landlordId", "==", landlordId).limit(200).get(),
    db.collection("tenants").where("landlordId", "==", landlordId).limit(200).get(),
    db.collection("tenantInvites").where("landlordId", "==", landlordId).limit(20).get(),
    db.collection("referrals").where("referrerLandlordId", "==", landlordId).limit(20).get(),
    db.collection("screeningOrders").where("landlordId", "==", landlordId).limit(30).get(),
    db.collection("ledgerEvents").where("landlordId", "==", landlordId).limit(20).get(),
    db.collection("leases").where("landlordId", "==", landlordId).limit(400).get(),
    db.collection("leaseNotices").where("landlordId", "==", landlordId).limit(400).get(),
  ]);

  const properties = propertiesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const unitsCount = properties.reduce((sum, property) => {
    const units = Array.isArray(property?.units) ? property.units.length : 0;
    return sum + units;
  }, 0);

  const screeningOrders = screeningSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const screeningsCount = screeningOrders.length;

  const recentActivityRaw: Array<{
    id: string;
    type: "tenant_invited" | "screening_paid" | "screening_completed" | "referral_created" | "record_added";
    occurredAt: number;
  }> = [];

  invitesSnap.docs.forEach((doc) => {
    const data = doc.data() as any;
    const occurredAt = timestampToMillis(data?.createdAt);
    if (!occurredAt) return;
    recentActivityRaw.push({
      id: `invite:${doc.id}`,
      type: "tenant_invited",
      occurredAt,
    });
  });

  referralsSnap.docs.forEach((doc) => {
    const data = doc.data() as any;
    const occurredAt = timestampToMillis(data?.createdAt);
    if (!occurredAt) return;
    recentActivityRaw.push({
      id: `referral:${doc.id}`,
      type: "referral_created",
      occurredAt,
    });
  });

  ledgerEventsSnap.docs.forEach((doc) => {
    const data = doc.data() as any;
    const occurredAt = timestampToMillis(data?.createdAt || data?.occurredAt);
    if (!occurredAt) return;
    recentActivityRaw.push({
      id: `ledger:${doc.id}`,
      type: "record_added",
      occurredAt,
    });
  });

  screeningOrders.forEach((order) => {
    const status = String(order?.status || "").toLowerCase();
    const paidAt = timestampToMillis(order?.paidAt || order?.updatedAt || order?.createdAt);
    const completedAt = timestampToMillis(
      order?.completedAt || order?.generatedAt || order?.updatedAt || order?.createdAt
    );
    const paymentStatus = String(order?.paymentStatus || "").toLowerCase();
    if ((paymentStatus === "paid" || status === "paid" || status === "completed") && paidAt) {
      recentActivityRaw.push({
        id: `screening-paid:${order.id}`,
        type: "screening_paid",
        occurredAt: paidAt,
      });
    }
    if ((status === "completed" || status === "report_ready") && completedAt) {
      recentActivityRaw.push({
        id: `screening-complete:${order.id}`,
        type: "screening_completed",
        occurredAt: completedAt,
      });
    }
  });

  const currentLeaseStatuses = new Set([
    "active",
    "notice_pending",
    "renewal_pending",
    "renewal_accepted",
    "move_out_pending",
  ]);
  const leases = leasesSnap.docs
    .map((doc) => normalizeLeaseRecord(doc.id, doc.data() as any))
    .filter((lease) => currentLeaseStatuses.has(String(lease.status || "").toLowerCase()));
  const leaseNotices = leaseNoticesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const latestNoticeByLeaseId = new Map<string, any>();
  for (const notice of leaseNotices.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))) {
    const leaseId = String(notice.leaseId || "").trim();
    if (!leaseId || latestNoticeByLeaseId.has(leaseId)) continue;
    latestNoticeByLeaseId.set(leaseId, notice);
  }
  const soonWindowMs = 120 * 24 * 60 * 60 * 1000;
  const leaseNoticeSummary = {
    expiringSoon: leases.filter((lease) => {
      const dueAt = Number(lease.nextNoticeDueAt || 0);
      return dueAt > 0 && dueAt <= now + soonWindowMs;
    }).length,
    pendingResponse: 0,
    renewed: 0,
    quitting: 0,
    noResponse: 0,
  };
  latestNoticeByLeaseId.forEach((notice, leaseId) => {
    const response = String(notice?.tenantResponse || "pending").trim().toLowerCase();
    const lease = leases.find((row) => row.id === leaseId) || null;
    const noResponse = computeNoResponseState(notice);
    if (noResponse) {
      leaseNoticeSummary.noResponse += 1;
      return;
    }
    if (response === "pending") {
      leaseNoticeSummary.pendingResponse += 1;
      return;
    }
    if (response === "renew" || String(lease?.status || "") === "renewal_accepted") {
      leaseNoticeSummary.renewed += 1;
      return;
    }
    if (response === "quit" || String(lease?.status || "") === "move_out_pending") {
      leaseNoticeSummary.quitting += 1;
    }
  });

  recentActivityRaw.sort((a, b) => b.occurredAt - a.occurredAt);
  const events = recentActivityRaw.slice(0, 5).map(formatActivity);

  const tierResolved = await resolveLandlordAndTier(req.user);
  const tier = tierResolved.tier;
  const isStarter = tier === "starter";

  const actions: Array<{ id: string; title: string; severity: "info"; href: string }> = [];
  if (isStarter) {
    actions.push({
      id: "upgrade-pro",
      title: "Upgrade to Pro to unlock screening",
      severity: "info",
      href: "/billing",
    });
  } else {
    if (screeningsCount === 0) {
      actions.push({
        id: "run-first-screening",
        title: "Run your first screening",
        severity: "info",
        href: "/applications",
      });
    }
    if (tenantsSnap.empty) {
      actions.push({
        id: "invite-tenant",
        title: "Invite a tenant",
        severity: "info",
        href: "/tenants",
      });
    }
    if (propertiesSnap.empty) {
      actions.push({
        id: "add-property",
        title: "Add a property",
        severity: "info",
        href: "/properties",
      });
    }
  }

  const data = {
    kpis: {
      propertiesCount: propertiesSnap.size,
      unitsCount,
      tenantsCount: tenantsSnap.size,
      openActionsCount: actions.length,
      delinquentCount: 0,
      screeningsCount,
    },
    rent: {
      month,
      collectedCents: 0,
      expectedCents: 0,
      delinquentCents: 0,
    },
    actions,
    properties: [] as any[],
    events,
    leaseNoticeSummary,
  };

  return res.json({ ok: true, data });
});

export default router;
