import { beforeEach, describe, expect, it, vi } from "vitest";

let mockUser: Record<string, unknown> | null = null;
const hashValue = "b".repeat(64);

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: unknown }, res: { status: (code: number) => { json: (body: unknown) => unknown } }, next: () => unknown) => {
    if (!mockUser) return res.status(401).json({ success: false, data: null, error: "ATTESTATION_UNAUTHORIZED", code: "ATTESTATION_UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));

vi.mock("../../services/attestation-hash-retrieval-service", async () => {
  const actual = await vi.importActual<typeof import("../../services/attestation-hash-retrieval-service")>(
    "../../services/attestation-hash-retrieval-service"
  );
  return {
    ...actual,
    getAttestationHashMetadata: vi.fn(async (hash: string) => {
      if (hash === "bad") throw new Error("attestation_hash_invalid");
      if (hash === "0".repeat(64)) return null;
      if (hash === "f".repeat(64)) throw new Error("attestation_access_forbidden");
      return {
        hashValue: hash,
        attestationRef: "attestation:routehash",
        exportPackageRef: "exportpackage:eeeeeeeeeeeeeeeeeeee",
        evidenceRef: "evidence:eeeeeeeeeeeeeeeeeeee",
        lifecycleState: "SignatureVerified",
        signature: {
          signatureRef: "signature:routehash",
          certificateRef: "certificate:routehash",
          signatureAlgorithm: "RSA-SHA256",
        },
        verificationStatus: "verified",
        observedAt: "2026-06-05T12:04:00.000Z",
        metadataOnly: true,
        immutable: true,
        rawIdsIncluded: false,
        payloadIncluded: false,
      };
    }),
    getAttestationEvidenceChain: vi.fn(async (evidenceRef: string) => {
      if (evidenceRef === "invalid_reference") throw new Error("attestation_evidence_ref_invalid");
      return {
        attestationRef: "attestation:routehash",
        exportPackageRef: "exportpackage:eeeeeeeeeeeeeeeeeeee",
        currentState: "SignatureVerified",
        events: [
          {
            eventType: "ExportPackageSignatureGenerated",
            lifecycleState: "SignatureGenerated",
            timestamp: "2026-06-05T12:03:00.000Z",
            hashValue,
            signatureRef: "signature:routehash",
            certificateRef: "certificate:routehash",
            signatureAlgorithm: "RSA-SHA256",
            evidenceRef: null,
            metadataOnly: true,
            immutable: true,
            rawIdsIncluded: false,
            payloadIncluded: false,
          },
        ],
        pagination: { limit: 50, returned: 1, hasMore: false },
        metadataOnly: true,
        appendOnly: true,
        immutable: true,
        rawIdsIncluded: false,
        payloadIncluded: false,
      };
    }),
    verifyAttestationEvidenceChain: vi.fn(async () => ({
      evidenceRef: "evidence:eeeeeeeeeeeeeeeeeeee",
      verified: true,
      matchedHash: hashValue,
      attestationRef: "attestation:routehash",
      verificationErrors: [],
      chain: null,
      metadataOnly: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    })),
  };
});

async function invokeRouter(router: { handle: (req: unknown, res: unknown, next: (error?: unknown) => void) => void }, url: string) {
  return await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const req = {
      method: "GET",
      url,
      originalUrl: url,
      path: url.split("?")[0],
      params: {},
      query: {},
      headers: {},
    };
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: Record<string, unknown>) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error?: unknown) => {
      if (error) reject(error);
    });
  });
}

describe("attestation hash routes", () => {
  beforeEach(() => {
    mockUser = { id: "landlord-1", role: "landlord", landlordId: "landlord-1" };
  });

  it("returns hash metadata in the standard envelope", async () => {
    const router = (await import("../attestationRoutes")).default;
    const response = await invokeRouter(router, `/hash/${hashValue}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      success: true,
      code: "OK",
      error: null,
    }));
    expect(response.body.data).toEqual(expect.objectContaining({
      hashValue,
      verificationStatus: "verified",
      rawIdsIncluded: false,
      payloadIncluded: false,
    }));
    expect(JSON.stringify(response.body)).not.toContain("landlord-1");
  });

  it("returns fixed error codes for missing auth, bad request, forbidden, and not found", async () => {
    const router = (await import("../attestationRoutes")).default;
    mockUser = null;
    expect(await invokeRouter(router, `/hash/${hashValue}`)).toEqual({
      status: 401,
      body: { success: false, data: null, error: "ATTESTATION_UNAUTHORIZED", code: "ATTESTATION_UNAUTHORIZED" },
    });

    mockUser = { id: "landlord-1", role: "landlord", landlordId: "landlord-1" };
    expect(await invokeRouter(router, "/hash/bad")).toEqual({
      status: 400,
      body: { success: false, data: null, error: "ATTESTATION_BAD_REQUEST", code: "ATTESTATION_BAD_REQUEST" },
    });
    expect(await invokeRouter(router, `/hash/${"f".repeat(64)}`)).toEqual({
      status: 403,
      body: { success: false, data: null, error: "ATTESTATION_FORBIDDEN", code: "ATTESTATION_FORBIDDEN" },
    });
    expect(await invokeRouter(router, `/hash/${"0".repeat(64)}`)).toEqual({
      status: 404,
      body: { success: false, data: null, error: "ATTESTATION_NOT_FOUND", code: "ATTESTATION_NOT_FOUND" },
    });
  });

  it("returns chain and verification responses", async () => {
    const router = (await import("../attestationRoutes")).default;
    const chain = await invokeRouter(router, "/evidence/evidence:eeeeeeeeeeeeeeeeeeee/chain");
    const verified = await invokeRouter(router, "/evidence/evidence:eeeeeeeeeeeeeeeeeeee/verify");

    expect(chain.status).toBe(200);
    expect(chain.body.data).toEqual(expect.objectContaining({
      currentState: "SignatureVerified",
      rawIdsIncluded: false,
      payloadIncluded: false,
    }));
    expect(verified.status).toBe(200);
    expect(verified.body.data).toEqual(expect.objectContaining({
      verified: true,
      matchedHash: hashValue,
    }));
  });
});
