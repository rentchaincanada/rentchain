export type IdentityOracleProvinceCode = "ON" | "NS";

export type IdentityOracleIdentifierType = "pin" | "pid";

export type IdentityOracleSyntaxStatus = "valid" | "invalid" | "unsupported";

export type IdentityOracleVerificationStatus =
  | "SYNTAX_ONLY"
  | "VERIFIED_MATCH"
  | "PARTIAL_MATCH"
  | "UNREGISTERED_RISK"
  | "UNVERIFIED"
  | "MANUAL_REVIEW_REQUIRED"
  | "SOURCE_UNAVAILABLE";

export type IdentityOracleSourceType =
  | "OPEN_DATASET"
  | "FEATURE_SERVICE"
  | "PAID_GATEWAY"
  | "MANUAL_DOCUMENT"
  | "INTERNAL_OVERRIDE";

export type IdentityOracleSourceHealth =
  | "healthy"
  | "degraded"
  | "unavailable"
  | "schema_drift_detected";

export interface IdentityOraclePropertyContext {
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  pid?: string | null;
  unitCount?: number | null;
}

export interface IdentityOracleNormalizationInput {
  propertyId: string;
  identifier: string;
  identifierType?: string | null;
  province?: string | null;
  municipality?: string | null;
  source?: string | null;
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
  verificationStatus?: IdentityOracleVerificationStatus | null;
  confidence?: number | null;
  sourceType?: IdentityOracleSourceType | null;
  sourceKey?: string | null;
  sourceLabel?: string | null;
  sourceHealth?: IdentityOracleSourceHealth | null;
  flags?: string[];
  notes?: string[];
  relatedNamespaces?: string[];
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
      verificationStatus?: IdentityOracleVerificationStatus | null;
      confidence?: number | null;
      sourceType?: IdentityOracleSourceType | null;
      sourceKey?: string | null;
      sourceLabel?: string | null;
      sourceHealth?: IdentityOracleSourceHealth | null;
      flags?: string[];
      notes?: string[];
      relatedNamespaces?: string[];
      lastRunId: string;
      updatedAt: string;
    }
  >;
}

export interface IdentityOracleExecutionResult {
  run: IdentityOracleRunRecord;
  profile: PropertyIdentityProfileRecord;
}

export interface IdentityOracleVerificationResult {
  namespaceKey: string;
  normalizedIdentifier: string;
  identifierType: string;
  verificationStatus: IdentityOracleVerificationStatus;
  confidence: number | null;
  sourceType: IdentityOracleSourceType;
  sourceKey: string;
  sourceLabel: string;
  sourceHealth: IdentityOracleSourceHealth;
  flags: string[];
  notes: string[];
  relatedNamespaces?: string[];
}
