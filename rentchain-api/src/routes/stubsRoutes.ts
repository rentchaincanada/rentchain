import { Router } from "express";

const r = Router();
const STUBS_ENABLED = String(process.env.STUBS_ENABLED || "").toLowerCase() === "true";

if (!STUBS_ENABLED) {
  r.all("*", (_req, res) => res.status(404).json({ ok: false, error: "Not Found" }));
  export default r;
}

// blockchain verify
r.get("/blockchain/verify", (_req, res) =>
  res.json({ ok: true, enabled: false, status: "disabled" })
);

// billing
r.post("/billing/upgrade-intent", (req, res) =>
  res.json({ ok: true, received: req.body || null })
);
r.get("/landlord/billing/usage", (_req, res) =>
  res.json({ ok: true, usage: { screeningCreditsUsed: 0, period: "month" } })
);

// action requests (support both GET+POST because your FE is POSTing counts)
r.get("/action-requests", (req, res) =>
  res.json({ ok: true, items: [], propertyId: req.query.propertyId || null })
);
r.get("/action-requests/counts", (_req, res) =>
  res.json({ ok: true, counts: { overdue: 0, expiringLeases: 0, tasks: 0 } })
);
r.post("/action-requests/counts", (_req, res) =>
  res.json({ ok: true, counts: { overdue: 0, expiringLeases: 0, tasks: 0 } })
);

// tenant analytics-style routes
r.get("/tenants/:tenantId/reputation/timeline", (_req, res) =>
  res.json({ ok: true, items: [] })
);
r.get("/ledger/summary", (req, res) =>
  res.json({ ok: true, tenantId: req.query.tenantId || null, summary: {} })
);
r.get("/landlord/tenants/:tenantId/credit-history", (_req, res) =>
  res.json({ ok: true, items: [] })
);
r.get("/landlord/reporting/status", (req, res) =>
  res.json({ ok: true, tenantId: req.query.tenantId || null, status: "unknown" })
);

export default r;
