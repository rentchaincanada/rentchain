import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { PlanLimits } from "../planLimits";
import { entitlementsForPlan } from "../../services/planDefaults";
import type { AuthenticatedRequest } from "../authMiddleware";
import type { Account } from "../../types/account";

function buildApp(account: Account, deltaFactory: () => number | Promise<number>) {
  const app = express();
  app.use(express.json());

  app.use((req: AuthenticatedRequest, _res, next) => {
    req.user = { id: account.id, plan: account.plan } as any;
    req.account = { ...account };
    next();
  });

  app.post(
    "/test",
    PlanLimits([
      {
        limitType: "properties",
        delta: deltaFactory,
      },
    ]),
    (_req, res) => {
      res.json({ ok: true });
    }
  );

  return app;
}

function buildUnitsApp(account: Account, delta: (req: AuthenticatedRequest) => number | Promise<number>) {
  const app = express();
  app.use(express.json());
  app.use((req: AuthenticatedRequest, _res, next) => {
    req.user = { id: account.id, plan: account.plan } as any;
    req.account = { ...account };
    next();
  });

  app.post(
    "/units",
    PlanLimits([
      {
        limitType: "units",
        delta,
      },
    ]),
    (_req, res) => res.json({ ok: true })
  );

  return app;
}

function starterAccount(overrides?: Partial<Account>): Account {
  return {
    id: "landlord-1",
    ownerUserId: "landlord-1",
    plan: "starter",
    planStatus: "active",
    entitlements: entitlementsForPlan("starter"),
    usage: {
      properties: 0,
      units: 0,
      screeningsThisMonth: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("PlanLimits middleware", () => {
  it("blocks property create when at max properties", async () => {
    const account = starterAccount({ usage: { properties: 1, units: 0, screeningsThisMonth: 0 } });
    const app = buildApp(account, () => 1);

    const res = await request(app).post("/test").send({});
    expect(res.status).toBe(402);
    expect(res.body.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(res.body.limitType).toBe("properties");
    expect(res.body.attempted).toBe(1);
  });

  it("blocks units when at max units", async () => {
    const account = starterAccount({ usage: { properties: 0, units: 5, screeningsThisMonth: 0 } });
    const app = buildUnitsApp(account, () => 1);

    const res = await request(app).post("/units").send({});
    expect(res.status).toBe(402);
    expect(res.body.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(res.body.limitType).toBe("units");
    expect(res.body.attempted).toBe(1);
  });

  it("allows when under unit cap", async () => {
    const account = starterAccount({ usage: { properties: 0, units: 4, screeningsThisMonth: 0 } });
    const app = buildUnitsApp(account, () => 1);

    const res = await request(app).post("/units").send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("delta 0 never blocks", async () => {
    const account = starterAccount({ usage: { properties: 10, units: 999, screeningsThisMonth: 0 } });
    const app = buildUnitsApp(account, () => 0);

    const res = await request(app).post("/units").send({});
    expect(res.status).toBe(200);
  });

  it("dedupes unitNumber when counting delta", async () => {
    const account = starterAccount({ usage: { properties: 0, units: 5, screeningsThisMonth: 0 } });
    const app = buildUnitsApp(account, (req) => {
      const units = Array.isArray((req.body as any)?.units) ? (req.body as any).units : [];
      const norm = (s: any) => String(s ?? "").trim().toLowerCase();
      const set = new Set<string>();
      for (const u of units) {
        const key = norm(u?.unitNumber);
        if (key) set.add(key);
      }
      return set.size;
    });

    const res = await request(app)
      .post("/units")
      .send({ units: [{ unitNumber: "1A" }, { unitNumber: "1A" }] });
    expect(res.status).toBe(402);
    expect(res.body.attempted).toBe(1); // deduped
  });
}
);
