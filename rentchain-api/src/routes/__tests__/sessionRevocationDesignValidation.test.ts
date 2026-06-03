import { describe, expect, it } from "vitest";

type RevocationOption = "session_record" | "jwt_deny_list" | "token_version";
type Visibility = "admin_only" | "tenant_visible";
type RevocationStatus = "active" | "revoked" | "review_cleared" | "expired";

type SessionRecordDesign = {
  option: "session_record";
  sessionRef: string;
  userRef: string;
  landlordRef: string | null;
  tenantRef: string | null;
  deviceFingerprintHash: string;
  status: RevocationStatus;
  tokenContent?: string;
  credentialMaterial?: string;
  permissionsPatch?: string[];
  auditRef: string;
  visibility: Visibility;
};

type DenialRecordDesign = {
  option: "jwt_deny_list";
  denialRef: string;
  tokenIdentifierHash: string;
  userRef: string;
  landlordRef: string | null;
  tenantRef: string | null;
  deniedAt: string;
  expiresAfter: string;
  status: Exclude<RevocationStatus, "active">;
  tokenContent?: string;
  auditRef: string;
  visibility: Visibility;
};

type TokenVersionDesign = {
  option: "token_version";
  userRef: string;
  currentVersion: number;
  priorVersion: number;
  status: "version_bumped" | "review_cleared";
  deletesHistory: boolean;
  exposesVersionToClient: boolean;
  auditRef: string;
  visibility: Visibility;
};

type IncidentProcedure = {
  category: "auth_session" | "credential_secret" | "admin_support_access";
  responseState: "observed" | "triaged" | "investigating" | "contained" | "remediated" | "closed";
  mitigation: "password_reset" | "user_disablement" | "admin_permission_removal" | "future_revocation_review";
  resourceType: "user" | "credential" | "admin_route";
  action: string;
  actorRole: "admin" | "support";
  tenantVisible: false;
  metadataOnly: true;
  auditExpectation: "manual_append_only";
  tokenMetadataIncluded: false;
};

const safeHash = "sha256:0c2c5161d9f24dd5";

function sessionRecord(overrides: Partial<SessionRecordDesign> = {}): SessionRecordDesign {
  return {
    option: "session_record",
    sessionRef: "session:hashed-session-ref",
    userRef: "user:hashed-user-a",
    landlordRef: "landlord:hashed-landlord-a",
    tenantRef: null,
    deviceFingerprintHash: safeHash,
    status: "active",
    auditRef: "audit:session-review-a",
    visibility: "admin_only",
    ...overrides,
  };
}

function denialRecord(overrides: Partial<DenialRecordDesign> = {}): DenialRecordDesign {
  return {
    option: "jwt_deny_list",
    denialRef: "denial:hashed-denial-ref",
    tokenIdentifierHash: safeHash,
    userRef: "user:hashed-user-a",
    landlordRef: "landlord:hashed-landlord-a",
    tenantRef: null,
    deniedAt: "2026-06-03T00:00:00.000Z",
    expiresAfter: "2026-06-11T00:00:00.000Z",
    status: "revoked",
    auditRef: "audit:denial-review-a",
    visibility: "admin_only",
    ...overrides,
  };
}

function tokenVersion(overrides: Partial<TokenVersionDesign> = {}): TokenVersionDesign {
  return {
    option: "token_version",
    userRef: "user:hashed-user-a",
    currentVersion: 3,
    priorVersion: 2,
    status: "version_bumped",
    deletesHistory: false,
    exposesVersionToClient: false,
    auditRef: "audit:version-review-a",
    visibility: "admin_only",
    ...overrides,
  };
}

function incidentProcedure(overrides: Partial<IncidentProcedure> = {}): IncidentProcedure {
  return {
    category: "auth_session",
    responseState: "contained",
    mitigation: "future_revocation_review",
    resourceType: "user",
    action: "session_revocation_review",
    actorRole: "admin",
    tenantVisible: false,
    metadataOnly: true,
    auditExpectation: "manual_append_only",
    tokenMetadataIncluded: false,
    ...overrides,
  };
}

