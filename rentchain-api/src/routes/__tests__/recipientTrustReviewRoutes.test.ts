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
    where: (field: string, op: string, expected: any) => ({
      limit: (_count: number) => ({
        async get() {
          const docs = Array.from(ensureCollection(name).entries())
            .filter(([, value]) => op === "==" && value?.[field] === expected)
            .map(([id, value]) => ({
              id,
              data: () => clone(value),
            }));
          return { docs };
        },
      }),
    }),
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
      ip: "203.0.113.30",
      socket: { remoteAddress: "203.0.113.31" },
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
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
      headers: {
        "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }),
        "x-institution-review-onboarding-acknowledged": "true",
      },
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
    expect(res.body?.data?.summary?.session).toEqual(
      expect.objectContaining({
        schemaVersion: "recipient_review_session.v1",
        lifecycle: "active",
        authenticated: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
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
        expect.objectContaining({
          eventType: "recipient_review_session_started",
          metadataOnly: true,
          status: "active",
          reason: "session_started",
        }),
      ])
    );
    const securityTelemetry = stored.events
      .map((event: any) => event.securityTelemetry)
      .filter(Boolean);
    expect(securityTelemetry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaVersion: "security_session_telemetry.v1",
          workflow: "recipient_trust_review",
          signal: "recipient_review_opened",
          retention: expect.objectContaining({
            classification: "security_session_internal",
            internalOnly: true,
            portableVisible: false,
            exportable: false,
          }),
          request: expect.objectContaining({
            ipHash: expect.any(String),
            ipFamily: "ipv4",
            userAgentFamily: "unknown",
          }),
          payloadSafety: expect.objectContaining({
            trustPayloadIncluded: false,
            preciseGeolocationIncluded: false,
            deviceFingerprintingIncluded: false,
            behavioralProfileIncluded: false,
            riskScoreIncluded: false,
          }),
        }),
      ])
    );
    expect(JSON.stringify(res.body?.data || {})).not.toContain("securityTelemetry");
    expect(JSON.stringify(securityTelemetry)).not.toContain("203.0.113");
  });

  it("returns onboarding orientation before exposing review claim metadata", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;
    seedGrant();

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.decision).toEqual(
      expect.objectContaining({
        allowed: true,
        status: "onboarding_required",
        reason: "institution_review_onboarding_required",
        metadataOnly: true,
        publicAccessEnabled: false,
        downloadEnabled: false,
      })
    );
    expect(res.body?.data?.summary?.onboarding).toEqual(
      expect.objectContaining({
        schemaVersion: "institution_review_onboarding.v1",
        status: "required",
        acknowledgementRequired: true,
        acknowledged: false,
        tenantMediated: true,
        authenticatedRecipientRequired: true,
        metadataOnly: true,
        viewOnly: true,
        revocable: true,
        timeBound: true,
        policyGated: true,
        publicAccessEnabled: false,
        downloadEnabled: false,
        institutionAccountCreated: false,
        automatedDecisioningEnabled: false,
      })
    );
    expect(res.body?.data?.summary?.includedClaims).toEqual([]);
    expect(JSON.stringify(res.body?.data || {})).not.toContain("attestation-1");
    expect(JSON.stringify(res.body?.data || {})).not.toContain("policyDecisions");
    expect(ensureCollection("tenantInstitutionAccessGrants").get("grant-1")?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "institution_review_onboarding_started",
          metadataOnly: true,
          status: "onboarding_required",
          reason: "institution_review_onboarding_required",
        }),
      ])
    );
  });

  it("requires reauthentication for expired or mismatched recipient review sessions", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;
    seedGrant();
    ensureCollection("recipientTrustReviewSessions").set("session-1", {
      schemaVersion: "recipient_review_session.v1",
      sessionId: "session-1",
      grantId: "grant-1",
      recipientEmailHash: "wrong",
      recipientUserId: "recipient-1",
      audience: "insurer",
      purpose: "insurance_review",
      lifecycle: "active",
      issuedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-06-01T00:00:00.000Z",
      lastValidatedAt: "2026-05-01T00:00:00.000Z",
      metadataOnly: true,
      authenticated: true,
      viewOnly: true,
      downloadEnabled: false,
      publicAccessEnabled: false,
    });

    const mismatched = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: {
        "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }),
        "x-recipient-review-session-id": "session-1",
      },
    });
    expect(mismatched.status).toBe(401);
    expect(mismatched.body?.decision?.status).toBe("reauthentication_required");
    expect(mismatched.body?.decision?.reason).toBe("recipient_session_reauthentication_required");

    ensureCollection("recipientTrustReviewSessions").set("session-2", {
      schemaVersion: "recipient_review_session.v1",
      sessionId: "session-2",
      grantId: "grant-1",
      recipientEmailHash: "18717f7f1f60f92207bd02972c16aec92f52b31c2a8442444df988d8e8503c5e",
      recipientUserId: "recipient-1",
      audience: "insurer",
      purpose: "insurance_review",
      lifecycle: "active",
      issuedAt: "2020-01-01T00:00:00.000Z",
      expiresAt: "2020-01-01T00:00:00.000Z",
      lastValidatedAt: "2020-01-01T00:00:00.000Z",
      metadataOnly: true,
      authenticated: true,
      viewOnly: true,
      downloadEnabled: false,
      publicAccessEnabled: false,
    });
    const expired = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: {
        "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }),
        "x-recipient-review-session-id": "session-2",
      },
    });
    expect(expired.status).toBe(401);
    expect(expired.body?.decision?.status).toBe("session_expired");
    expect(expired.body?.decision?.reason).toBe("recipient_session_expired");
    expect(ensureCollection("recipientTrustReviewSessions").get("session-2")?.lifecycle).toBe("expired");
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

  it("invalidates stale recipient review sessions and requires reauthentication", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;
    seedGrant();

    const opened = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });
    const sessionId = opened.body?.data?.summary?.session?.sessionId;
    expect(sessionId).toBeTruthy();
    ensureCollection("recipientTrustReviewSessions").set(sessionId, {
      ...ensureCollection("recipientTrustReviewSessions").get(sessionId),
      staleAfter: "2020-01-01T00:00:00.000Z",
    });

    const stale = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: {
        "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }),
        "x-recipient-review-session-id": sessionId,
      },
    });

    expect(stale.status).toBe(401);
    expect(stale.body?.decision?.reason).toBe("recipient_session_stale");
    expect(ensureCollection("recipientTrustReviewSessions").get(sessionId)?.lifecycle).toBe("blocked");
    expect(ensureCollection("tenantInstitutionAccessGrants").get("grant-1")?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "recipient_review_session_blocked",
          reason: "recipient_session_stale",
          metadataOnly: true,
        }),
      ])
    );
  });

  it("blocks replayed recipient sessions after invite or package continuity changes", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;
    seedGrant({
      institutionReviewInvite: {
        schemaVersion: "institution_review_invite.v1",
        status: "invited",
        recipientEmail: "reviewer@example.com",
        redactedRecipientEmail: "re***@example.com",
        organizationName: "Example Insurance",
        audience: "insurer",
        purpose: "insurance_review",
        reviewUrl: "https://www.rentchain.test/recipient/trust-review/grant-1",
        createdAt: "2026-05-01T00:00:00.000Z",
        sentAt: "2026-05-01T00:00:00.000Z",
        openedAt: null,
        authenticatedAt: null,
        expiresAt: "2026-06-01T00:00:00.000Z",
        revokedAt: null,
        recipientAuthenticationRequired: true,
        inviteTokenIssued: false,
        bearerAccessEnabled: false,
        publicAccessEnabled: false,
        downloadEnabled: false,
        metadataOnly: true,
        summary: "Authenticated metadata-only review.",
      },
    });

    const opened = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });
    const sessionId = opened.body?.data?.summary?.session?.sessionId;
    expect(sessionId).toBeTruthy();

    const grant = ensureCollection("tenantInstitutionAccessGrants").get("grant-1");
    ensureCollection("tenantInstitutionAccessGrants").set("grant-1", {
      ...grant,
      institutionReviewInvite: {
        ...grant.institutionReviewInvite,
        sentAt: "2026-05-02T00:00:00.000Z",
      },
    });

    const replayed = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: {
        "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }),
        "x-recipient-review-session-id": sessionId,
      },
    });

    expect(replayed.status).toBe(401);
    expect(replayed.body?.decision?.reason).toBe("recipient_session_replay_blocked");
    expect(ensureCollection("recipientTrustReviewSessions").get(sessionId)?.lifecycle).toBe("blocked");
  });

  it("invalidates older active sessions when a new recipient session starts", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;
    seedGrant();

    const first = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });
    const firstSessionId = first.body?.data?.summary?.session?.sessionId;
    expect(firstSessionId).toBeTruthy();

    const second = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });
    const secondSessionId = second.body?.data?.summary?.session?.sessionId;
    expect(secondSessionId).toBeTruthy();
    expect(secondSessionId).not.toBe(firstSessionId);
    expect(ensureCollection("recipientTrustReviewSessions").get(firstSessionId)?.lifecycle).toBe("blocked");

    const oldSession = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: {
        "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }),
        "x-recipient-review-session-id": firstSessionId,
      },
    });
    expect(oldSession.status).toBe(401);
    expect(oldSession.body?.decision?.reason).toBe("recipient_session_reauthentication_required");
  });

  it("blocks superseded or inactive trust export lifecycle controls before review", async () => {
    const router = (await import("../recipientTrustReviewRoutes")).default;
    seedGrant({
      package: {
        status: "export_ready",
        lifecycleControl: {
          schemaVersion: "institutional_trust_export_lifecycle_control.v1",
          state: "superseded",
          reasons: ["export_superseded"],
          active: false,
          shareable: false,
          evaluatedAt: "2026-05-02T00:00:00.000Z",
          metadataOnly: true,
          publicAccessEnabled: false,
          externalSubmissionEnabled: false,
        },
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
    });

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/trust-reviews/grant-1",
      headers: { "x-test-user": JSON.stringify({ id: "recipient-1", email: "reviewer@example.com", role: "landlord" }) },
    });

    expect(res.status).toBe(403);
    expect(res.body?.decision?.reason).toBe("trust_export_lifecycle_inactive");
    expect(ensureCollection("recipientTrustReviewSessions").size).toBe(0);
  });
});
