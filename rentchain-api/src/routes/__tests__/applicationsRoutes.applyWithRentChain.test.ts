import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPLICATIONS } from "../../services/applicationsService";

const writeCanonicalEvent = vi.fn().mockResolvedValue(undefined);

vi.mock("../../lib/events/buildEvent", () => ({
  writeCanonicalEvent,
}));

async function invokeRouter(router: any, options: { method: string; url: string; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      params: {},
      query: {},
      body: options.body || {},
      headers: {},
    };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

function buildPayload(overrides: Record<string, any> = {}) {
  return {
    propertyId: "public-apply",
    propertyName: "Tenant Application",
    unit: "12B",
    unitApplied: "12B",
    leaseStartDate: "2026-06-01",
    requestedRent: 0,
    primaryApplicant: {
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan@example.com",
      phone: "5551112222",
      dateOfBirth: "1990-01-01",
      recentAddress: {
        streetNumber: "123",
        streetName: "King St",
        city: "Halifax",
        province: "NS",
        postalCode: "B3H1A1",
      },
    },
    creditConsent: true,
    applicantProfile: {
      currentAddress: {
        line1: "123 King St",
        city: "Halifax",
        provinceState: "NS",
        postalCode: "B3H1A1",
        country: "CA",
      },
      timeAtCurrentAddressMonths: 12,
      currentRentAmountCents: 180000,
      employment: {
        employerName: "Harbour Labs",
        jobTitle: "Designer",
        incomeAmountCents: 720000,
        incomeFrequency: "monthly",
        monthsAtJob: 12,
      },
      workReference: {
        name: "Taylor Grant",
        phone: "5550001111",
      },
      signature: {
        type: "typed",
        typedName: "Jordan Lee",
        typedAcknowledge: true,
        signedAt: "2026-04-27T12:00:00.000Z",
      },
    },
    applicationConsent: {
      version: "v1.0",
      accepted: true,
      acceptedAt: "2026-04-27T12:00:00.000Z",
    },
    ...overrides,
  };
}

describe("applicationsRoutes apply with RentChain metadata", () => {
  beforeEach(() => {
    APPLICATIONS.splice(0, APPLICATIONS.length);
    vi.clearAllMocks();
  });

  it("stores only safe apply-with-rentchain source metadata", async () => {
    const router = (await import("../applicationsRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/submit",
      body: buildPayload({
        applicationSource: "apply_with_rentchain",
        identityReference: {
          source: "rentchain",
          referenceType: "tenant_identity_reference",
          referenceStatus: "available",
        },
        approvedScopeKeys: [
          "identity_summary",
          "application_summary",
          "documents_summary",
          "bad_scope",
        ],
        shareToken: "should-not-store",
      }),
    });

    expect(res.status).toBe(201);
    expect(res.body?.applicationSource).toBe("apply_with_rentchain");
    expect(res.body?.identityReference).toEqual({
      source: "rentchain",
      referenceType: "tenant_identity_reference",
      referenceStatus: "available",
    });
    expect(res.body?.approvedScopeKeys).toEqual([
      "identity_summary",
      "application_summary",
      "documents_summary",
    ]);
    expect(res.body?.shareToken).toBeUndefined();
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "apply_with_rentchain",
        }),
      })
    );
  });
});