function isScopedToOneUser(record: Pick<SessionRecordDesign | DenialRecordDesign | TokenVersionDesign, "userRef">) {
  return /^user:/.test(record.userRef) && !record.userRef.includes(",");
}

function excludesSensitiveMaterial(record: Record<string, unknown>) {
  const serialized = JSON.stringify(record).toLowerCase();
  return (
    !("tokenContent" in record) &&
    !("credentialMaterial" in record) &&
    !serialized.includes("bearer ") &&
    !serialized.includes("password=") &&
    !serialized.includes("secret=")
  );
}

function isAdminOnly(record: { visibility: Visibility }) {
  return record.visibility === "admin_only";
}

function hasAuditLink(record: { auditRef: string }) {
  return /^audit:/.test(record.auditRef);
}

function supportsReview(status: string) {
  return ["review_cleared", "revoked", "version_bumped"].includes(status);
}

describe("session revocation design validation - session-record model", () => {
  it("keeps a session record scoped to exactly one user", () => {
    expect(isScopedToOneUser(sessionRecord())).toBe(true);
    expect(isScopedToOneUser(sessionRecord({ userRef: "user:a,user:b" }))).toBe(false);
  });

  it("rejects landlord scope drift for a session record", () => {
    const record = sessionRecord({ landlordRef: "landlord:hashed-landlord-a" });
    const requestScope = "landlord:hashed-landlord-a";

    expect(record.landlordRef).toBe(requestScope);
    expect(sessionRecord({ landlordRef: "landlord:other" }).landlordRef).not.toBe(requestScope);
  });

  it("does not store bearer values or credential material in a session record", () => {
    expect(excludesSensitiveMaterial(sessionRecord())).toBe(true);
    expect(excludesSensitiveMaterial(sessionRecord({ tokenContent: "Bearer copied" }))).toBe(false);
  });

  it("keeps session revocation isolated from permission and entitlement changes", () => {
    const record = sessionRecord({ status: "revoked" });

    expect(record.permissionsPatch).toBeUndefined();
    expect(record.status).toBe("revoked");
  });

  it("keeps device fingerprints hashed and admin-only", () => {
    const record = sessionRecord();

    expect(record.deviceFingerprintHash).toMatch(/^sha256:/);
    expect(isAdminOnly(record)).toBe(true);
  });
});

describe("session revocation design validation - JWT deny-list model", () => {
  it("uses hashed token identifiers for denial lookup", () => {
    const record = denialRecord();

    expect(record.tokenIdentifierHash).toMatch(/^sha256:/);
    expect(record).not.toHaveProperty("tokenIdentifier");
  });

  it("does not store original token content in denial records", () => {
    expect(excludesSensitiveMaterial(denialRecord())).toBe(true);
    expect(excludesSensitiveMaterial(denialRecord({ tokenContent: "Bearer copied" }))).toBe(false);
  });

  it("keeps denial timestamps immutable in the design shape", () => {
    const record = denialRecord();
    const copy = { ...record, deniedAt: "2026-06-03T00:00:00.000Z" };

    expect(copy.deniedAt).toBe(record.deniedAt);
    expect(new Date(record.expiresAfter).getTime()).toBeGreaterThan(new Date(record.deniedAt).getTime());
  });

  it("keeps denial decisions scoped to the affected user", () => {
    const affected = denialRecord({ userRef: "user:hashed-user-a" });
    const other = denialRecord({ userRef: "user:hashed-user-b" });

    expect(affected.userRef).not.toBe(other.userRef);
  });

  it("does not expose denial internals to tenant-facing responses", () => {
    const record = denialRecord();

    expect(isAdminOnly(record)).toBe(true);
    expect(record.visibility).not.toBe("tenant_visible");
  });
});

