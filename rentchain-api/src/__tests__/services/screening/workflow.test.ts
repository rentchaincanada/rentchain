import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, upsertDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensure(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function docRef(collectionName: string, id: string) {
    const col = ensure(collectionName);
    return {
      id,
      get: async () => {
        const entry = col.get(id);
        return { id, exists: Boolean(entry), data: () => entry?.data };
      },
      set: async (data: any, options?: { merge?: boolean }) => {
        if (options?.merge && col.has(id)) {
          col.set(id, { id, data: { ...col.get(id)!.data, ...data } });
        } else {
          col.set(id, { id, data });
        }
      },
    };
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id: string) => docRef(name, id),
      where: (field: string, op: string, value: any) => ({
        get: async () => {
          const docs = Array.from(ensure(name).values())
            .filter((entry) => op === "==" && entry.data?.[field] === value)
            .map((entry) => ({ id: entry.id, data: () => entry.data }));
          return { docs, empty: docs.length === 0 };
        },
      }),
    }),
  };

  return {
    dbMock,
    resetDb: () => collections.clear(),
    upsertDoc: (collectionName: string, id: string, data: any) => ensure(collectionName).set(id, { id, data }),
  };
});

vi.mock("../../../firebase", () => ({ db: dbMock }));

describe("provider-neutral screening workflow services", () => {
  beforeEach(() => {
    resetDb();
    upsertDoc("units", "unit-1", { landlordId: "landlord-1" });
  });

  it("grants consent and creates a landlord-owned screening request", async () => {
    const { ScreeningConsentService, ScreeningRequestService } = await import("../../../services/screening/providerNeutralWorkflowService");
    const consentService = new ScreeningConsentService();
    const requestService = new ScreeningRequestService(consentService);

    const consent = await consentService.grantConsent({
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      unitId: "unit-1",
      actorTenantId: "tenant-1",
    });

    const request = await requestService.initiateScreening({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      consentId: consent.id,
    });

    expect(request.status).toBe("pending");
    expect(request.consentId).toBe(consent.id);
    expect(request.auditLog[0].action).toBe("request_created");
  });

  it("rejects cross-landlord request creation", async () => {
    const { ScreeningConsentService, ScreeningRequestService } = await import("../../../services/screening/providerNeutralWorkflowService");
    const consentService = new ScreeningConsentService();
    const requestService = new ScreeningRequestService(consentService);
    const consent = await consentService.grantConsent({
      tenantId: "tenant-1",
      landlordId: "landlord-2",
      unitId: "unit-1",
      actorTenantId: "tenant-1",
    });

    await expect(
      requestService.initiateScreening({
        landlordId: "landlord-2",
        tenantId: "tenant-1",
        unitId: "unit-1",
        consentId: consent.id,
      }),
    ).rejects.toMatchObject({ code: "UNIT_FORBIDDEN" });
  });

  it("records provider results and safe projections", async () => {
    const workflow = await import("../../../services/screening/providerNeutralWorkflowService");
    const consentService = new workflow.ScreeningConsentService();
    const requestService = new workflow.ScreeningRequestService(consentService);
    const resultService = new workflow.ScreeningResultService(requestService);
    const consent = await consentService.grantConsent({
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      unitId: "unit-1",
      actorTenantId: "tenant-1",
    });
    const request = await requestService.initiateScreening({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      consentId: consent.id,
      providerId: "test-provider",
    });

    const result = await resultService.recordResult({
      providerId: "test-provider",
      payload: { requestId: request.id, secret: "not exposed" },
      parsed: {
        requestId: request.id,
        status: "completed",
        riskScore: 42,
        decisionRecommendation: "review_needed",
        summary: "review recommended",
        flags: ["income_review"],
      },
    });

    expect(result.payloadDigest).toHaveLength(64);
    expect(workflow.projectResult(result)).toEqual({
      requestId: request.id,
      riskScore: 42,
      decisionRecommendation: "review_needed",
      summary: "review recommended",
      flags: ["income_review"],
    });
  });
});
