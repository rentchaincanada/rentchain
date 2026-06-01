import { beforeEach, describe, expect, it, vi } from "vitest";
import { workflowKey } from "../../services/recovery/recoveryShared";
import {
  DECISION_CONTINUITY_SNAPSHOTS_COLLECTION,
  OPERATOR_RECOVERY_LOGS_COLLECTION,
  RECOVERY_TIMELINE_COLLECTION,
} from "../../services/recovery/recoveryStore";

const { collections, dbMock } = vi.hoisted(() => {
  type StoredRecord = Record<string, unknown>;
  type Clause = { field: string; value: unknown };
  const collections = new Map<string, Map<string, StoredRecord>>();

  function ensure(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function collection(name: string, clauses: Clause[] = [], limitCount?: number) {
    return {
      doc(id = `doc-${ensure(name).size + 1}`) {
        return {
          async get() {
            return {
              id,
              exists: ensure(name).has(id),
              data: () => ensure(name).get(id),
            };
          },
          async set(data: StoredRecord) {
            ensure(name).set(id, data);
          },
          async create(data: StoredRecord) {
            if (ensure(name).has(id)) throw new Error("already_exists");
            ensure(name).set(id, data);
          },
        };
      },
      where(field: string, _op: string, value: unknown) {
        return collection(name, [...clauses, { field, value }], limitCount);
      },
      orderBy() {
        return collection(name, clauses, limitCount);
      },
      limit(count: number) {
        return collection(name, clauses, count);
      },
      async get() {
        const docs = Array.from(ensure(name).entries())
          .filter(([, data]) => clauses.every((clause) => data[clause.field] === clause.value))
          .slice(0, limitCount || Number.MAX_SAFE_INTEGER)
          .map(([id, data]) => ({ id, data: () => data }));
        return { docs };
      },
    };
  }

  return {
    collections,
    dbMock: {
      collection(name: string) {
        return collection(name);
      },
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: unknown }, res: { status: (code: number) => { json: (payload: unknown) => unknown } }, next: () => unknown) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

function seed(collection: string, id: string, data: Record<string, unknown>) {
  if (!collections.has(collection)) collections.set(collection, new Map());
  collections.get(collection)!.set(id, data);
}

async function invokeRouter(
  router: { handle: (req: unknown, res: unknown, next: (error?: unknown) => void) => void },
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: Record<string, unknown> }
) {
  return await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      params: {},
      body: options.body || {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase() as keyof typeof this.headers];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: Record<string, unknown>) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: Record<string, unknown>) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error?: unknown) => {
      if (error) reject(error);
    });
  });
}

describe("adminRecoveryRoutes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("inspects workflow divergence for admin operators only", async () => {
    const router = (await import("../adminRecoveryRoutes")).default;
    const key = workflowKey("decision", "decision-route-1");
    seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, key, {
      workflowType: "decision",
      workflowId: "decision-route-1",
      state: "Reviewed",
    });
    seed(RECOVERY_TIMELINE_COLLECTION, "timeline-route-1", {
      workflowInstanceKey: key,
      state: "Appeared",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const forbidden = await invokeRouter(router, {
      method: "POST",
      url: "/recovery/inspect",
      user: { id: "tenant-1", role: "tenant" },
      body: { workflowType: "decision", workflowId: "decision-route-1" },
    });
    expect(forbidden.status).toBe(403);

    const inspected = await invokeRouter(router, {
      method: "POST",
      url: "/recovery/inspect",
      user: { id: "admin-1", role: "admin" },
      body: { workflowType: "decision", workflowId: "decision-route-1" },
    });
    expect(inspected.status).toBe(200);
    expect(inspected.body.reconciliation).toMatchObject({
      workflowInstanceKey: key,
      divergenceType: "METADATA_DIVERGENCE",
      proposedDecision: "ACCEPT_CANONICAL",
    });
    expect(JSON.stringify(inspected.body)).not.toContain("decision-route-1");
  });

  it("returns safe degraded recovery diagnostics for unsafe lease references", async () => {
    const router = (await import("../adminRecoveryRoutes")).default;

    const inspected = await invokeRouter(router, {
      method: "POST",
      url: "/recovery/inspect",
      user: { id: "admin-1", role: "admin" },
      body: { workflowType: "lease", workflowId: "leases/raw-lease-1" },
    });

    expect(inspected.status).toBe(200);
    expect(inspected.body).toMatchObject({
      ok: true,
      degraded: true,
      degradedReason: "invalid_workflow_reference",
      reconciliation: {
        workflowType: "lease",
        divergenceType: "NONE",
        proposedDecision: "NO_ACTION",
        reasonCode: "NO_RECOVERY_REQUIRED",
        manualReviewRequired: false,
      },
    });
    expect(JSON.stringify(inspected.body)).not.toContain("raw-lease-1");
  });

  it("reconciles by append-only recovery log and exposes logs safely", async () => {
    const router = (await import("../adminRecoveryRoutes")).default;
    const key = workflowKey("payment", "payment-route-1");
    seed(DECISION_CONTINUITY_SNAPSHOTS_COLLECTION, key, {
      workflowType: "payment",
      workflowId: "payment-route-1",
      state: "Failed",
    });
    seed(RECOVERY_TIMELINE_COLLECTION, "timeline-route-1", {
      workflowInstanceKey: key,
      state: "Confirmed",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const reconciled = await invokeRouter(router, {
      method: "POST",
      url: "/recovery/reconcile",
      user: { id: "support-1", role: "support" },
      body: {
        workflowType: "payment",
        workflowId: "payment-route-1",
        decisionType: "ACCEPT_CANONICAL",
        reasonCode: "PAYMENT_STATE_CONFIRMED",
        reason: "Payment state confirmed from canonical review timeline.",
      },
    });
    expect(reconciled.status).toBe(201);
    expect(reconciled.body.recoveryLog).toMatchObject({
      workflowInstanceKey: key,
      rawIdsIncluded: false,
      appendOnly: true,
    });

    const listed = await invokeRouter(router, {
      method: "GET",
      url: "/recovery/logs",
      user: { id: "admin-1", role: "admin" },
    });
    expect(listed.status).toBe(200);
    expect(listed.body.logs).toHaveLength(1);
    expect(collections.get(OPERATOR_RECOVERY_LOGS_COLLECTION)?.size).toBe(1);
  });
});
