export type IdentityOracleProvinceCode = "ON" | "NS";

export type IdentityOracleIdentifierType = "pin" | "pid";

export type IdentityOracleSyntaxStatus = "valid" | "invalid" | "unsupported";

export interface IdentityOracleNormalizationInput {
  propertyId: string;
  identifier: string;
  identifierType?: string | null;
  province?: string | null;
  municipality?: string | null;
  actorId?: string | null;
  actorType?: "system" | "admin";
}

export interface IdentityOracleSyntaxResult {
  status: IdentityOracleSyntaxStatus;
  ok: boolean;
  reason: string | null;
  normalizedIdentifier: string | null;
}

export interface IdentityOracleRunRecord {
  id: string;
  propertyId: string;
  rc_prop_id: string | null;
  province: string | null;
  municipality: string | null;
  namespaceKey: string;
  identifierType: IdentityOracleIdentifierType | string;
  originalIdentifier: string;
  normalizedIdentifier: string | null;
  syntaxResult: IdentityOracleSyntaxResult;
  createdAt: string;
  createdBy: string | null;
  actorType: "system" | "admin";
}

export interface PropertyIdentityProfileRecord {
  propertyId: string;
  rc_prop_id: string | null;
  province: string | null;
  municipality: string | null;
  namespaceKey: string;
  latestRunId: string;
  lastRunAt: string;
  identifierType: IdentityOracleIdentifierType | string;
  syntaxStatus: IdentityOracleSyntaxStatus;
  identifiers: Record<
    string,
    {
      identifierType: string;
      originalIdentifier: string;
      normalizedIdentifier: string | null;
      syntaxStatus: IdentityOracleSyntaxStatus;
      lastRunId: string;
      updatedAt: string;
    }
  >;
}

export interface IdentityOracleExecutionResult {
  run: IdentityOracleRunRecord;
  profile: PropertyIdentityProfileRecord;
}
