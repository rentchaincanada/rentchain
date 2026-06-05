import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrustWorkspaceSummary } from "../../lib/trustWorkspace/trustWorkspaceTypes";

type MockUser = {
  id?: string;
  role?: string;
  landlordId?: string;
};

let mockUser: MockUser | null = { id: "landlord-1", role: "landlord", landlordId: "landlord-1" };
let workspaceMode: "success" | "failure" | "noEvidence" | "noPackage" | "wrongPackage" | "invalidChain" = "success";
let signatureMode: "success" | "failure" = "success";

const evidenceRef = "evidence:eeeeeeeeeeeeeeeeeeee";
const packageRef = "exportpackage:pppppppppppppppppppp";

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: express.Request & { user?: MockUser }, res: express.Response, next: express.NextFunction) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: express.Request & { user?: MockUser }, res: express.Response, next: express.NextFunction) => {
    const role = String(req.user?.role || "").toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id;
    if (role !== "landlord" && role !== "admin") return res.status(403).json({ ok: false, error: "Forbidden" });
    if (!landlordId) return res.status(401).json({ ok: false, error: "Missing landlord context" });
    req.user = { ...req.user, landlordId };
    return next();
  },
}));

vi.mock("../../auth/requestAuthority", () => ({
  getEffectiveLandlordId: (req: express.Request & { user?: MockUser }) => req.user?.landlordId || null,
}));

function workspace(overrides: Partial<TrustWorkspaceSummary> = {}): TrustWorkspaceSummary {
  return {
    workspaceRef: "trust_workspace:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    derivedAt: "2026-06-05T12:00:00.000Z",
    role: "landlord",
    landlordRef: "landlord:aaaaaaaaaaaaaaaaaaaa",
    tenantRef: null,
    evidenceSummaries:
      workspaceMode === "noEvidence"
        ? []
        : [
            {
              evidenceRef,
              evidenceClass: "AuditEvidence",
              evidenceType: "trust_signoff",
              resourceType: "canonicalEvent",
              status: "active",
              contentHash: "a".repeat(64),
              provenanceChain: [],
              authority: {
                authorityRole: "landlord",
                landlordRef: "landlord:aaaaaaaaaaaaaaaaaaaa",
                tenantRef: null,
                supportAllowed: false,
                rawIdsIncluded: false,
              },
              attestationStatus: workspaceMode === "invalidChain" ? "Unlinked" : "SignatureVerified",
              policyEvaluationState: "export_ready",
              metadataOnly: true,
              immutable: true,
              nonPublic: true,
              nonShareable: true,
              rawIdsIncluded: false,
              payloadIncluded: false,
            },
          ],
    attestationContexts:
      workspaceMode === "invalidChain"
        ? []
        : [
            {
              attestationRef: "attestation:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              evidenceRef,
              lifecycleState: "SignatureVerified",
              signatureRef: "signature:aaaaaaaaaaaaaaaaaaaa",
              certificateRef: "certificate:aaaaaaaaaaaaaaaaaaaa",
              signatureAlgorithm: "RSA-SHA256",
              hashValue: "a".repeat(64),
              hashVerificationStatus: "verified",
              linkedEvidence: [evidenceRef],
              metadataOnly: true,
              immutable: true,
              nonPublic: true,
              nonShareable: true,
              rawIdsIncluded: false,
              payloadIncluded: false,
            },
          ],
    exportReadinessStates:
      workspaceMode === "noPackage"
        ? []
        : [
            {
              exportPackageRef: workspaceMode === "wrongPackage" ? "exportpackage:qqqqqqqqqqqqqqqqqqqq" : packageRef,
              audience: "insurer",
              purpose: "insurance_review",
              status: "export_ready",
              policyGateStatus: "ready",
              blockedReasonCount: 0,
              exportableAttestationCount: 1,
              blockedAttestationCount: 0,
              manualOnly: true,
              publicAccessEnabled: false,
              externalSubmissionEnabled: false,
              metadataOnly: true,
              immutable: true,
              nonPublic: true,
              nonShareable: true,
              rawIdsIncluded: false,
              payloadIncluded: false,
            },
          ],
    crossOrgContexts: [],
    errorFlags: [],
    metadataOnly: true,
    immutable: true,
    nonPublic: true,
    nonShareable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
    ...overrides,
  };
}

const getTrustWorkspaceForUserMock = vi.fn(async () => {
  if (workspaceMode === "failure") {
    return { ok: false, code: "TRUST_WORKSPACE_DERIVATION_FAILED", error: "TRUST_WORKSPACE_DERIVATION_FAILED" };
  }
  return { ok: true, workspace: workspace() };
});

const requestSignatureForPackageMock = vi.fn(async () => {
  if (signatureMode === "failure") return null;
  return {
    timestamp: "2026-06-05T12:10:00.000Z",
    metadata: {
      details: {
        attestationRef: "attestation:ssssssssssssssssssssssssssssssss",
      },
    },
  };
});

vi.mock("../../services/trust-workspace-service", () => ({
  getTrustWorkspaceForUser: getTrustWorkspaceForUserMock,
}));