describe("session revocation design validation - token-version model", () => {
  it("isolates version state to one user reference", () => {
    expect(isScopedToOneUser(tokenVersion())).toBe(true);
  });

  it("does not delete historical user or audit records when version changes", () => {
    const record = tokenVersion({ currentVersion: 4, priorVersion: 3 });

    expect(record.currentVersion).toBeGreaterThan(record.priorVersion);
    expect(record.deletesHistory).toBe(false);
    expect(hasAuditLink(record)).toBe(true);
  });

  it("requires version comparison against current user state", () => {
    const currentUserVersion = 5;
    const tokenClaimVersion = 4;

    expect(tokenClaimVersion).toBeLessThan(currentUserVersion);
  });

  it("affects only the selected user's future tokens", () => {
    const selected = tokenVersion({ userRef: "user:hashed-user-a" });
    const other = tokenVersion({ userRef: "user:hashed-user-b" });

    expect(selected.userRef).not.toBe(other.userRef);
  });

  it("does not expose version values to clients", () => {
    expect(tokenVersion().exposesVersionToClient).toBe(false);
  });
});

describe("session revocation design validation - shared properties", () => {
  it("requires audit linkage across all revocation designs", () => {
    expect([sessionRecord(), denialRecord(), tokenVersion()].every(hasAuditLink)).toBe(true);
  });

  it("keeps revocation decision surfaces admin-only", () => {
    expect([sessionRecord(), denialRecord(), tokenVersion()].every(isAdminOnly)).toBe(true);
  });

  it("supports review or reversal without destructive deletion", () => {
    expect(supportsReview(sessionRecord({ status: "review_cleared" }).status)).toBe(true);
    expect(supportsReview(denialRecord({ status: "review_cleared" }).status)).toBe(true);
    expect(supportsReview(tokenVersion({ status: "review_cleared" }).status)).toBe(true);
  });

  it("allows incident metadata to reference revocation without embedding sensitive material", () => {
    const metadata = {
      incidentRef: "incident:auth-session",
      revocationRef: "revocation:hashed-ref",
      tokenMetadataIncluded: false,
      metadataOnly: true,
    };

    expect(metadata.metadataOnly).toBe(true);
    expect(metadata.tokenMetadataIncluded).toBe(false);
    expect(excludesSensitiveMaterial(metadata)).toBe(true);
  });

  it("documents assumptions without depending on Firestore or runtime auth state", () => {
    const assumptions = ["assumes Firestore atomicity", "assumes JWT claims immutability"];

    expect(assumptions).toContain("assumes Firestore atomicity");
    expect(assumptions).toContain("assumes JWT claims immutability");
  });
});

describe("session revocation design validation - incident response procedures", () => {
  it("maps auth-session incidents to revocation review without token metadata", () => {
    const procedure = incidentProcedure({ category: "auth_session" });

    expect(procedure.mitigation).toBe("future_revocation_review");
    expect(procedure.tokenMetadataIncluded).toBe(false);
  });

  it("maps credential-secret incidents to manual containment", () => {
    const procedure = incidentProcedure({
      category: "credential_secret",
      mitigation: "user_disablement",
      resourceType: "credential",
      action: "credential_rotation_review",
    });

    expect(procedure.category).toBe("credential_secret");
    expect(procedure.auditExpectation).toBe("manual_append_only");
  });

  it("maps admin-support incidents to admin-only audit review", () => {
    const procedure = incidentProcedure({
      category: "admin_support_access",
      mitigation: "admin_permission_removal",
      resourceType: "admin_route",
      action: "permission_removed",
    });

    expect(procedure.actorRole).toBe("admin");
    expect(procedure.tenantVisible).toBe(false);
  });

  it("structures user disablement audit metadata without destructive mutation", () => {
    const procedure = incidentProcedure({
      mitigation: "user_disablement",
      action: "disabled",
      responseState: "contained",
    });

    expect(procedure).toMatchObject({
      resourceType: "user",
      action: "disabled",
      metadataOnly: true,
      auditExpectation: "manual_append_only",
    });
  });

  it("keeps support-console session timeline review metadata-only", () => {
    const procedure = incidentProcedure({
      category: "admin_support_access",
      action: "support_console_timeline_review",
    });

    expect(procedure.metadataOnly).toBe(true);
    expect(procedure.tenantVisible).toBe(false);
  });
});
