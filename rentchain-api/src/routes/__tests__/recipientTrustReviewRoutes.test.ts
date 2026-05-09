import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function clone(value: any) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

const dbMock = {
  collection: (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `doc_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        async get() {
          const entry = ensureCollection(name).get(docId);
          return {
            id: docId,
            exists: Boolean(entry),
            data: () => clone(entry),
          };
        },
        async set(value: any, opts?: { merge?: boolean }) {
          const current = ensureCollection(name).get(docId) || {};
          ensureCollection(name).set(docId, opts?.merge ? { ...current, ...(value || {}) } : clone(value));
        },
      };
    },
  }),
};

vi.mock("../../config/firebase", () => ({ db: dbMock }));
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (!header) return res.status(401).json({ ok: false, error: "unauthenticated" });
    req.user = JSON.parse(header);
    return next();
  },
}));

async function invokeRouter(router: any, options: { method: string; url: string; headers?: Record<string, string> }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      params: {},
      headers: options.headers || {},
    };
    const match = options.url.match(/^\/trust-reviews\/([^/?#]+)/);
    if (match) req.params.grantId = decodeURIComponent(match[1]);
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
    };
    router.handle(req, res, reject);
  });
}

function seedGrant(patch: Record<string, any> = {}) {
  const grant = {
    grantId: "grant-1",
    tenantId: "tenant-1",
    schemaVersion: "tenant_institution_access.v1",
    audience: "insurer",
    purpose: "insurance_review",
    lifecycle: "active",
    recipient: {
      email: "reviewer@example.com",
      displayName: "Reviewer",
      organizationName: "Example Insurance",
      authenticationRequirement: "recipient_email_session_required",
    },
    consent: {
      required: true,
      granted: true,
      consentId: "consent-1",
      consentVersion: "tenant_institution_access_consent.v1",
      grantedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-06-01T00:00:00.000Z",
      revokedAt: null,
      audience: "insurer",
      purpose: "insurance_review",
      recipientEmail: "reviewer@example.com",
      claimCategories: ["account_trust"],
      summary: "Tenant consent is required before RentChain prepares this non-public, metadata-only institution access grant.",
    },
    expiresAt: "2026-06-01T00:00:00.000Z",
    revokedAt: null,
    generatedAt: "2026-05-01T00:00:00.000Z",
    metadataOnly: true,
    policyGated: true,
    publicAccessEnabled: false,
    publicProfileEnabled: false,
    externalSubmissionEnabled: false,
    providerIntegrationEnabled: false,
    automatedDecisioningEnabled: false,
    recipientAccess: {
      enabled: false,
      accessUrl: null,
      accessTokenIssued: false,
      recipientAuthenticationRequired: true,
      sessionBound: true,
      downloadEnabled: false,
      summary: "No public link or external delivery is created by this grant.",
    },
    package: {
      status: "export_ready",
      exportSummaries: [
        {
          attestationId: "attestation-1",
          claimCategory: "account_trust",
          claimLabel: "Account trust",
          metadataOnly: true,
          rawEvidenceIncluded: false,
          rawProviderPayloadIncluded: false,
          supportMetadataIncluded: false,
          publicAccessEnabled: false,
          externalSubmissionEnabled: false,
        },
      ],
      blockedReasons: [],
    },
    includedClaims: [
      {
        attestationId: "attestation-1",
        claimCategory: "account_trust",
        claimLabel: "Account trust",
        lifecycleState: "export_ready",
        consentExpiresAt: "2026-06-01T00:00:00.000Z",
      },
    ],
    excludedClaims: [],
    redactions: ["Support/internal metadata is excluded."],
    disclaimers: ["This grant is not an automated eligibility decision."],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    events: [],
    ...patch,
  };
  ensureCollection("tenantInstitutionAccessGrants").set(grant.grantId, grant);
  return grant;
}

describe("recipientTrustReviewRoutes", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
  });

  it("rejects unauthenticated access and wrong recipients", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;
    seedGrant();

    const unauthenticated = await invokeRouter(router, { method: "GET", url: "/trust-reviews/grant-1" });
    expect(unauthenticated.status).toBe(401);

    const wrong = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "other@example.com", role: "landlord" }) },
    });
    expect(wrong.status).toBe(404);
    expect(wrong.body?.decision?.status).toBe("recipient_mismatch");
  });

  it("returns metadata-only view-only review for the intended recipient", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;
    seedGrant();

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.decision?.allowed).toBe(true);
    expect(res.body?.data?.summary?.access).toEqual(
      expect.objectContaining({
        authenticated: true,
        sessionBound: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
        externalSubmissionEnabled: false,
      })
    );
    const payload = JSON.stringify(res.body?.data || {});
    expect(payload).not.toContain("tenant-1");
    expect(payload).not.toContain("policyDecisions");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(payload).not.toContain("publicAccessEnabled\":true");
    expect(payload).not.toContain("downloadEnabled\":true");
    expect(payload).not.toContain("accessTokenIssued");

    const stored = ensureCollection("tenantInstitutionAccessGrants").get("grant-1");
    expect(stored.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "recipient_trust_review_opened",
          metadataOnly: true,
          status: "available",
          reason: "review_available",
        }),
      ])
    );
  });

  it("blocks revoked, expired, and policy-denied grants", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;

    seedGrant({ lifecycle: "revoked", revokedAt: "2026-05-02T00:00:00.000Z" });
    const revoked = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });
    expect(revoked.status).toBe(410);
    expect(revoked.body?.decision?.status).toBe("revoked");

    collections.clear();
    seedGrant({ expiresAt: "2020-01-01T00:00:00.000Z" });
    const expired = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });
    expect(expired.status).toBe(410);
    expect(expired.body?.decision?.status).toBe("expired");

    collections.clear();
    seedGrant({ package: { status: "blocked", exportSummaries: [], blockedReasons: ["policy denied"] } });
    const blocked = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body?.decision?.status).toBe("blocked");
  });
});