vi.mock("../../services/attestation-service", () => ({
  requestSignatureForPackage: requestSignatureForPackageMock,
}));

async function testApp() {
  const router = (await import("../landlordEvidenceExportTrustSignoffRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/landlord", router);
  return app;
}

describe("landlord evidence export trust signoff routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockUser = { id: "landlord-1", role: "landlord", landlordId: "landlord-1" };
    workspaceMode = "success";
    signatureMode = "success";
  });

  it("returns landlord trust context with safe metadata-only projection", async () => {
    const res = await request(await testApp()).get("/landlord/evidence-export-trust-context");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ ok: true }));
    expect(res.body.context).toEqual(expect.objectContaining({
      metadataOnly: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    }));
    expect(JSON.stringify(res.body)).not.toContain("landlord-1");
  });

  it("requires authentication and landlord scope for context retrieval", async () => {
    mockUser = null;
    const unauthenticated = await request(await testApp()).get("/landlord/evidence-export-trust-context");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body).toEqual({ ok: false, error: "UNAUTHORIZED" });

    mockUser = { id: "tenant-1", role: "tenant" };
    const forbidden = await request(await testApp()).get("/landlord/evidence-export-trust-context");
    expect(forbidden.status).toBe(403);
  });

  it("returns safe context derivation error", async () => {
    workspaceMode = "failure";
    const res = await request(await testApp()).get("/landlord/evidence-export-trust-context");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: "TRUST_CONTEXT_FAILED" });
  });

  it("requests signature signoff for valid landlord evidence and package", async () => {
    const res = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({
        evidenceRef,
        packageRef,
        packageType: "insurance_review",
        audience: "insurer",
        purpose: "InsuranceClaim",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      attestationRef: "attestation:ssssssssssssssssssssssssssssssss",
      timestamp: Date.parse("2026-06-05T12:10:00.000Z"),
      status: "signature_requested",
    });
    expect(requestSignatureForPackageMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(res.body)).not.toContain("landlord-1");
  });

  it("validates required signoff inputs", async () => {
    const missingEvidence = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ packageRef, packageType: "insurance_review", audience: "insurer", purpose: "InsuranceClaim" });
    expect(missingEvidence.status).toBe(400);
    expect(missingEvidence.body).toEqual({ ok: false, error: "INVALID_SCOPE" });

    const missingPackage = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageType: "insurance_review", audience: "insurer", purpose: "InsuranceClaim" });
    expect(missingPackage.status).toBe(400);

    const invalidType = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageRef, packageType: "unknown_type", audience: "insurer", purpose: "InsuranceClaim" });
    expect(invalidType.status).toBe(400);

    const invalidAudience = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageRef, packageType: "insurance_review", audience: "public", purpose: "InsuranceClaim" });
    expect(invalidAudience.status).toBe(400);
  });

  it("fails closed when evidence, package, or attestation chain is inaccessible", async () => {
    workspaceMode = "noEvidence";
    const noEvidence = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageRef, packageType: "insurance_review", audience: "insurer", purpose: "InsuranceClaim" });
    expect(noEvidence.status).toBe(404);
    expect(noEvidence.body).toEqual({ ok: false, error: "EVIDENCE_NOT_FOUND" });

    workspaceMode = "noPackage";
    const noPackage = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageRef, packageType: "insurance_review", audience: "insurer", purpose: "InsuranceClaim" });
    expect(noPackage.status).toBe(404);
    expect(noPackage.body).toEqual({ ok: false, error: "PACKAGE_NOT_FOUND" });

    workspaceMode = "wrongPackage";
    const wrongPackage = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageRef, packageType: "insurance_review", audience: "insurer", purpose: "InsuranceClaim" });
    expect(wrongPackage.status).toBe(404);
    expect(wrongPackage.body).toEqual({ ok: false, error: "PACKAGE_NOT_FOUND" });

    workspaceMode = "invalidChain";
    const invalidChain = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageRef, packageType: "insurance_review", audience: "insurer", purpose: "InsuranceClaim" });
    expect(invalidChain.status).toBe(400);
    expect(invalidChain.body).toEqual({ ok: false, error: "ATTESTATION_CHAIN_INVALID" });
  });

  it("returns safe service errors for workspace and signature request failures", async () => {
    workspaceMode = "failure";
    const contextFailed = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageRef, packageType: "insurance_review", audience: "insurer", purpose: "InsuranceClaim" });
    expect(contextFailed.status).toBe(500);
    expect(contextFailed.body).toEqual({ ok: false, error: "TRUST_CONTEXT_FAILED" });

    workspaceMode = "success";
    signatureMode = "failure";
    const signatureFailed = await request(await testApp())
      .post("/landlord/evidence-export-trust-signoff")
      .send({ evidenceRef, packageRef, packageType: "insurance_review", audience: "insurer", purpose: "InsuranceClaim" });
    expect(signatureFailed.status).toBe(500);
    expect(signatureFailed.body).toEqual({ ok: false, error: "SIGNATURE_REQUEST_FAILED" });
  });
});
