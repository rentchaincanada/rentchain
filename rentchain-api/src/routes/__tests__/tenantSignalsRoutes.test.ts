import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUser: { id: "landlord-1", landlordId: "landlord-1" } as any,
  listLedgerEventsV2: vi.fn(),
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.user = mocks.authenticatedUser;
    next();
  },
}));

vi.mock("../../services/ledgerEventsFirestoreService", () => ({
  listLedgerEventsV2: mocks.listLedgerEventsV2,
}));

import tenantSignalsRoutes from "../tenantSignalsRoutes";

function createApp() {
  const app = express();
  app.use(tenantSignalsRoutes);
  return app;
}

describe("tenantSignalsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser = { id: "landlord-1", landlordId: "landlord-1" };
    mocks.listLedgerEventsV2.mockResolvedValue({ items: [] });
  });

  it("returns neutral signals for an authorized tenant with no ledger history", async () => {
    const response = await request(createApp()).get("/tenants/tenant-1/signals");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      signals: expect.objectContaining({
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        riskLevel: "LOW",
        latePaymentsCount: 0,
        nsfCount: 0,
        missedPaymentsCount: 0,
        evictionNoticeCount: 0,
        positiveNotesCount: 0,
        lastEventAt: null,
      }),
    });
  });

  it("computes signals from populated ledger history", async () => {
    mocks.listLedgerEventsV2.mockResolvedValue({
      items: [
        {
          id: "ledger-1",
          title: "Late rent payment",
          summary: "Returned payment NSF",
          eventType: "STATUS_CHANGED",
          occurredAt: 1_725_000_000_000,
          tags: ["late"],
        },
      ],
    });

    const response = await request(createApp()).get("/tenants/tenant-1/signals");

    expect(response.status).toBe(200);
    expect(response.body.signals).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        latePaymentsCount: 1,
        nsfCount: 1,
        riskLevel: "MEDIUM",
        lastEventAt: 1_725_000_000_000,
      })
    );
  });

  it("returns a bounded observable error when the ledger query rejects", async () => {
    const queryError = new Error("FAILED_PRECONDITION: query requires an index");
    mocks.listLedgerEventsV2.mockRejectedValue(queryError);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(createApp()).get("/tenants/tenant-1/signals");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ ok: false, error: "Failed to load tenant signals" });
    expect(errorSpy).toHaveBeenCalledWith(
      "[tenant-signals GET /tenants/:tenantId/signals] error",
      queryError
    );
    errorSpy.mockRestore();
  });

  it("preserves authorization behavior", async () => {
    mocks.authenticatedUser = null;

    const response = await request(createApp()).get("/tenants/tenant-1/signals");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.listLedgerEventsV2).not.toHaveBeenCalled();
  });
});
